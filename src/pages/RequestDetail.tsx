import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import {
  ArrowLeft,
  Droplet,
  MapPin,
  Clock,
  CheckCircle2,
  MessageCircle,
  Loader2,
  AlertCircle,
  Sparkles,
  ShieldCheck,
  XCircle,
  Heart,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { matchDonorsForRequest, isBloodCompatible, type ScoredDonor } from "@/lib/ml.functions";
import { buildWhatsAppUrl, formatDistance } from "@/lib/distance";
import type { Donor } from "@/lib/donors";
import type { BloodRequest } from "./BloodRequests";
import Navbar from "@/components/Navbar";

export default function RequestDetail() {
  const { id } = useParams<{ id: string }>();
  const [request, setRequest] = useState<BloodRequest | null>(null);
  const [rankedDonors, setRankedDonors] = useState<ScoredDonor[]>([]);
  const [donorProfile, setDonorProfile] = useState<Donor | null>(null);
  const [loading, setLoading] = useState(true);
  const [matchingLoading, setMatchingLoading] = useState(false);
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    document.title = "AI Donor Matches · BloodMap AI";
    if (id) loadData(id);
  }, [id]);

  async function loadData(requestId: string) {
    setLoading(true);
    const { data: u } = await supabase.auth.getUser();
    if (u.user) {
      const { data: dData } = await supabase
        .from("donors")
        .select("*")
        .eq("user_id", u.user.id)
        .maybeSingle();
      if (dData) setDonorProfile(dData as Donor);
    }

    // 1. Fetch request details
    const { data: reqData, error } = await supabase
      .from("blood_requests")
      .select("*")
      .eq("id", requestId)
      .maybeSingle();

    if (error || !reqData) {
      // Try fallback fetch via open requests RPC
      const { data: rpcData } = await supabase.rpc("get_open_blood_requests");
      const found = (rpcData as Partial<BloodRequest>[] | null || []).find((r) => r.id === requestId);

      if (!found) {
        setLoading(false);
        return toast.error("Request not found");
      }

      const req: BloodRequest = {
        id: found.id!,
        user_id: found.user_id || "",
        patient_name: found.patient_name || "Emergency Patient",
        blood_group: found.blood_group || "O+",
        units_needed: found.units_needed || 1,
        urgency: (found.urgency as any) || "normal",
        status: (found.status as any) || "open",
        latitude: found.latitude || 0,
        longitude: found.longitude || 0,
        needed_by: found.needed_by || null,
        reason: found.reason || null,
        notes: found.notes || null,
        created_at: found.created_at || new Date().toISOString(),
      };
      setRequest(req);
      runMatching(req);
    } else {
      const req = reqData as BloodRequest;
      setRequest(req);
      runMatching(req);
    }

    // 2. Fetch past invites/responses for this request
    const { data: respData } = await supabase
      .from("request_responses")
      .select("donor_id")
      .eq("request_id", requestId);

    if (respData) {
      setInvitedIds(new Set(respData.map((r) => r.donor_id)));
    }
  }

  async function runMatching(req: BloodRequest) {
    setLoading(false);
    setMatchingLoading(true);
    const donors = await matchDonorsForRequest({
      requestId: req.id,
      bloodGroup: req.blood_group,
      latitude: req.latitude,
      longitude: req.longitude,
    });
    setRankedDonors(donors);
    setMatchingLoading(false);
  }

  async function updateStatus(newStatus: "matched" | "fulfilled" | "cancelled") {
    if (!request) return;
    const { error } = await supabase
      .from("blood_requests")
      .update({ status: newStatus })
      .eq("id", request.id);

    if (error) return toast.error(error.message);
    toast.success(`Request marked as ${newStatus}`);
    setRequest((prev) => (prev ? { ...prev, status: newStatus } : null));
  }

  async function handleInviteDonor(donor: ScoredDonor) {
    if (!request) return;

    const { error } = await supabase.from("request_responses").insert({
      request_id: request.id,
      request_user_id: request.user_id,
      donor_id: donor.id,
      donor_user_id: donor.user_id,
      status: "invited",
      responded_at: new Date().toISOString(),
    });

    if (error && !error.message.includes("duplicate")) {
      console.error("Error logging request response:", error);
    }

    setInvitedIds((prev) => new Set(prev).add(donor.id));
    toast.success(`Invite sent to ${donor.full_name}!`);

    // Open WhatsApp with pre-filled message
    const msg = `Hello ${donor.full_name},\n\nI urgently need ${request.blood_group} blood (${request.units_needed} units) for ${request.patient_name || "a patient"}.\nLocation: https://www.google.com/maps?q=${request.latitude},${request.longitude}\n\nCan you please confirm if you are available to donate?`;
    window.open(buildWhatsAppUrl(donor.whatsapp_number, msg), "_blank");
  }

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-[var(--gradient-soft)]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!request) {
    return (
      <div className="min-h-screen grid place-items-center bg-[var(--gradient-soft)] text-muted-foreground">
        Blood request not found.
      </div>
    );
  }

  const isDonorMatch =
    donorProfile &&
    request.status === "open" &&
    isBloodCompatible(donorProfile.blood_group, request.blood_group);

  const donateMsg = `Hello,\n\nI saw your blood request on BloodMap AI for ${request.blood_group} blood (${request.units_needed} units).\nI am a compatible registered donor (${donorProfile?.blood_group}) and ready to donate!\n\nPlease contact me to coordinate.`;

  return (
    <div className="min-h-screen bg-[var(--gradient-soft)] flex flex-col">
      {/* Shared Responsive Header */}
      <Navbar />

      <main className="max-w-6xl mx-auto px-4 py-6 sm:py-8 space-y-6 sm:space-y-8 flex-1 w-full">
        {/* Back Link */}
        <div>
          <Button asChild variant="ghost" size="sm">
            <Link to="/requests">
              <ArrowLeft className="w-4 h-4 mr-1" /> Back to requests
            </Link>
          </Button>
        </div>

        {/* Compatible Donor Callout Banner */}
        {isDonorMatch && donorProfile && (
          <div className="glass-card rounded-2xl p-5 border-l-4 border-l-emerald-500 bg-emerald-500/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                <Heart className="w-5 h-5 fill-white" />
              </div>
              <div>
                <h3 className="font-extrabold text-foreground text-base">
                  You are a Compatible Donor Match!
                </h3>
                <p className="text-xs text-muted-foreground">
                  Your blood group ({donorProfile.blood_group}) can be donated for this request ({request.blood_group}).
                </p>
              </div>
            </div>
            <Button
              asChild
              className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-glow shrink-0 w-full sm:w-auto font-bold"
            >
              <a
                href={buildWhatsAppUrl(donorProfile.whatsapp_number, donateMsg)}
                target="_blank"
                rel="noreferrer"
              >
                <MessageCircle className="w-4 h-4 mr-2" /> Offer Donation Now
              </a>
            </Button>
          </div>
        )}

        {/* Request Overview Card */}
        <section className="glass-card rounded-3xl p-5 sm:p-8 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl gradient-hero flex items-center justify-center text-primary-foreground text-2xl sm:text-3xl font-extrabold shadow-glow shrink-0">
                {request.blood_group}
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl sm:text-3xl font-bold">
                    {request.patient_name || "Emergency Patient"}
                  </h1>
                  <span className="px-3 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-red-500/15 text-red-600 border border-red-500/20">
                    {request.urgency} Urgency
                  </span>
                </div>
                <div className="text-xs sm:text-sm text-muted-foreground mt-1 flex flex-wrap items-center gap-2 sm:gap-3">
                  <span>
                    {request.units_needed} {request.units_needed === 1 ? "unit" : "units"} needed
                  </span>
                  <span>•</span>
                  <span>Created {new Date(request.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap items-center gap-2">
              {request.status === "open" && (
                <Button onClick={() => updateStatus("matched")} variant="outline" size="sm">
                  <CheckCircle2 className="w-4 h-4 mr-1 text-blue-600" /> Mark Matched
                </Button>
              )}
              {request.status !== "fulfilled" && (
                <Button onClick={() => updateStatus("fulfilled")} className="shadow-glow" size="sm">
                  <ShieldCheck className="w-4 h-4 mr-1" /> Mark Fulfilled
                </Button>
              )}
              {request.status !== "cancelled" && (
                <Button
                  onClick={() => updateStatus("cancelled")}
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                >
                  <XCircle className="w-4 h-4 mr-1" /> Cancel
                </Button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <div className="rounded-xl bg-muted/40 p-4">
              <div className="text-xs text-muted-foreground uppercase font-semibold">Location</div>
              <div className="font-medium mt-1 flex items-center gap-1">
                <MapPin className="w-4 h-4 text-primary shrink-0" />
                {request.latitude.toFixed(4)}, {request.longitude.toFixed(4)}
              </div>
            </div>

            <div className="rounded-xl bg-muted/40 p-4">
              <div className="text-xs text-muted-foreground uppercase font-semibold">Needed By</div>
              <div className="font-medium mt-1 flex items-center gap-1">
                <Clock className="w-4 h-4 text-primary shrink-0" />
                {request.needed_by ? new Date(request.needed_by).toLocaleString() : "ASAP"}
              </div>
            </div>

            <div className="rounded-xl bg-muted/40 p-4">
              <div className="text-xs text-muted-foreground uppercase font-semibold">Status</div>
              <div className="font-medium mt-1 uppercase text-primary font-bold">
                {request.status}
              </div>
            </div>
          </div>

          {request.reason && (
            <div className="rounded-xl bg-primary/5 border border-primary/15 p-4 text-sm">
              <span className="font-semibold text-primary">Notes: </span>
              {request.reason}
            </div>
          )}
        </section>

        {/* AI-Ranked Donor Matches */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-primary animate-pulse shrink-0" />
              <h2 className="text-xl sm:text-2xl font-bold">AI-Ranked Donor Matches</h2>
            </div>
            <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full w-fit">
              {rankedDonors.length} donors evaluated
            </span>
          </div>

          {matchingLoading ? (
            <div className="glass-card rounded-2xl p-12 text-center text-muted-foreground flex flex-col items-center justify-center space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm">Analyzing compatibility matrix, distance decay, and response probabilities…</p>
            </div>
          ) : rankedDonors.length === 0 ? (
            <div className="glass-card rounded-2xl p-10 text-center text-muted-foreground space-y-2">
              <AlertCircle className="w-8 h-8 text-primary/40 mx-auto" />
              <p>No available compatible donors found within search radius.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {rankedDonors.map((donor, idx) => (
                <DonorMatchCard
                  key={donor.id}
                  donor={donor}
                  rank={idx + 1}
                  isInvited={invitedIds.has(donor.id)}
                  onInvite={() => handleInviteDonor(donor)}
                />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function DonorMatchCard({
  donor,
  rank,
  isInvited,
  onInvite,
}: {
  donor: ScoredDonor;
  rank: number;
  isInvited: boolean;
  onInvite: () => void;
}) {
  return (
    <div className="glass-card rounded-2xl p-5 hover:shadow-glow transition-all flex flex-col justify-between space-y-4 relative overflow-hidden border border-white/20">
      {rank <= 3 && (
        <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-[10px] uppercase tracking-wider font-extrabold px-3 py-1 rounded-bl-xl shadow-glow">
          Top #{rank} Match
        </div>
      )}

      <div>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-lg sm:text-xl font-bold">{donor.full_name}</span>
              <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold text-xs">
                {donor.blood_group}
              </span>
            </div>
            <div className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              {formatDistance(donor.distanceKm)} away
            </div>
          </div>

          <div className="text-right shrink-0">
            <div className="text-xl sm:text-2xl font-extrabold text-primary font-mono">
              {donor.matchScore}%
            </div>
            <div className="text-[10px] uppercase text-muted-foreground tracking-wider font-semibold">
              Match Score
            </div>
          </div>
        </div>

        {/* AI Reasons */}
        <div className="mt-4 flex flex-wrap gap-1.5">
          {donor.reasons.map((r, i) => (
            <span
              key={i}
              className="px-2.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-700 text-xs font-medium border border-emerald-500/20"
            >
              ✓ {r}
            </span>
          ))}
        </div>

        <div className="mt-3 text-xs text-muted-foreground space-y-0.5">
          <div>Available Days: {(donor.available_days || []).join(", ") || "All"}</div>
          <div>
            Available Hours: {donor.start_time || "09:00"} – {donor.end_time || "18:00"}
          </div>
        </div>
      </div>

      <div className="pt-3 border-t flex gap-2">
        <Button
          onClick={onInvite}
          variant={isInvited ? "outline" : "default"}
          className={`w-full ${!isInvited ? "shadow-glow" : ""}`}
          size="sm"
        >
          <MessageCircle className="w-4 h-4 mr-2" />
          {isInvited ? "Re-invite on WhatsApp" : "Invite via WhatsApp"}
        </Button>
      </div>
    </div>
  );
}
