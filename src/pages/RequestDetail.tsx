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
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { matchDonorsForRequest, type ScoredDonor } from "@/lib/ml.functions";
import { buildWhatsAppUrl, formatDistance } from "@/lib/distance";
import type { BloodRequest } from "./BloodRequests";

export default function RequestDetail() {
  const { id } = useParams<{ id: string }>();
  const [request, setRequest] = useState<BloodRequest | null>(null);
  const [rankedDonors, setRankedDonors] = useState<ScoredDonor[]>([]);
  const [loading, setLoading] = useState(true);
  const [matchingLoading, setMatchingLoading] = useState(false);
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    document.title = "AI Donor Matches · BloodMap AI";
    if (id) loadData(id);
  }, [id]);

  async function loadData(requestId: string) {
    setLoading(true);
    // 1. Fetch request details
    const { data: reqData, error } = await supabase
      .from("blood_requests")
      .select("*")
      .eq("id", requestId)
      .single();

    if (error || !reqData) {
      setLoading(false);
      return toast.error("Request not found");
    }

    const req = reqData as BloodRequest;
    setRequest(req);

    // 2. Fetch past invites/responses for this request
    const { data: respData } = await supabase
      .from("request_responses")
      .select("donor_id")
      .eq("request_id", requestId);

    if (respData) {
      setInvitedIds(new Set(respData.map((r) => r.donor_id)));
    }

    setLoading(false);

    // 3. Match donors using ML / Fallback engine
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

    // Log invite response in database for MLOps response-rate tracking
    const { error } = await supabase.from("request_responses").insert({
      request_id: request.id,
      donor_id: donor.id,
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

  return (
    <div className="min-h-screen bg-[var(--gradient-soft)]">
      {/* Header */}
      <header className="sticky top-0 z-20 glass-card rounded-none border-x-0 border-t-0">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Button asChild variant="ghost" size="sm">
            <Link to="/requests">
              <ArrowLeft className="w-4 h-4 mr-1" /> Back to requests
            </Link>
          </Button>
          <div className="flex items-center gap-2 font-bold text-primary">
            <Droplet className="w-5 h-5 fill-primary" /> BloodMap AI
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        {/* Request Overview Card */}
        <section className="glass-card rounded-3xl p-6 md:p-8 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6">
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-2xl gradient-hero flex items-center justify-center text-primary-foreground text-3xl font-extrabold shadow-glow shrink-0">
                {request.blood_group}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl md:text-3xl font-bold">
                    {request.patient_name || "Emergency Patient"}
                  </h1>
                  <span className="px-3 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-red-500/15 text-red-600 border border-red-500/20">
                    {request.urgency} Urgency
                  </span>
                </div>
                <div className="text-sm text-muted-foreground mt-1 flex items-center gap-3">
                  <span>{request.units_needed} {request.units_needed === 1 ? "unit" : "units"} needed</span>
                  <span>•</span>
                  <span>Created {new Date(request.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2">
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
                <Button onClick={() => updateStatus("cancelled")} variant="ghost" size="sm" className="text-destructive">
                  <XCircle className="w-4 h-4 mr-1" /> Cancel
                </Button>
              )}
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-4 text-sm">
            <div className="rounded-xl bg-muted/40 p-4">
              <div className="text-xs text-muted-foreground uppercase font-semibold">Location</div>
              <div className="font-medium mt-1 flex items-center gap-1">
                <MapPin className="w-4 h-4 text-primary" />
                {request.latitude.toFixed(4)}, {request.longitude.toFixed(4)}
              </div>
            </div>

            <div className="rounded-xl bg-muted/40 p-4">
              <div className="text-xs text-muted-foreground uppercase font-semibold">Needed By</div>
              <div className="font-medium mt-1 flex items-center gap-1">
                <Clock className="w-4 h-4 text-primary" />
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
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-primary animate-pulse" />
              <h2 className="text-2xl font-bold">AI-Ranked Donor Matches</h2>
            </div>
            <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">
              {rankedDonors.length} donors evaluated
            </span>
          </div>

          {matchingLoading ? (
            <div className="glass-card rounded-2xl p-12 text-center text-muted-foreground flex flex-col items-center justify-center space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p>Analyzing compatibility matrix, distance decay, and response probabilities…</p>
            </div>
          ) : rankedDonors.length === 0 ? (
            <div className="glass-card rounded-2xl p-10 text-center text-muted-foreground space-y-2">
              <AlertCircle className="w-8 h-8 text-primary/40 mx-auto" />
              <p>No available compatible donors found within search radius.</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
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
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold">{donor.full_name}</span>
              <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold text-xs">
                {donor.blood_group}
              </span>
            </div>
            <div className="text-sm text-muted-foreground mt-0.5">
              {formatDistance(donor.distanceKm)} away
            </div>
          </div>

          <div className="text-right">
            <div className="text-2xl font-extrabold text-primary font-mono">
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
          <div>Available Hours: {donor.start_time || "09:00"} – {donor.end_time || "18:00"}</div>
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
