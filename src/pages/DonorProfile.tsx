import { Link, useParams } from "react-router-dom";
import { useEffect, useState, lazy, Suspense } from "react";
import {
  ArrowLeft,
  MessageCircle,
  MapPin,
  Clock,
  Calendar,
  Phone,
  Loader2,
  Navigation,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import type { Donor } from "@/lib/donors";
import { buildWhatsAppUrl, formatDistance, haversineKm } from "@/lib/distance";
import Navbar from "@/components/Navbar";

const MapView = lazy(() => import("@/components/MapView"));

export default function DonorProfile() {
  const { id } = useParams<{ id: string }>();
  const [donor, setDonor] = useState<Donor | null>(null);
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [route, setRoute] = useState<Array<[number, number]> | null>(null);
  const [routeInfo, setRouteInfo] = useState<{ km: number; min: number } | null>(null);
  const [routing, setRouting] = useState(false);

  useEffect(() => {
    document.title = "Donor profile · BloodMap AI";
    if (!id) return;
    (async () => {
      const { data, error } = await supabase.rpc("get_donor_detail", { _donor_id: id });
      setLoading(false);
      if (error) return toast.error(error.message);
      const row = Array.isArray(data) ? data[0] : data;
      setDonor((row ?? null) as Donor | null);
    })();
    navigator.geolocation?.getCurrentPosition((pos) =>
      setCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
    );
  }, [id]);

  if (loading)
    return (
      <div className="min-h-screen grid place-items-center bg-[var(--gradient-soft)]">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  if (!donor)
    return (
      <div className="min-h-screen grid place-items-center bg-[var(--gradient-soft)] text-muted-foreground">
        Donor not found.
      </div>
    );

  const distance = center
    ? haversineKm(center, { lat: donor.latitude, lng: donor.longitude })
    : null;
  const waMsg = `Hello,\n\nI found your profile on BloodMap AI.\nI urgently need ${donor.blood_group} blood.\n\nCan you please help me?`;

  async function showDirections() {
    if (!donor) return;
    if (route) {
      setRoute(null);
      setRouteInfo(null);
      return;
    }
    if (!center) {
      toast.error("Enable location to show directions");
      return;
    }
    setRouting(true);
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${center.lng},${center.lat};${donor.longitude},${donor.latitude}?overview=full&geometries=geojson`;
      const res = await fetch(url);
      const json = await res.json();
      const r = json?.routes?.[0];
      if (!r) throw new Error("No route found");
      const coords: Array<[number, number]> = r.geometry.coordinates.map((c: [number, number]) => [
        c[1],
        c[0],
      ]);
      setRoute(coords);
      setRouteInfo({ km: r.distance / 1000, min: r.duration / 60 });
    } catch (e: unknown) {
      toast.error((e as Error)?.message || "Could not fetch directions");
    } finally {
      setRouting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--gradient-soft)] flex flex-col">
      <Navbar />

      <main className="max-w-5xl mx-auto px-4 py-6 sm:py-8 space-y-4 flex-1 w-full">
        <div>
          <Button asChild variant="ghost" size="sm">
            <Link to="/home">
              <ArrowLeft className="w-4 h-4 mr-1" /> Back to map
            </Link>
          </Button>
        </div>

        <div className="grid lg:grid-cols-[1fr_1.2fr] gap-6">
          <section className="glass-card rounded-2xl p-6 md:p-8">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl gradient-hero flex items-center justify-center text-primary-foreground text-2xl font-bold shadow-glow shrink-0">
                {donor.blood_group}
              </div>
              <div>
                <h1 className="text-xl sm:text-3xl font-bold">{donor.full_name}</h1>
                <div className="text-xs sm:text-sm text-muted-foreground mt-1">
                  {distance != null ? `${formatDistance(distance)} away` : "Distance unknown"}
                </div>
              </div>
            </div>

            <div className="mt-8 space-y-4">
              <Row
                icon={<Phone className="w-4 h-4" />}
                label="WhatsApp"
                value={donor.whatsapp_number}
              />
              <Row
                icon={<Calendar className="w-4 h-4" />}
                label="Available days"
                value={(donor.available_days || []).join(", ") || "—"}
              />
              <Row
                icon={<Clock className="w-4 h-4" />}
                label="Available hours"
                value={`${donor.start_time || "—"} – ${donor.end_time || "—"}`}
              />
              {donor.address && (
                <Row
                  icon={<MapPin className="w-4 h-4 text-primary" />}
                  label="Address"
                  value={donor.address}
                />
              )}
              <Row
                icon={<MapPin className="w-4 h-4" />}
                label="Coordinates"
                value={`${donor.latitude.toFixed(4)}, ${donor.longitude.toFixed(4)}`}
              />
            </div>

            <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Button asChild size="lg" className="shadow-glow">
                <a
                  href={buildWhatsAppUrl(donor.whatsapp_number, waMsg)}
                  target="_blank"
                  rel="noreferrer"
                >
                  <MessageCircle className="w-5 h-5 mr-2" /> Send WhatsApp Request
                </a>
              </Button>
              <Button
                size="lg"
                variant={route ? "secondary" : "outline"}
                onClick={showDirections}
                disabled={routing}
              >
                {routing ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" /> Finding route…
                  </>
                ) : route ? (
                  <>
                    <X className="w-5 h-5 mr-2" /> Hide directions
                  </>
                ) : (
                  <>
                    <Navigation className="w-5 h-5 mr-2" /> Directions
                  </>
                )}
              </Button>
            </div>
            {routeInfo && (
              <div className="mt-3 text-xs sm:text-sm text-muted-foreground text-center">
                Route:{" "}
                <span className="font-semibold text-foreground">{routeInfo.km.toFixed(1)} km</span> ·{" "}
                <span className="font-semibold text-foreground">{Math.round(routeInfo.min)} min</span>{" "}
                by car
              </div>
            )}
          </section>

          <section className="glass-card rounded-2xl overflow-hidden h-[340px] sm:h-[460px] relative shadow-md">
            <Suspense
              fallback={
                <div className="absolute inset-0 grid place-items-center">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                </div>
              }
            >
              <MapView center={center} donors={[donor]} route={route} />
            </Suspense>
          </section>
        </div>
      </main>
    </div>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl bg-muted/40 p-3">
      <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">{label}</div>
        <div className="font-medium text-sm break-words mt-0.5">{value}</div>
      </div>
    </div>
  );
}
