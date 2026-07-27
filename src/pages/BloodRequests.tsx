import { useState, useEffect } from "react";
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
  ArrowLeft,
  Search,
  Filter,
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
import { BLOOD_GROUPS } from "@/lib/donors";

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
    fetchRequests();
  }, []);

  async function fetchRequests() {
    setLoading(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return setLoading(false);

    const { data, error } = await supabase
      .from("blood_requests")
      .select("*")
      .order("created_at", { ascending: false });

    setLoading(false);
    if (error) return toast.error(error.message);
    setRequests((data as BloodRequest[]) || []);
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

  const filteredRequests = requests.filter((r) => {
    if (filterStatus !== "all" && r.status !== filterStatus) return false;
    if (query.trim()) {
      const q = query.toLowerCase();
      const matchName = r.patient_name?.toLowerCase().includes(q);
      const matchGroup = r.blood_group.toLowerCase().includes(q);
      const matchReason = r.reason?.toLowerCase().includes(q);
      if (!matchName && !matchGroup && !matchReason) return false;
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-[var(--gradient-soft)]">
      {/* Header */}
      <header className="sticky top-0 z-30 glass-card rounded-none border-x-0 border-t-0">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3 font-bold text-primary">
            <Button asChild variant="ghost" size="sm">
              <Link to="/home">
                <ArrowLeft className="w-4 h-4 mr-1" /> Home
              </Link>
            </Button>
            <div className="flex items-center gap-2">
              <Droplet className="w-5 h-5 fill-primary" />
              <span className="text-lg">Blood Requests</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/forecast">Demand Forecast</Link>
            </Button>
            <Button onClick={() => setOpenModal(true)} className="shadow-glow" size="sm">
              <Plus className="w-4 h-4 mr-1" /> Request Blood
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Search & Filter Bar */}
        <section className="glass-card rounded-2xl p-4 flex flex-col md:flex-row gap-3 items-center justify-between">
          <div className="flex-1 relative w-full">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search by patient name, blood group, or reason"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full md:w-[150px]">
                <SelectValue />
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
        </section>

        {/* Requests List */}
        <section>
          {loading ? (
            <div className="grid place-items-center py-16 text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="glass-card rounded-2xl p-12 text-center text-muted-foreground space-y-4">
              <Droplet className="w-12 h-12 text-primary/30 mx-auto" />
              <h3 className="text-xl font-semibold text-foreground">No blood requests found</h3>
              <p className="text-sm max-w-sm mx-auto">
                Need urgent blood for yourself or a family member? Create a request to match with live donors.
              </p>
              <Button onClick={() => setOpenModal(true)} className="shadow-glow">
                <Plus className="w-4 h-4 mr-2" /> Create Request Now
              </Button>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredRequests.map((req) => (
                <RequestCard key={req.id} request={req} />
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Create Request Modal */}
      {openModal && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl bg-background p-6 shadow-2xl space-y-5 my-8">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="text-xl font-bold flex items-center gap-2 text-primary">
                <Droplet className="w-6 h-6 fill-primary" /> Create Emergency Blood Request
              </h2>
              <button
                type="button"
                onClick={() => setOpenModal(false)}
                className="text-muted-foreground hover:text-foreground text-sm font-semibold"
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

              <div className="grid grid-cols-2 gap-3">
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

              <div className="grid grid-cols-2 gap-3">
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

function RequestCard({ request }: { request: BloodRequest }) {
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

  return (
    <div className="glass-card rounded-2xl p-5 hover:shadow-glow transition-all flex flex-col justify-between space-y-4">
      <div>
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="font-bold text-lg">{request.patient_name || "Emergency Patient"}</div>
            <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
              <Clock className="w-3 h-3" />
              Created {new Date(request.created_at).toLocaleDateString()}
            </div>
          </div>

          <span className="px-3 py-1 rounded-full bg-primary text-primary-foreground font-bold text-base shadow-glow">
            {request.blood_group}
          </span>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <span className={`px-2.5 py-0.5 rounded-full text-xs uppercase tracking-wide ${urgencyColors[request.urgency]}`}>
            {request.urgency} urgency
          </span>
          <span className={`px-2.5 py-0.5 rounded-full text-xs uppercase tracking-wide border ${statusColors[request.status]}`}>
            {request.status}
          </span>
          <span className="px-2.5 py-0.5 rounded-full text-xs bg-muted text-muted-foreground font-medium">
            {request.units_needed} {request.units_needed === 1 ? "unit" : "units"}
          </span>
        </div>

        {request.reason && (
          <p className="mt-3 text-sm text-muted-foreground line-clamp-2">
            {request.reason}
          </p>
        )}
      </div>

      <div className="pt-2 border-t flex items-center justify-between">
        <div className="text-xs text-muted-foreground flex items-center gap-1">
          <MapPin className="w-3 h-3 text-primary" />
          {request.latitude.toFixed(2)}, {request.longitude.toFixed(2)}
        </div>

        <Button asChild size="sm">
          <Link to={`/requests/${request.id}`}>
            Find Donors →
          </Link>
        </Button>
      </div>
    </div>
  );
}
