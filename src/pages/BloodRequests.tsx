import { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Droplet,
  Plus,
  MapPin,
  Calendar,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  Clock,
  Search,
  Filter,
  MessageCircle,
  Heart,
  UserCheck,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BLOOD_GROUPS, type Donor } from "@/lib/donors";
import { isBloodCompatible } from "@/lib/ml.functions";
import { buildWhatsAppUrl } from "@/lib/distance";
import Navbar from "@/components/Navbar";

export interface BloodRequest {
  id: string;
  user_id: string;
  patient_name: string | null;
  blood_group: string;
  units_needed: number;
  urgency: "low" | "normal" | "high" | "critical";
  status: "open" | "matched" | "fulfilled" | "cancelled" | "expired";
  latitude: number;
  longitude: number;
  needed_by: string | null;
  reason: string | null;
  notes: string | null;
  created_at: string;
}

export default function BloodRequests() {
  const navigate = useNavigate();
  const [requests, setRequests] = useState<BloodRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [donorProfile, setDonorProfile] = useState<Donor | null>(null);
  const [filterTab, setFilterTab] = useState<"all" | "matching" | "mine">("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [query, setQuery] = useState("");

  // Create request modal state
  const [openModal, setOpenModal] = useState(false);
  const [patientName, setPatientName] = useState("");
  const [bloodGroup, setBloodGroup] = useState("O+");
  const [units, setUnits] = useState(1);
  const [urgency, setUrgency] = useState<"low" | "normal" | "high" | "critical">("normal");
  const [neededBy, setNeededBy] = useState("");
  const [reason, setReason] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locLoading, setLocLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    document.title = "Blood Requests · BloodMap AI";
    fetchUserAndRequests();
  }, []);

  async function fetchUserAndRequests() {
    setLoading(true);
    const { data: u } = await supabase.auth.getUser();
    if (u.user) {
      setCurrentUserId(u.user.id);
      // Fetch donor profile if user is a registered donor
      const { data: dData } = await supabase
        .from("donors")
        .select("*")
        .eq("user_id", u.user.id)
        .maybeSingle();
      if (dData) {
        setDonorProfile(dData as Donor);
      }
    }

    // Fetch own requests
    const { data: ownData } = await supabase
      .from("blood_requests")
      .select("*")
      .order("created_at", { ascending: false });

    // Fetch all open requests via Security Definer RPC
    const { data: openRpcData } = await supabase.rpc("get_open_blood_requests");

    const reqMap = new Map<string, BloodRequest>();

    (openRpcData as Partial<BloodRequest>[] | null || []).forEach((r) => {
      if (r.id) {
        reqMap.set(r.id, {
          id: r.id,
          user_id: r.user_id || "",
          patient_name: r.patient_name || "Emergency Patient",
          blood_group: r.blood_group || "O+",
          units_needed: r.units_needed || 1,
          urgency: (r.urgency as any) || "normal",
          status: (r.status as any) || "open",
          latitude: r.latitude || 0,
          longitude: r.longitude || 0,
          needed_by: r.needed_by || null,
          reason: r.reason || null,
          notes: r.notes || null,
          created_at: r.created_at || new Date().toISOString(),
        });
      }
    });

    (ownData as BloodRequest[] | null || []).forEach((r) => {
      reqMap.set(r.id, r);
    });

    const merged = Array.from(reqMap.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    setRequests(merged);
    setLoading(false);
  }

  function captureLocation() {
    if (!("geolocation" in navigator)) return toast.error("Geolocation not supported");
    setLocLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocLoading(false);
        toast.success("Location captured");
      },
      (err) => {
        setLocLoading(false);
        toast.error(err.message || "Location denied");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  async function handleCreateRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!coords) return toast.error("Capture GPS location for request");
    setSubmitting(true);

    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return setSubmitting(false);

    const { data, error } = await supabase
      .from("blood_requests")
      .insert({
        user_id: u.user.id,
        patient_name: patientName || "Emergency Patient",
        blood_group: bloodGroup,
        units_needed: units,
        urgency,
        latitude: coords.lat,
        longitude: coords.lng,
        needed_by: neededBy ? new Date(neededBy).toISOString() : null,
        reason: reason || null,
        status: "open",
      })
      .select()
      .single();

    setSubmitting(false);
    if (error) return toast.error(error.message);

    toast.success("Blood request created! Finding matches…");
    setOpenModal(false);
    navigate(`/requests/${data.id}`);
  }

  // Filter logic
  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      // Status filter
      if (filterStatus !== "all" && r.status !== filterStatus) return false;

      // Tab filter
      if (filterTab === "mine") {
        if (r.user_id !== currentUserId) return false;
      } else if (filterTab === "matching") {
        if (!donorProfile) return false;
        // Donor can donate if donor's blood group can be given to recipient group r.blood_group
        const canDonate = isBloodCompatible(donorProfile.blood_group, r.blood_group);
        if (!canDonate || r.status !== "open") return false;
      }

      // Search query filter
      if (query.trim()) {
        const q = query.toLowerCase();
        const matchName = r.patient_name?.toLowerCase().includes(q);
        const matchGroup = r.blood_group.toLowerCase().includes(q);
        const matchReason = r.reason?.toLowerCase().includes(q);
        if (!matchName && !matchGroup && !matchReason) return false;
      }
      return true;
    });
  }, [requests, filterStatus, filterTab, query, currentUserId, donorProfile]);

  const matchingCount = useMemo(() => {
    if (!donorProfile) return 0;
    return requests.filter(
      (r) => r.status === "open" && isBloodCompatible(donorProfile.blood_group, r.blood_group)
    ).length;
  }, [requests, donorProfile]);

  return (
    <div className="min-h-screen bg-[var(--gradient-soft)] flex flex-col">
      {/* Shared Responsive Header */}
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6 flex-1 w-full">
        {/* Banner for Donors */}
        {donorProfile && matchingCount > 0 && (
          <div className="glass-card rounded-2xl p-4 md:p-5 border-l-4 border-l-emerald-500 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-emerald-500/5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-600 flex items-center justify-center shrink-0">
                <Heart className="w-5 h-5 fill-emerald-600" />
              </div>
              <div>
                <h3 className="font-bold text-foreground text-base">
                  You match {matchingCount} urgent blood {matchingCount === 1 ? "request" : "requests"}!
                </h3>
                <p className="text-xs text-muted-foreground">
                  Your blood group <span className="font-bold text-foreground">{donorProfile.blood_group}</span> can save lives. View requests you can donate to below.
                </p>
              </div>
            </div>
            <Button
              onClick={() => setFilterTab("matching")}
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-glow shrink-0 w-full sm:w-auto"
            >
              View Matching Requests ({matchingCount})
            </Button>
          </div>
        )}

        {/* Page Title & Create Button Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold flex items-center gap-2">
              <Droplet className="w-7 h-7 text-primary fill-primary" /> Emergency Blood Requests
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Connect blood seekers directly with compatible donors in real-time.
            </p>
          </div>

          <Button
            onClick={() => setOpenModal(true)}
            size="lg"
            className="shadow-glow w-full sm:w-auto shrink-0 font-bold"
          >
            <Plus className="w-5 h-5 mr-1.5" /> Request Blood Now
          </Button>
        </div>

        {/* Search & Filter Control Bar */}
        <section className="glass-card rounded-2xl p-4 space-y-4">
          {/* Tabs */}
          <div className="flex flex-wrap items-center gap-2 border-b pb-3">
            <button
              onClick={() => setFilterTab("all")}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition ${
                filterTab === "all"
                  ? "bg-primary text-primary-foreground shadow-glow"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted"
              }`}
            >
              All Requests ({requests.length})
            </button>

            {donorProfile && (
              <button
                onClick={() => setFilterTab("matching")}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition flex items-center gap-1.5 ${
                  filterTab === "matching"
                    ? "bg-emerald-600 text-white shadow-glow"
                    : "bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20"
                }`}
              >
                <Heart className="w-3.5 h-3.5 fill-current" />
                Matching My Blood Group ({matchingCount})
              </button>
            )}

            {currentUserId && (
              <button
                onClick={() => setFilterTab("mine")}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition ${
                  filterTab === "mine"
                    ? "bg-primary text-primary-foreground shadow-glow"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted"
                }`}
              >
                My Requests
              </button>
            )}
          </div>

          {/* Search bar & Dropdowns */}
          <div className="flex flex-col sm:flex-row gap-3 items-center">
            <div className="flex-1 relative w-full">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search by patient, blood group (e.g. O+), or reason"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Filter className="w-4 h-4 text-muted-foreground shrink-0" />
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-full sm:w-[150px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="matched">Matched</SelectItem>
                  <SelectItem value="fulfilled">Fulfilled</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </section>

        {/* Requests Grid */}
        <section>
          {loading ? (
            <div className="grid place-items-center py-16 text-muted-foreground">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="glass-card rounded-2xl p-12 text-center text-muted-foreground space-y-4">
              <Droplet className="w-12 h-12 text-primary/30 mx-auto" />
              <h3 className="text-xl font-semibold text-foreground">No blood requests found</h3>
              <p className="text-sm max-w-sm mx-auto">
                {filterTab === "matching"
                  ? "No open blood requests currently match your blood group."
                  : "Need urgent blood for yourself or a family member? Create a request to match with live donors."}
              </p>
              <Button onClick={() => setOpenModal(true)} className="shadow-glow">
                <Plus className="w-4 h-4 mr-2" /> Create Request Now
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredRequests.map((req) => (
                <RequestCard
                  key={req.id}
                  request={req}
                  donorProfile={donorProfile}
                  isOwner={req.user_id === currentUserId}
                />
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Create Request Modal */}
      {openModal && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl bg-background p-6 shadow-2xl space-y-5 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="text-xl font-bold flex items-center gap-2 text-primary">
                <Droplet className="w-6 h-6 fill-primary" /> Create Emergency Blood Request
              </h2>
              <button
                type="button"
                onClick={() => setOpenModal(false)}
                className="text-muted-foreground hover:text-foreground text-sm font-semibold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateRequest} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="pt-name">Patient Full Name</Label>
                <Input
                  id="pt-name"
                  placeholder="e.g. John Doe"
                  required
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Required Blood Group</Label>
                  <Select value={bloodGroup} onValueChange={setBloodGroup}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BLOOD_GROUPS.map((g) => (
                        <SelectItem key={g} value={g}>
                          {g}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="units">Units Needed</Label>
                  <Input
                    id="units"
                    type="number"
                    min={1}
                    max={20}
                    required
                    value={units}
                    onChange={(e) => setUnits(parseInt(e.target.value) || 1)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Urgency Level</Label>
                  <Select
                    value={urgency}
                    onValueChange={(v) => setUrgency(v as "low" | "normal" | "high" | "critical")}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low (Routine)</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="high">High (Urgent)</SelectItem>
                      <SelectItem value="critical">Critical (Immediate)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="needed-by">Needed By Date</Label>
                  <Input
                    id="needed-by"
                    type="datetime-local"
                    value={neededBy}
                    onChange={(e) => setNeededBy(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Location GPS</Label>
                <button
                  type="button"
                  onClick={captureLocation}
                  className="w-full rounded-xl border border-dashed border-primary/40 bg-primary/5 p-3 flex items-center justify-between hover:bg-primary/10 transition"
                >
                  <div className="flex items-center gap-3">
                    <MapPin className="w-5 h-5 text-primary" />
                    <span className="text-sm font-medium">
                      {coords
                        ? `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`
                        : "Tap to set GPS location"}
                    </span>
                  </div>
                  {locLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  ) : coords ? (
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                  ) : null}
                </button>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reason">Reason / Medical Notes (Optional)</Label>
                <Input
                  id="reason"
                  placeholder="e.g. Surgery at St. Jude Hospital"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setOpenModal(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting} className="flex-1 shadow-glow">
                  {submitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  Submit & Match Donors
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function RequestCard({
  request,
  donorProfile,
  isOwner,
}: {
  request: BloodRequest;
  donorProfile: Donor | null;
  isOwner: boolean;
}) {
  const isCompatibleDonor =
    donorProfile &&
    request.status === "open" &&
    isBloodCompatible(donorProfile.blood_group, request.blood_group);

  const urgencyColors = {
    critical: "bg-red-600 text-white font-bold animate-pulse",
    high: "bg-orange-500 text-white font-semibold",
    normal: "bg-blue-500 text-white",
    low: "bg-gray-400 text-white",
  };

  const statusColors = {
    open: "border-emerald-500 text-emerald-600 bg-emerald-50",
    matched: "border-blue-500 text-blue-600 bg-blue-50",
    fulfilled: "border-purple-500 text-purple-600 bg-purple-50",
    cancelled: "border-gray-400 text-gray-500 bg-gray-50",
    expired: "border-red-400 text-red-500 bg-red-50",
  };

  const donateMsg = `Hello,\n\nI saw your blood request on BloodMap AI for ${request.blood_group} blood (${request.units_needed} units).\nI am a compatible registered donor (${donorProfile?.blood_group}) and ready to donate!\n\nPlease contact me to coordinate.`;

  return (
    <div className="glass-card rounded-2xl p-5 hover:shadow-glow transition-all flex flex-col justify-between space-y-4 relative border border-white/20">
      {/* Donor compatibility badge */}
      {isCompatibleDonor && (
        <div className="bg-emerald-600 text-white text-[11px] font-bold px-3 py-1 rounded-full flex items-center gap-1.5 w-fit shadow-sm">
          <CheckCircle2 className="w-3.5 h-3.5" /> Compatible Donor Match - You Can Donate!
        </div>
      )}

      <div>
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="font-bold text-lg">{request.patient_name || "Emergency Patient"}</div>
            <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
              <Clock className="w-3 h-3" />
              Created {new Date(request.created_at).toLocaleDateString()}
              {isOwner && <span className="ml-1 text-primary font-semibold">(Your Request)</span>}
            </div>
          </div>

          <span className="px-3 py-1 rounded-full bg-primary text-primary-foreground font-bold text-base shadow-glow shrink-0">
            {request.blood_group}
          </span>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <span
            className={`px-2.5 py-0.5 rounded-full text-xs uppercase tracking-wide ${urgencyColors[request.urgency]}`}
          >
            {request.urgency} urgency
          </span>
          <span
            className={`px-2.5 py-0.5 rounded-full text-xs uppercase tracking-wide border ${statusColors[request.status]}`}
          >
            {request.status}
          </span>
          <span className="px-2.5 py-0.5 rounded-full text-xs bg-muted text-muted-foreground font-medium">
            {request.units_needed} {request.units_needed === 1 ? "unit" : "units"}
          </span>
        </div>

        {request.reason && (
          <p className="mt-3 text-sm text-muted-foreground line-clamp-2">{request.reason}</p>
        )}
      </div>

      <div className="pt-3 border-t flex flex-col gap-2">
        <div className="text-xs text-muted-foreground flex items-center justify-between">
          <span className="flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5 text-primary" />
            {request.latitude.toFixed(2)}, {request.longitude.toFixed(2)}
          </span>
        </div>

        <div className="flex gap-2 pt-1">
          <Button asChild variant="outline" size="sm" className="flex-1">
            <Link to={`/requests/${request.id}`}>View Details & Matches</Link>
          </Button>

          {isCompatibleDonor && donorProfile && (
            <Button asChild size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-glow">
              <a
                href={buildWhatsAppUrl(donorProfile.whatsapp_number, donateMsg)}
                target="_blank"
                rel="noreferrer"
              >
                <MessageCircle className="w-4 h-4 mr-1" /> Offer Donation
              </a>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
