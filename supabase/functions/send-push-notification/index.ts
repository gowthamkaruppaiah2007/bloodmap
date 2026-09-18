import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper to Base64Url encode
function base64UrlEncode(input: string | Uint8Array): string {
  let base64 = "";
  if (typeof input === "string") {
    base64 = btoa(input);
  } else {
    let binary = "";
    const bytes = new Uint8Array(input);
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    base64 = btoa(binary);
  }
  return base64.replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

// Convert PEM string to Uint8Array key bytes
function pemToBinary(pem: string): Uint8Array {
  const lines = pem.split("\n");
  const base64 = lines.filter((line) => !line.startsWith("-----")).join("");
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Generate OAuth 2.0 Access Token for Firebase V1 API using Service Account Key
async function getGoogleAccessToken(serviceAccount: Record<string, string>): Promise<string> {
  const header = { alg: "RS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;

  const keyBytes = pemToBinary(serviceAccount.private_key);
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    keyBytes.buffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(unsignedToken),
  );

  const jwt = `${unsignedToken}.${base64UrlEncode(new Uint8Array(signature))}`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  const tokenJson = await tokenRes.json();
  if (!tokenRes.ok) {
    throw new Error(`Google OAuth error: ${JSON.stringify(tokenJson)}`);
  }
  return tokenJson.access_token;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { request_id } = body;

    if (!request_id) {
      return new Response(JSON.stringify({ error: "request_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Fetch Blood Request Details
    const { data: request, error: reqErr } = await supabaseClient
      .from("blood_requests")
      .select("*")
      .eq("id", request_id)
      .single();

    if (reqErr || !request) {
      return new Response(JSON.stringify({ error: "Blood request not found", details: reqErr }), {
        status: 444,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Fetch FCM Tokens for compatible available donors
    const { data: donorTokens, error: tokenErr } = await supabaseClient.rpc(
      "get_matching_donor_fcm_tokens",
      { p_blood_group: request.blood_group },
    );

    if (tokenErr) {
      console.error("Error fetching matching donor tokens:", tokenErr);
    }

    const tokensList: Array<{ user_id: string; token: string }> = donorTokens || [];

    if (tokensList.length === 0) {
      return new Response(
        JSON.stringify({
          message: "No matching donors with active FCM push tokens found",
          matching_count: 0,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // 3. Retrieve Firebase Service Account Secret
    const rawServiceAccount = Deno.env.get("FIREBASE_SERVICE_ACCOUNT");
    if (!rawServiceAccount) {
      console.warn(
        "FIREBASE_SERVICE_ACCOUNT environment variable is missing. Notifications cannot be dispatched to FCM.",
      );
      return new Response(
        JSON.stringify({
          error: "FIREBASE_SERVICE_ACCOUNT secret not configured in Supabase Edge Functions",
          matching_donors_found: tokensList.length,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    let serviceAccount: Record<string, string>;
    try {
      serviceAccount = JSON.parse(rawServiceAccount);
    } catch {
      return new Response(JSON.stringify({ error: "FIREBASE_SERVICE_ACCOUNT is not valid JSON" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Generate OAuth2 Access Token
    const accessToken = await getGoogleAccessToken(serviceAccount);
    const projectId = serviceAccount.project_id || "bloodmap-e723c";
    const fcmEndpoint = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

    // 5. Send FCM Push Notification to each target token
    const results = [];
    for (const item of tokensList) {
      const fcmBody = {
        message: {
          token: item.token,
          notification: {
            title: `URGENT: ${request.blood_group} Blood Needed!`,
            body: `${request.patient_name || "Emergency Patient"} needs ${request.units_needed} unit(s) of ${request.blood_group} blood.`,
          },
          data: {
            request_id: request.id,
            url: `/requests/${request.id}`,
            blood_group: request.blood_group,
            urgency: request.urgency || "normal",
          },
          webpush: {
            fcm_options: {
              link: `/requests/${request.id}`,
            },
          },
        },
      };

      try {
        const res = await fetch(fcmEndpoint, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(fcmBody),
        });

        const resData = await res.json();

        // Clean up invalid or stale tokens
        if (!res.ok && (resData.error?.code === 404 || resData.error?.status === "UNREGISTERED")) {
          await supabaseClient.from("fcm_tokens").delete().eq("token", item.token);
        }

        results.push({
          token: item.token,
          user_id: item.user_id,
          status: res.status,
          response: resData,
        });
      } catch (sendErr) {
        console.error("Error sending push notification to token:", item.token, sendErr);
        results.push({
          token: item.token,
          user_id: item.user_id,
          error: String(sendErr),
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        sent_count: results.filter((r) => r.status === 200).length,
        total_donors_notified: tokensList.length,
        results,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("Internal edge function error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
