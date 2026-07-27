import { Link, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState, lazy, Suspense } from "react";
import {
  Droplet,
  Search,
  MapPin,
  MessageCircle,
  Loader2,
  AlertCircle,
  Filter,
  FileText,
  Heart,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BLOOD_GROUPS, type Donor } from "@/lib/donors";
import { buildWhatsAppUrl, formatDistance, haversineKm } from "@/lib/distance";
import { isBloodCompatible } from "@/lib/ml.functions";
import type { BloodRequest } from "./BloodRequests";
import Navbar from "@/components/Navbar";

const MapView = lazy(() => import("@/components/MapView"));

export default function Home() {
  const navigate = useNavigate();
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [donors, setDonors] = useState<Donor[]>([]);
  const [matchingRequests, setMatchingRequests] = useState<BloodRequest[]>([]);
  const [donorProfile, setDonorProfile] = useState<Donor | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [groupFilter, setGroupFilter] = useState<string>("all");

  useEffect(() => {
    document.title = "Find donors near you · BloodMap AI";
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data: p } = await supabase
        .from("profiles")
        .select("user_type")
        .eq("id", u.user.id)
        .maybeSingle();

      if (!p?.user_type) {
        navigate("/onboarding");
        return;
      }

      // Check if user is a registered donor
      const { data: dData } = await supabase
        .from("donors")
        .select("*")
        .eq("user_id", u.user.id)
        .maybeSingle();

      if (dData) {
        const d = dData as Donor;
        setDonorProfile(d);

        // Fetch open requests matching this donor
        const { data: openReqs } = await supabase.rpc("get_open_blood_requests");
        if (openReqs) {
          const compatible = (openReqs as Partial<BloodRequest>[]).filter(
            (r) => r.blood_group && isBloodCompatible(d.blood_group, r.blood_group)
          ) as BloodRequest[];
          setMatchingRequests(compatible);
        }
      }
    })();
  }, [navigate]);

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => toast.message("Enable location for nearest results"),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.rpc("get_available_donors");
      setLoading(false);
      if (error) return toast.error(error.message);
      setDonors((data as Donor[]) ?? []);
    })();

    const ch = supabase
      .channel("donors-feed")
      .on("postgres_changes", { event: "*", schema: "public", table: "donors" }, async () => {
        const { data } = await supabase.rpc("get_available_donors");
        setDonors((data as Donor[]) ?? []);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  const enriched = useMemo(() => {
    const q = query.trim().toLowerCase();
    return donors
      .map((d) => ({
        ...d,
        distanceKm: center ? haversineKm(center, { lat: d.latitude, lng: d.longitude }) : undefined,
      }))
      .filter((d) => (groupFilter === "all" ? true : d.blood_group === groupFilter))
      .filter((d) =>
        q ? d.full_name.toLowerCase().includes(q) || d.blood_group.toLowerCase().includes(q) : true,
      )
      .sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
  }, [donors, query, groupFilter, center]);

  function searchNearby() {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        toast.success("Updated to your live location");
      },
      (err) => toast.error(err.message),
    );
  }

  return (
    <div className="min-h-screen bg-[var(--gradient-soft)] flex flex-col">
      {/* Shared Responsive Header */}
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6 flex-1 w-full">
        {/* Banner for Matching Blood Requests for Registered Donors */}
        {donorProfile && matchingRequests.length > 0 && (
          <section className="glass-card rounded-2xl p-5 border-l-4 border-l-emerald-500 bg-emerald-500/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-emerald-500/20 text-emerald-700 flex items-center justify-center shrink-0">
                <Heart className="w-6 h-6 fill-emerald-600" />
              </div>
              <div>
                <h2 className="font-extrabold text-foreground text-base sm:text-lg">
                  {matchingRequests.length} Urgent Blood {matchingRequests.length === 1 ? "Request" : "Requests"} Match Your Blood Group ({donorProfile.blood_group})!
                </h2>
                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                  Patients are currently seeking blood donations that you can fulfill.
                </p>
              </div>
            </div>

            <Button asChild size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-glow shrink-0 w-full sm:w-auto">
              <Link to="/requests">
                View & Offer Donation <ArrowRight className="w-4 h-4 ml-1" />
              </Link>
            </Button>
          </section>
        )}

        {/* Stats Section */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Stat
            label="Donors nearby"
            value={enriched.length.toString()}
            icon={<Droplet className="w-5 h-5 fill-primary text-primary" />}
          />
          <Stat
            label="Your location"
            value={center ? `${center.lat.toFixed(3)}, ${center.lng.toFixed(3)}` : "Not shared"}
            icon={<MapPin className="w-5 h-5 text-primary" />}
          />
          <Stat
            label="Closest Donor"
            value={enriched[0]?.distanceKm != null ? formatDistance(enriched[0].distanceKm) : "—"}
            icon={<AlertCircle className="w-5 h-5 text-primary" />}
          />
        </section>

        {/* Map View Container */}
        <section className="glass-card rounded-2xl overflow-hidden h-[340px] sm:h-[460px] relative shadow-md">
          <Suspense
            fallback={
              <div className="absolute inset-0 grid place-items-center text-muted-foreground">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            }
          >
            <MapView center={center} donors={enriched} />
          </Suspense>
        </section>

        {/* Search & Filter Bar */}
        <section className="glass-card rounded-2xl p-4 md:p-5 flex flex-col md:flex-row gap-3 md:items-center">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search by donor name or blood group (e.g. O+)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground shrink-0" />
              <Select value={groupFilter} onValueChange={setGroupFilter}>
                <SelectTrigger className="w-full sm:w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All groups</SelectItem>
                  {BLOOD_GROUPS.map((g) => (
                    <SelectItem key={g} value={g}>
                      {g}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button onClick={searchNearby} className="shadow-glow font-semibold" size="default">
              <MapPin className="w-4 h-4 mr-2" /> Search nearby
            </Button>
          </div>
        </section>

        {/* Donor List Grid */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">Available Donors</h2>
            <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">
              {enriched.length} donors found
            </span>
          </div>

          {loading ? (
            <div className="grid place-items-center py-12 text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : enriched.length === 0 ? (
            <div className="glass-card rounded-2xl p-10 text-center text-muted-foreground">
              No donors match your search criteria.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {enriched.map((d) => (
                <DonorCard key={d.id} donor={d} />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function Stat({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="glass-card rounded-2xl p-4 sm:p-5 flex items-center gap-4">
      <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">{label}</div>
        <div className="text-base sm:text-lg font-bold mt-0.5 truncate">{value}</div>
      </div>
    </div>
  );
}

function DonorCard({ donor }: { donor: Donor & { distanceKm?: number } }) {
  const waMsg = `Hello,\n\nI found your profile on BloodMap AI.\nI urgently need ${donor.blood_group} blood.\n\nCan you please help?`;
  return (
    <div className="glass-card rounded-2xl p-5 hover:shadow-glow transition-all hover:-translate-y-1 flex flex-col justify-between space-y-4 border border-white/20">
      <div>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-bold text-lg">{donor.full_name}</div>
            <div className="text-xs sm:text-sm text-muted-foreground">
              {donor.distanceKm != null
                ? `${formatDistance(donor.distanceKm)} away`
                : "Distance unknown"}
            </div>
          </div>
          <span className="px-3 py-1 rounded-full bg-primary text-primary-foreground font-bold text-sm shadow-glow shrink-0">
            {donor.blood_group}
          </span>
        </div>
        <div className="mt-4 text-xs sm:text-sm text-muted-foreground space-y-1">
          <div>
            <span className="font-medium text-foreground">Available Days:</span>{" "}
            {(donor.available_days || []).map((d) => d.slice(0, 3)).join(", ") || "—"}
          </div>
          <div>
            <span className="font-medium text-foreground">Hours:</span> {donor.start_time || "—"} –{" "}
            {donor.end_time || "—"}
          </div>
        </div>
      </div>

      <div className="pt-2 flex gap-2">
        <Button asChild variant="outline" size="sm" className="flex-1">
          <Link to={`/donors/${donor.id}`}>View details</Link>
        </Button>
        <Button asChild size="sm" className="flex-1 shadow-glow">
          <a href={buildWhatsAppUrl(donor.whatsapp_number, waMsg)} target="_blank" rel="noreferrer">
            <MessageCircle className="w-4 h-4 mr-1" /> WhatsApp
          </a>
        </Button>
      </div>
    </div>
  );
}
