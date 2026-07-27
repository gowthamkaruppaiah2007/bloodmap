import { Link, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState, lazy, Suspense } from "react";
import {
  Droplet,
  Search,
  MapPin,
  LogOut,
  MessageCircle,
  Loader2,
  AlertCircle,
  Filter,
  TrendingUp,
  FileText,
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

const MapView = lazy(() => import("@/components/MapView"));

export default function Home() {
  const navigate = useNavigate();
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [donors, setDonors] = useState<Donor[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [groupFilter, setGroupFilter] = useState<string>("all");
  const [profileType, setProfileType] = useState<string | null>(null);

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
      setProfileType(p.user_type);
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

  async function logout() {
    await supabase.auth.signOut();
    navigate("/auth");
  }

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
    <div className="min-h-screen bg-[var(--gradient-soft)]">
      {/* Header */}
      <header className="sticky top-0 z-30 glass-card border-x-0 border-t-0 rounded-none">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-primary">
            <Droplet className="w-6 h-6 fill-primary" />
            <span className="text-lg">BloodMap AI</span>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/requests">
                <FileText className="w-4 h-4 mr-1" /> Blood Requests
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/forecast">
                <TrendingUp className="w-4 h-4 mr-1" /> Forecast AI
              </Link>
            </Button>
            {profileType === "seeker" && (
              <Button asChild variant="default" size="sm" className="shadow-glow">
                <Link to="/donor-setup">Become a donor</Link>
              </Button>
            )}
            <Button onClick={logout} variant="ghost" size="sm">
              <LogOut className="w-4 h-4 mr-1" /> Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Hero / stats */}
        <section className="grid md:grid-cols-3 gap-4">
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
            label="Closest"
            value={enriched[0]?.distanceKm != null ? formatDistance(enriched[0].distanceKm) : "—"}
            icon={<AlertCircle className="w-5 h-5 text-primary" />}
          />
        </section>

        {/* Map */}
        <section className="glass-card rounded-2xl overflow-hidden h-[460px] relative">
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

        {/* Search bar */}
        <section className="glass-card rounded-2xl p-4 md:p-5 flex flex-col md:flex-row gap-3 md:items-center">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search by donor name or blood group"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <Select value={groupFilter} onValueChange={setGroupFilter}>
              <SelectTrigger className="w-[140px]">
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
          <Button onClick={searchNearby} className="shadow-glow" size="lg">
            <MapPin className="w-4 h-4 mr-2" /> Search nearby donors
          </Button>
        </section>

        {/* Donor list */}
        <section>
          <h2 className="text-xl font-bold mb-4">Nearby donors</h2>
          {loading ? (
            <div className="grid place-items-center py-12 text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : enriched.length === 0 ? (
            <div className="glass-card rounded-2xl p-10 text-center text-muted-foreground">
              No donors match your search yet.
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
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
    <div className="glass-card rounded-2xl p-5 flex items-center gap-4">
      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
        {icon}
      </div>
      <div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="text-lg font-bold">{value}</div>
      </div>
    </div>
  );
}

function DonorCard({ donor }: { donor: Donor & { distanceKm?: number } }) {
  const waMsg = `Hello,\n\nI found your profile on BloodMap AI.\nI urgently need ${donor.blood_group} blood.\n\nCan you please help?`;
  return (
    <div className="glass-card rounded-2xl p-5 hover:shadow-glow transition-all hover:-translate-y-1">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-bold text-lg">{donor.full_name}</div>
          <div className="text-sm text-muted-foreground">
            {donor.distanceKm != null
              ? `${formatDistance(donor.distanceKm)} away`
              : "Distance unknown"}
          </div>
        </div>
        <span className="px-3 py-1 rounded-full bg-primary text-primary-foreground font-bold text-sm shadow-glow">
          {donor.blood_group}
        </span>
      </div>
      <div className="mt-4 text-sm text-muted-foreground space-y-1">
        <div>
          <span className="font-medium text-foreground">Days:</span>{" "}
          {(donor.available_days || []).map((d) => d.slice(0, 3)).join(", ") || "—"}
        </div>
        <div>
          <span className="font-medium text-foreground">Time:</span> {donor.start_time || "—"} –{" "}
          {donor.end_time || "—"}
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <Button asChild variant="outline" size="sm" className="flex-1">
          <Link to={`/donors/${donor.id}`}>
            View details
          </Link>
        </Button>
        <Button asChild size="sm" className="flex-1">
          <a href={buildWhatsAppUrl(donor.whatsapp_number, waMsg)} target="_blank" rel="noreferrer">
            <MessageCircle className="w-4 h-4 mr-1" /> WhatsApp
          </a>
        </Button>
      </div>
    </div>
  );
}
