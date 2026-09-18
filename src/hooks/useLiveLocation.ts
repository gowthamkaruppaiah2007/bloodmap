import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { haversineKm } from "@/lib/distance";

export interface LiveLocationData {
  id?: string;
  request_id: string;
  user_id: string;
  latitude: number;
  longitude: number;
  heading?: number | null;
  speed?: number | null;
  is_active: boolean;
  duration_minutes: number;
  expires_at: string;
  updated_at: string;
}

export function useLiveLocation(requestId: string, currentUserId: string | null) {
  const [myLocation, setMyLocation] = useState<LiveLocationData | null>(null);
  const [partnerLocation, setPartnerLocation] = useState<LiveLocationData | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [sharingDuration, setSharingDuration] = useState<number>(60); // default 60 minutes
  const [timeLeftFormatted, setTimeLeftFormatted] = useState<string>("");

  const watchIdRef = useRef<number | null>(null);
  const expiryTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Fetch current status of my live location & partner's live location
  const fetchLocations = useCallback(async () => {
    if (!requestId || !currentUserId) return;

    // Fetch my location
    const { data: myData } = await supabase
      .from("live_locations")
      .select("*")
      .eq("request_id", requestId)
      .eq("user_id", currentUserId)
      .maybeSingle();

    if (myData) {
      const isStillActive = myData.is_active && new Date(myData.expires_at).getTime() > Date.now();
      if (isStillActive) {
        setMyLocation(myData as LiveLocationData);
        setIsSharing(true);
        setSharingDuration(myData.duration_minutes);
      } else if (myData.is_active) {
        // Expired
        stopLiveSharing(false);
      }
    }

    // Fetch partner's location
    const { data: partnerData } = await supabase
      .from("live_locations")
      .select("*")
      .eq("request_id", requestId)
      .neq("user_id", currentUserId)
      .order("updated_at", { ascending: false });

    if (partnerData && partnerData.length > 0) {
      const activePartner = partnerData.find(
        (p) => p.is_active && new Date(p.expires_at).getTime() > Date.now(),
      );
      setPartnerLocation(activePartner ? (activePartner as LiveLocationData) : null);
    }
  }, [requestId, currentUserId]);

  useEffect(() => {
    fetchLocations();
  }, [fetchLocations]);

  // 2. Subscribe to Supabase Realtime changes for live_locations
  useEffect(() => {
    if (!requestId) return;

    const channel = supabase
      .channel(`live-locations-realtime-${requestId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "live_locations",
          filter: `request_id=eq.${requestId}`,
        },
        (payload) => {
          const updated = payload.new as LiveLocationData;
          if (updated && updated.user_id === currentUserId) {
            if (updated.is_active && new Date(updated.expires_at).getTime() > Date.now()) {
              setMyLocation(updated);
            } else {
              setMyLocation(null);
              setIsSharing(false);
            }
          } else if (updated) {
            const isStillActive =
              updated.is_active && new Date(updated.expires_at).getTime() > Date.now();
            setPartnerLocation(isStillActive ? updated : null);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [requestId, currentUserId]);

  // 3. Countdown timer for remaining live sharing duration
  useEffect(() => {
    if (!myLocation || !isSharing) {
      setTimeLeftFormatted("");
      return;
    }

    const interval = setInterval(() => {
      const diffMs = new Date(myLocation.expires_at).getTime() - Date.now();
      if (diffMs <= 0) {
        clearInterval(interval);
        stopLiveSharing(true);
        toast.info("Live location sharing duration expired.");
      } else {
        const mins = Math.floor(diffMs / 60000);
        const secs = Math.floor((diffMs % 60000) / 1000);
        if (mins >= 60) {
          const hours = (mins / 60).toFixed(1);
          setTimeLeftFormatted(`${hours}h left`);
        } else {
          setTimeLeftFormatted(`${mins}m ${secs}s left`);
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [myLocation, isSharing]);

  // 4. Start Live Sharing
  async function startLiveSharing(durationMins: 15 | 60 | 480, senderName: string) {
    if (!("geolocation" in navigator)) {
      toast.error("Geolocation is not supported by your browser.");
      return;
    }

    if (!currentUserId || !requestId) {
      toast.error("Authentication required to share location.");
      return;
    }

    try {
      // Prompt location permission first
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const { latitude, longitude, heading, speed } = pos.coords;
          const expiresAt = new Date(Date.now() + durationMins * 60 * 1000).toISOString();

          // Save to Supabase live_locations
          const { data, error } = await supabase
            .from("live_locations")
            .upsert(
              {
                request_id: requestId,
                user_id: currentUserId,
                latitude,
                longitude,
                heading: heading || null,
                speed: speed || null,
                is_active: true,
                duration_minutes: durationMins,
                expires_at: expiresAt,
                updated_at: new Date().toISOString(),
              },
              { onConflict: "request_id,user_id" },
            )
            .select()
            .single();

          if (error) {
            toast.error("Failed to start live location sharing: " + error.message);
            return;
          }

          setMyLocation(data as LiveLocationData);
          setIsSharing(true);
          setSharingDuration(durationMins);

          // Post chat message announcing live location sharing
          const label =
            durationMins === 15 ? "15 minutes" : durationMins === 60 ? "1 hour" : "8 hours";

          await supabase.from("chat_messages").insert({
            request_id: requestId,
            sender_id: currentUserId,
            sender_name: senderName,
            message: `📍 Started sharing live location (${label})`,
            is_location_message: true,
          });

          toast.success(`Started sharing live location for ${label}.`);

          // Start continuous tracking watcher
          if (watchIdRef.current !== null) {
            navigator.geolocation.clearWatch(watchIdRef.current);
          }

          watchIdRef.current = navigator.geolocation.watchPosition(
            async (watchPos) => {
              const newLat = watchPos.coords.latitude;
              const newLng = watchPos.coords.longitude;

              await supabase.from("live_locations").upsert(
                {
                  request_id: requestId,
                  user_id: currentUserId,
                  latitude: newLat,
                  longitude: newLng,
                  heading: watchPos.coords.heading || null,
                  speed: watchPos.coords.speed || null,
                  is_active: true,
                  updated_at: new Date().toISOString(),
                },
                { onConflict: "request_id,user_id" },
              );
            },
            (err) => console.warn("Geolocation watch warning:", err),
            { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
          );
        },
        (err) => {
          toast.error("Location permission denied: " + err.message);
        },
        { enableHighAccuracy: true, timeout: 10000 },
      );
    } catch (err: any) {
      toast.error(err.message || "Failed to access location");
    }
  }

  // 5. Stop Live Sharing
  async function stopLiveSharing(notifyChat = true) {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    if (expiryTimerRef.current) {
      clearTimeout(expiryTimerRef.current);
      expiryTimerRef.current = null;
    }

    setIsSharing(false);
    setMyLocation(null);

    if (currentUserId && requestId) {
      await supabase
        .from("live_locations")
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq("request_id", requestId)
        .eq("user_id", currentUserId);

      if (notifyChat) {
        await supabase.from("chat_messages").insert({
          request_id: requestId,
          sender_id: currentUserId,
          sender_name: "System",
          message: "🛑 Live location sharing stopped.",
          is_location_message: true,
        });
        toast.info("Stopped live location sharing.");
      }
    }
  }

  // Calculate live distance between me & partner if both exist
  const liveDistanceKm =
    myLocation && partnerLocation
      ? haversineKm(
          { lat: myLocation.latitude, lng: myLocation.longitude },
          { lat: partnerLocation.latitude, lng: partnerLocation.longitude },
        )
      : null;

  return {
    myLocation,
    partnerLocation,
    isSharing,
    sharingDuration,
    timeLeftFormatted,
    liveDistanceKm,
    startLiveSharing,
    stopLiveSharing,
  };
}
