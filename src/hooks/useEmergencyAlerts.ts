import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isBloodCompatible } from "@/lib/ml.functions";
import type { Donor } from "@/lib/donors";
import type { BloodRequest } from "@/pages/BloodRequests";

export function useEmergencyAlerts() {
  const [activeEmergencyRequest, setActiveEmergencyRequest] = useState<BloodRequest | null>(null);
  const [donorProfile, setDonorProfile] = useState<Donor | null>(null);
  const [donorCoords, setDonorCoords] = useState<{ lat: number; lng: number } | null>(null);

  // 1. Fetch current donor profile & geolocation
  useEffect(() => {
    let mounted = true;

    async function loadDonorProfile() {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user || !mounted) return;

      const { data: dData } = await supabase
        .from("donors")
        .select("*")
        .eq("user_id", u.user.id)
        .maybeSingle();

      if (dData && mounted) {
        const donor = dData as Donor;
        setDonorProfile(donor);
        setDonorCoords({ lat: donor.latitude, lng: donor.longitude });

        // Check if there is an existing unresponded open request compatible with donor
        fetchActiveCompatibleRequest(donor);
      }
    }

    loadDonorProfile();

    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (mounted) {
            setDonorCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          }
        },
        () => {},
        { enableHighAccuracy: true, timeout: 10000 },
      );
    }

    return () => {
      mounted = false;
    };
  }, []);

  async function fetchActiveCompatibleRequest(donor: Donor) {
    // Query open requests
    const { data: openRequests } = await supabase.rpc("get_open_blood_requests");
    if (!openRequests || openRequests.length === 0) return;

    // Check if donor has already responded (accepted or declined)
    const { data: myResponses } = await supabase
      .from("request_responses")
      .select("request_id, status")
      .eq("donor_user_id", donor.user_id);

    const respondedRequestIds = new Set(myResponses?.map((r) => r.request_id) || []);

    const compatible = (openRequests as Partial<BloodRequest>[]).find(
      (r) =>
        r.id &&
        !respondedRequestIds.has(r.id) &&
        r.blood_group &&
        isBloodCompatible(donor.blood_group, r.blood_group),
    );

    if (compatible && compatible.id) {
      setActiveEmergencyRequest({
        id: compatible.id,
        user_id: (compatible as any).user_id || "",
        patient_name: compatible.patient_name || "Emergency Patient",
        blood_group: compatible.blood_group || "O+",
        units_needed: compatible.units_needed || 1,
        urgency: (compatible.urgency as any) || "normal",
        status: "open",
        latitude: compatible.latitude || 0,
        longitude: compatible.longitude || 0,
        needed_by: compatible.needed_by || null,
        reason: (compatible as any).reason || null,
        notes: (compatible as any).notes || null,
        created_at: compatible.created_at || new Date().toISOString(),
      });
    }
  }

  // 2. Subscribe to Supabase Realtime changes on blood_requests
  useEffect(() => {
    if (!donorProfile) return;

    const channel = supabase
      .channel("emergency-requests-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "blood_requests",
        },
        (payload) => {
          const newReq = payload.new as Partial<BloodRequest>;
          if (
            newReq &&
            newReq.id &&
            newReq.status === "open" &&
            newReq.blood_group &&
            isBloodCompatible(donorProfile.blood_group, newReq.blood_group)
          ) {
            setActiveEmergencyRequest({
              id: newReq.id,
              user_id: newReq.user_id || "",
              patient_name: newReq.patient_name || "Emergency Patient",
              blood_group: newReq.blood_group,
              units_needed: newReq.units_needed || 1,
              urgency: (newReq.urgency as any) || "critical",
              status: "open",
              latitude: newReq.latitude || 0,
              longitude: newReq.longitude || 0,
              needed_by: newReq.needed_by || null,
              reason: newReq.reason || null,
              notes: newReq.notes || null,
              created_at: newReq.created_at || new Date().toISOString(),
            });
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [donorProfile]);

  return {
    activeEmergencyRequest,
    setActiveEmergencyRequest,
    donorProfile,
    donorCoords,
  };
}
