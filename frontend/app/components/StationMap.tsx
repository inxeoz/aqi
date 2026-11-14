"use client";
import { useEffect, useRef, useState } from "react";

export type MapRow = { location: string; value: number | null; lat: number | null; lng: number | null };

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

export default function StationMap({ userRows = [] as MapRow[] }) {
  const [filter, setFilter] = useState("ALL");
  const [showEffect, setShowEffect] = useState(true);
  const [baseKm, setBaseKm] = useState(5);
  const divRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const layerRef = useRef<import("leaflet").LayerGroup | null>(null);

  const placed = userRows.filter(r => r.lat != null && r.lng != null && r.value != null);
  const unplaced = [...new Set(userRows.filter(r => r.lat == null || r.lng == null).map(r => r.location))].sort();

  function draw(L: typeof import("leaflet")) {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    const shown = placed.filter((r) => {
      if (filter === "SEVERE") return (r.value ?? 0) >= 250;
      if (filter === "POOR+") return (r.value ?? 0) >= 120;
      if (filter === "MISSING") return r.value == null;
      return true;
    });
    const bounds: [number, number][] = [];
    shown.forEach((r) => {
      if (showEffect) {
        L.circle([r.lat as number, r.lng as number], {
          radius: baseKm * 1000 * factor(r.value),
          color: color(r.value),
          weight: 1,
          fillColor: color(r.value),
          fillOpacity: 0.18,
        }).addTo(layer);
      }
      const c = L.circleMarker([r.lat as number, r.lng as number], {
        radius: 6,
        color: "#0B5D66",
        weight: 1,
        fillColor: color(r.value),
        fillOpacity: 0.9,
      }).addTo(layer);
      const esc = String(r.location).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      c.bindPopup(`<strong>${esc}</strong><br/>PM2.5: ${Number(r.value)}<br/>effect radius: ${(baseKm * factor(r.value)).toFixed(1)} km`);
      bounds.push([r.lat as number, r.lng as number]);
    });
    if (bounds.length) map.fitBounds(bounds as L.LatLngBoundsExpression, { padding: [20, 20] });
    else map.setView([18.52, 73.85], 11);
  }

  // Create the map exactly once.
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!divRef.current || mapRef.current) return;
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");
      if (!alive || !divRef.current || mapRef.current) return;
      const map = L.map(divRef.current).setView([18.52, 73.85], 11);
      mapRef.current = map;
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
      }).addTo(map);
      layerRef.current = L.layerGroup().addTo(map);
      draw(L);
    })();
    return () => { alive = false; };
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
  }, [userRows, filter, showEffect, baseKm, JSON.stringify(userRows)]);


  return (
    <div>
      {placed.length === 0 && (
        <div style={{ background: "#FFF3CD", border: "1px solid #D9D6CF", borderRadius: 4, padding: "8px 12px", marginBottom: 8 }}>
          No mappable places yet. Add <span className="mono">latitude</span> and <span className="mono">longitude</span> columns
          to your upload to draw it here. Rows without coordinates are listed below, never guessed.
        </div>
      )}
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
        <span style={{ fontSize: 12, color: "#666" }}>{placed.length} mapped place(s)</span>
      </div>
      <div ref={divRef} role="application" aria-label="Map of uploaded air quality readings" style={{ height: 480, width: "100%", borderRadius: 6, border: "1px solid #D9D6CF", zIndex: 0 }} />
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
      {unplaced.length > 0 && (
        <div style={{ fontSize: 12, marginTop: 8, color: "#C62828" }}>
          Could not place {unplaced.length} location(s) — no coordinates in upload: {unplaced.join(", ")}.
        </div>
      )}
    </div>
  );
}
