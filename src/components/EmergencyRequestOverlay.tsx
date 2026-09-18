import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  MapPin,
  Droplet,
  Phone,
  ArrowRight,
  ShieldAlert,
  Loader2,
  Building2,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { haversineKm, formatDistance } from "@/lib/distance";
import type { BloodRequest } from "@/pages/BloodRequests";

interface EmergencyRequestOverlayProps {
  request: BloodRequest;
  donorCoords?: { lat: number; lng: number } | null;
  onClose?: () => void;
  onResponded?: (status: "accepted" | "declined") => void;
}

export default function EmergencyRequestOverlay({
  request,
  donorCoords,
  onClose,
  onResponded,
}: EmergencyRequestOverlayProps) {
  const [loading, setLoading] = useState(false);
  const [responseState, setResponseState] = useState<"pending" | "accepted" | "declined">(
    "pending",
  );
  const [requesterContact, setRequesterContact] = useState<{
    full_name: string;
    phone: string;
  } | null>(null);

  // Compute distance if donor location is available
  const distanceKm = donorCoords
    ? haversineKm(
        { lat: donorCoords.lat, lng: donorCoords.lng },
        { lat: request.latitude, lng: request.longitude },
      )
    : null;

  // Check if donor already responded
  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;

      const { data: resp } = await supabase
        .from("request_responses")
        .select("status")
        .eq("request_id", request.id)
        .eq("donor_user_id", u.user.id)
        .maybeSingle();

      if (resp?.status === "accepted") {
        setResponseState("accepted");
        fetchRequesterContact(request.user_id);
      } else if (resp?.status === "declined") {
        setResponseState("declined");
      }
    })();
  }, [request.id, request.user_id]);

  async function fetchRequesterContact(userId: string) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, phone")
      .eq("id", userId)
      .maybeSingle();

    if (profile) {
      setRequesterContact({
        full_name: profile.full_name || "Blood Requester",
        phone: profile.phone || "No phone provided",
      });
    }
  }

  async function handleResponse(action: "accepted" | "declined") {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("respond_to_emergency_request", {
        p_request_id: request.id,
        p_status: action,
      });

      if (error) {
        // Fallback row update if RPC fails
        const { data: u } = await supabase.auth.getUser();
        if (u.user) {
          const { data: donor } = await supabase
            .from("donors")
            .select("id")
            .eq("user_id", u.user.id)
            .single();

          if (donor) {
            await supabase.from("request_responses").upsert(
              {
                request_id: request.id,
                request_user_id: request.user_id,
                donor_id: donor.id,
                donor_user_id: u.user.id,
                status: action,
                responded_at: new Date().toISOString(),
              },
              { onConflict: "request_id,donor_id" },
            );

            if (action === "accepted") {
              await supabase
                .from("blood_requests")
                .update({ status: "matched" })
                .eq("id", request.id);
            }
          }
        }
      }

      setLoading(false);
      setResponseState(action);

      if (action === "accepted") {
        toast.success("Thank you! You have accepted this emergency blood request.", {
          description: "Live connection established. Requester has been notified.",
        });
        await fetchRequesterContact(request.user_id);
      } else {
        toast.info("Request declined. Continuing search for other matching donors.");
        if (onClose) onClose();
      }

      if (onResponded) onResponded(action);
    } catch (err: any) {
      setLoading(false);
      toast.error(err.message || "Failed to update response state");
    }
  }

  if (responseState === "declined") return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md overflow-hidden rounded-3xl bg-card border border-red-500/30 shadow-2xl transition-all">
        {/* Top Header Banner */}
        <div className="relative bg-gradient-to-r from-red-600 via-rose-600 to-red-700 px-6 py-4 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
              </span>
              <span className="text-xs font-black tracking-wider uppercase bg-white/20 backdrop-blur-sm px-2.5 py-0.5 rounded-full">
                EMERGENCY ALERT
              </span>
            </div>
            {onClose && (
              <button
                onClick={onClose}
                className="text-white/80 hover:text-white transition-colors p-1 rounded-full hover:bg-white/10"
              >
                <XCircle className="w-5 h-5" />
              </button>
            )}
          </div>

          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black tracking-tight">
              🩸 {request.blood_group} Emergency Request
            </span>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4">
          {/* Key Quick Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-accent/50 p-3.5 border border-border/50">
              <span className="text-xs font-semibold text-muted-foreground block">
                Required Units
              </span>
              <span className="text-lg font-extrabold text-foreground flex items-center gap-1.5 mt-0.5">
                <Droplet className="w-4 h-4 text-red-500 fill-red-500" />
                {request.units_needed} {request.units_needed > 1 ? "Units" : "Unit"}
              </span>
            </div>

            <div className="rounded-2xl bg-accent/50 p-3.5 border border-border/50">
              <span className="text-xs font-semibold text-muted-foreground block">Distance</span>
              <span className="text-lg font-extrabold text-foreground flex items-center gap-1.5 mt-0.5">
                <MapPin className="w-4 h-4 text-rose-500" />
                {distanceKm !== null ? `${distanceKm.toFixed(1)} km away` : "Nearby"}
              </span>
            </div>
          </div>

          {/* Hospital / Patient Details */}
          <div className="rounded-2xl bg-background p-4 border border-border/80 space-y-2.5">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 mt-0.5">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-medium text-muted-foreground block">
                  Patient / Location
                </span>
                <p className="text-sm font-bold text-foreground">
                  {request.patient_name || "Emergency Patient"}
                </p>
                {request.reason && (
                  <p className="text-xs text-muted-foreground mt-0.5">{request.reason}</p>
                )}
              </div>
            </div>

            {request.needed_by && (
              <div className="text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 px-3 py-1.5 rounded-xl font-medium flex items-center gap-2">
                <ShieldAlert className="w-4 h-4" />
                Needed by: {new Date(request.needed_by).toLocaleString()}
              </div>
            )}
          </div>

          {/* State 1: PENDING ACCEPT / DECLINE ACTIONS */}
          {responseState === "pending" && (
            <div className="pt-2 flex items-center gap-3">
              <Button
                variant="outline"
                size="lg"
                disabled={loading}
                onClick={() => handleResponse("declined")}
                className="flex-1 rounded-2xl h-12 border-red-500/30 hover:bg-red-500/10 text-red-600 dark:text-red-400 font-bold"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "DECLINE"}
              </Button>

              <Button
                size="lg"
                disabled={loading}
                onClick={() => handleResponse("accepted")}
                className="flex-1 rounded-2xl h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-black shadow-lg shadow-emerald-600/30 gap-2"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5" /> ACCEPT
                  </>
                )}
              </Button>
            </div>
          )}

          {/* State 2: ACCEPTED / LIVE CONNECTION ESTABLISHED */}
          {responseState === "accepted" && (
            <div className="pt-2 space-y-3 animate-in slide-in-from-bottom-2 duration-300">
              <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/30 p-4 text-center">
                <div className="inline-flex items-center justify-center p-2 rounded-full bg-emerald-500 text-white mb-2 shadow-md shadow-emerald-500/30">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h4 className="text-base font-extrabold text-emerald-700 dark:text-emerald-400">
                  You Have Accepted This Emergency Request!
                </h4>
                <p className="text-xs text-muted-foreground mt-1">
                  Live connection active inside BloodMap AI. Requester sees you as Accepted.
                </p>
              </div>

              {/* Direct Requester Contact Card */}
              {requesterContact && (
                <div className="rounded-2xl bg-accent/40 p-4 border border-border flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-full bg-red-600/10 text-red-600">
                      <User className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-muted-foreground">
                        Requester Contact
                      </span>
                      <p className="text-sm font-bold text-foreground">
                        {requesterContact.full_name}
                      </p>
                      <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                        Status: Connected & Ready
                      </p>
                    </div>
                  </div>

                  {requesterContact.phone && (
                    <a
                      href={`tel:${requesterContact.phone}`}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md transition-all"
                    >
                      <Phone className="w-3.5 h-3.5" /> Call
                    </a>
                  )}
                </div>
              )}

              <Button
                asChild
                className="w-full rounded-2xl h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-bold gap-2"
              >
                <Link to={`/requests/${request.id}`}>
                  View Full Request Details <ArrowRight className="w-4 h-4" />
                </Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
