import type L from "leaflet";
import { useEffect, useRef } from "react";
import type { Donor } from "@/lib/donors";
import { formatDistance, haversineKm } from "@/lib/distance";

export type MapDonor = Donor & { distanceKm?: number };

interface Props {
  center: { lat: number; lng: number } | null;
  donors: MapDonor[];
  onSelect?: (d: MapDonor) => void;
  route?: Array<[number, number]> | null;
}

export default function MapView({ center, donors, onSelect, route }: Props) {
  const routeLayerRef = useRef<L.Polyline | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const LRef = useRef<typeof L | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !ref.current || mapRef.current) return;
      LRef.current = L;
      const startCenter: [number, number] = center ? [center.lat, center.lng] : [20, 0];
      const map = L.map(ref.current, { zoomControl: true }).setView(startCenter, center ? 13 : 2);
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
    if (mapRef.current && center) mapRef.current.setView([center.lat, center.lng], 13);
  }, [center?.lat, center?.lng]);

  useEffect(() => {
    const L = LRef.current;
    if (!L || !mapRef.current || !layerRef.current) return;
    layerRef.current.clearLayers();

    if (center) {
      const youIcon = L.divIcon({
        className: "",
        html: `<div style="width:18px;height:18px;border-radius:9999px;background:#3b82f6;border:3px solid white;box-shadow:0 0 0 4px rgba(59,130,246,.3)"></div>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });
      L.marker([center.lat, center.lng], { icon: youIcon })
        .addTo(layerRef.current)
        .bindPopup("You are here");
    }

    for (const d of donors) {
      const dropSvg = `
        <div class="blood-marker" style="filter: drop-shadow(0 4px 6px rgba(229,57,53,0.45));">
          <svg width="34" height="42" viewBox="0 0 34 42" xmlns="http://www.w3.org/2000/svg">
            <path d="M17 1 C 17 1, 32 18, 32 28 A 15 15 0 0 1 2 28 C 2 18, 17 1, 17 1 Z" fill="#E53935" stroke="white" stroke-width="2"/>
            <text x="17" y="32" text-anchor="middle" font-family="Inter,system-ui" font-size="10" font-weight="700" fill="white">${d.blood_group}</text>
          </svg>
        </div>`;
      const icon = L.divIcon({
        className: "",
        html: dropSvg,
        iconSize: [34, 42],
        iconAnchor: [17, 42],
        popupAnchor: [0, -38],
      });
      const km = center ? haversineKm(center, { lat: d.latitude, lng: d.longitude }) : null;
      const popup = `
        <div style="min-width:200px;font-family:Inter,system-ui">
          <div style="font-weight:700;font-size:15px">${escapeHtml(d.full_name)}</div>
          <div style="display:flex;gap:6px;align-items:center;margin-top:4px">
            <span style="background:#E53935;color:white;padding:2px 8px;border-radius:999px;font-size:12px;font-weight:700">${d.blood_group}</span>
            ${km != null ? `<span style="color:#64748b;font-size:12px">${formatDistance(km)} away</span>` : ""}
          </div>
          <div style="margin-top:6px;font-size:12px;color:#475569">${(d.available_days || []).map((x: string) => x.slice(0, 3)).join(", ") || "—"}</div>
          <div style="font-size:12px;color:#475569">${d.start_time || ""}${d.start_time ? " – " : ""}${d.end_time || ""}</div>
        </div>`;
      const marker = L.marker([d.latitude, d.longitude], { icon }).bindPopup(popup);
      marker.on("click", () => onSelect?.(d));
      marker.addTo(layerRef.current);
    }
  }, [donors, center?.lat, center?.lng, onSelect]);

  useEffect(() => {
    const L = LRef.current;
    if (!L || !mapRef.current) return;
    if (routeLayerRef.current) {
      routeLayerRef.current.remove();
      routeLayerRef.current = null;
    }
    if (route && route.length > 1) {
      const poly = L.polyline(route, { color: "#E53935", weight: 5, opacity: 0.85 });
      poly.addTo(mapRef.current);
      routeLayerRef.current = poly;
      try {
        mapRef.current.fitBounds(poly.getBounds(), { padding: [40, 40] });
      } catch {
        // ignore fitBounds errors if map is not rendered yet
      }
    }
  }, [route]);

  return <div ref={ref} className="w-full h-full" />;
}

function escapeHtml(s: string) {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}
