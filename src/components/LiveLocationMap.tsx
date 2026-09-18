import type L from "leaflet";
import { useEffect, useRef } from "react";
import type { LiveLocationData } from "@/hooks/useLiveLocation";
import { formatDistance, haversineKm } from "@/lib/distance";

interface LiveLocationMapProps {
  myLocation: LiveLocationData | null;
  partnerLocation: LiveLocationData | null;
  myLabel?: string;
  partnerLabel?: string;
}

export default function LiveLocationMap({
  myLocation,
  partnerLocation,
  myLabel = "You (Live)",
  partnerLabel = "Donor / Requester (Live)",
}: LiveLocationMapProps) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const polylineRef = useRef<L.Polyline | null>(null);
  const LRef = useRef<typeof L | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !ref.current || mapRef.current) return;
      LRef.current = L;

      const defaultLat = myLocation?.latitude || partnerLocation?.latitude || 20;
      const defaultLng = myLocation?.longitude || partnerLocation?.longitude || 0;

      const map = L.map(ref.current, { zoomControl: true }).setView([defaultLat, defaultLng], 14);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
        maxZoom: 19,
      }).addTo(map);

      layerRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const L = LRef.current;
    if (!L || !mapRef.current || !layerRef.current) return;

    layerRef.current.clearLayers();
    if (polylineRef.current) {
      polylineRef.current.remove();
      polylineRef.current = null;
    }

    const points: Array<[number, number]> = [];

    // 1. My Live Location Marker
    if (myLocation) {
      points.push([myLocation.latitude, myLocation.longitude]);

      const myIcon = L.divIcon({
        className: "",
        html: `
          <div style="position:relative;width:24px;height:24px;">
            <div style="position:absolute;inset:-6px;border-radius:9999px;background:rgba(59,130,246,0.3);animation:ping 2s cubic-bezier(0,0,0.2,1) infinite;"></div>
            <div style="width:24px;height:24px;border-radius:9999px;background:#2563eb;border:3px solid white;box-shadow:0 4px 10px rgba(37,99,235,0.5);"></div>
          </div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      L.marker([myLocation.latitude, myLocation.longitude], { icon: myIcon })
        .addTo(layerRef.current)
        .bindPopup(`<b>${myLabel}</b><br/>Sharing active`);
    }

    // 2. Partner Live Location Marker
    if (partnerLocation) {
      points.push([partnerLocation.latitude, partnerLocation.longitude]);

      const partnerIcon = L.divIcon({
        className: "",
        html: `
          <div style="position:relative;width:24px;height:24px;">
            <div style="position:absolute;inset:-6px;border-radius:9999px;background:rgba(16,185,129,0.35);animation:ping 1.5s cubic-bezier(0,0,0.2,1) infinite;"></div>
            <div style="width:24px;height:24px;border-radius:9999px;background:#10b981;border:3px solid white;box-shadow:0 4px 10px rgba(16,185,129,0.5);"></div>
          </div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      L.marker([partnerLocation.latitude, partnerLocation.longitude], { icon: partnerIcon })
        .addTo(layerRef.current)
        .bindPopup(
          `<b>${partnerLabel}</b><br/>Updated ${new Date(partnerLocation.updated_at).toLocaleTimeString()}`,
        );
    }

    // 3. Draw Connecting Polyline & Adjust Bounds
    if (points.length === 2) {
      const dist = haversineKm(
        { lat: points[0][0], lng: points[0][1] },
        { lat: points[1][0], lng: points[1][1] },
      );

      const poly = L.polyline(points, {
        color: "#10b981",
        weight: 4,
        dashArray: "8, 8",
        opacity: 0.9,
      });

      poly.addTo(layerRef.current);
      polylineRef.current = poly;

      try {
        mapRef.current.fitBounds(poly.getBounds(), { padding: [50, 50] });
      } catch {
        // ignore bounds errors if map is rendering
      }
    } else if (points.length === 1) {
      mapRef.current.setView(points[0], 15);
    }
  }, [myLocation, partnerLocation, myLabel, partnerLabel]);

  return (
    <div className="relative w-full h-full min-h-[220px] rounded-2xl overflow-hidden border border-border/60 shadow-inner">
      <div ref={ref} className="w-full h-full" />
    </div>
  );
}
