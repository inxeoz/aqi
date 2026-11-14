"use client";
import { useEffect, useRef, useState } from "react";

type St = { state: string; city: string; station: string; lat: number; lng: number; pm25: number | null; pm10: number | null };

function color(pm: number | null) {
  if (pm == null) return "#999";
  if (pm <= 60) return "#2E7D32";
  if (pm <= 120) return "#F9A825";
  if (pm <= 250) return "#EF6C00";
  return "#C62828";
}

function factor(pm: number | null) {
  if (pm == null) return 0.5;
  if (pm <= 60) return 0.5;
  if (pm <= 120) return 1;
  if (pm <= 250) return 2;
  return 3;
}

export default function StationMap({ highlight = [] as string[] }) {
  const [stations, setStations] = useState<St[]>([]);
  const [filter, setFilter] = useState("ALL");
  const [showEffect, setShowEffect] = useState(true);
  const [baseKm, setBaseKm] = useState(5);
  const divRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const layerRef = useRef<import("leaflet").LayerGroup | null>(null);
  const hlRef = useRef<string[]>(highlight);
  hlRef.current = highlight;

  useEffect(() => {
    fetch("/stations.json").then((r) => r.json()).then(setStations).catch(() => setStations([]));
  }, []);

  // Create the map exactly once.
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!divRef.current || mapRef.current) return;
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");
      if (!alive || !divRef.current || mapRef.current) return;
      const map = L.map(divRef.current).setView([23.5, 79.5], 5);
      mapRef.current = map;
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
      }).addTo(map);
      layerRef.current = L.layerGroup().addTo(map);
      draw(L);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Redraw markers when data or settings change. Never recreates the map.
  useEffect(() => {
    if (!mapRef.current || !layerRef.current) return;
    (async () => {
      const L = (await import("leaflet")).default;
      draw(L);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stations, filter, showEffect, baseKm, JSON.stringify(highlight)]);

  function draw(L: typeof import("leaflet")) {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer || !stations.length) return;
    layer.clearLayers();
    const hl = hlRef.current;
    const shown = stations.filter((s) => {
      if (filter === "SEVERE") return (s.pm25 ?? 0) >= 250;
      if (filter === "POOR+") return (s.pm25 ?? 0) >= 120;
      if (filter === "MISSING") return s.pm25 == null;
      return true;
    });
    const bounds: [number, number][] = [];
    shown.forEach((s) => {
      if (showEffect) {
        L.circle([s.lat, s.lng], {
          radius: baseKm * 1000 * factor(s.pm25),
          color: color(s.pm25),
          weight: 1,
          fillColor: color(s.pm25),
          fillOpacity: 0.18,
        }).addTo(layer);
      }
      const c = L.circleMarker([s.lat, s.lng], {
        radius: hl.includes(s.station) ? 8 : 5,
        color: hl.includes(s.station) ? "#0B5D66" : color(s.pm25),
        weight: hl.includes(s.station) ? 3 : 1,
        fillColor: color(s.pm25),
        fillOpacity: 0.9,
      }).addTo(layer);
      c.bindPopup(
        `<strong>${s.city}</strong><br/>${s.station}<br/>PM2.5: ${s.pm25 ?? "-"} | PM10: ${s.pm10 ?? "-"}<br/>effect radius: ${(baseKm * factor(s.pm25)).toFixed(1)} km<br/>${s.state}`
      );
      bounds.push([s.lat, s.lng]);
    });
    if (bounds.length) map.fitBounds(bounds as L.LatLngBoundsExpression, { padding: [20, 20] });
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap", alignItems: "center" }}>
        {["ALL", "POOR+", "SEVERE", "MISSING"].map((f) => (
          <button key={f} data-testid="StationMap:button-filter" className="chip" onClick={() => setFilter(f)}
            style={filter === f ? { borderColor: "#0B5D66", color: "#0B5D66" } : {}}>{f}</button>
        ))}
        <button data-testid="StationMap:button-toggle-effect" className="chip" onClick={() => setShowEffect((v) => !v)}
          style={showEffect ? { borderColor: "#0B5D66", color: "#0B5D66" } : {}}>
          {showEffect ? "Hide effect area" : "Show effect area"}
        </button>
        <label style={{ fontSize: 12, color: "#666", display: "flex", gap: 6, alignItems: "center" }}>
          Base radius
          <input data-testid="StationMap:input-base-radius" type="range" min={1} max={20} step={1} value={baseKm}
            onChange={(e) => setBaseKm(Number(e.target.value))} style={{ width: 110 }} />
          <span className="mono">{baseKm} km</span>
        </label>
        <span style={{ fontSize: 12, color: "#666" }}>{stations.length} stations, snapshot 14-11-2026 01:00</span>
      </div>
      <div ref={divRef} style={{ height: 480, width: "100%", borderRadius: 6, border: "1px solid #D9D6CF", zIndex: 0 }} />
      <div style={{ display: "flex", gap: 12, fontSize: 12, marginTop: 6, flexWrap: "wrap" }}>
        <span><i style={{ color: "#2E7D32" }}>●</i> ≤60 (x0.5)</span>
        <span><i style={{ color: "#F9A825" }}>●</i> 61–120 (x1)</span>
        <span><i style={{ color: "#EF6C00" }}>●</i> 121–250 (x2)</span>
        <span><i style={{ color: "#C62828" }}>●</i> 250+ (x3)</span>
        <span><i style={{ color: "#999" }}>●</i> no data (x0.5)</span>
      </div>
      <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
        Effect radius = base radius x severity factor. Example at {baseKm} km base: severe = {(baseKm * 3).toFixed(0)} km, poor = {(baseKm * 2).toFixed(0)} km.
      </div>
    </div>
  );
}
