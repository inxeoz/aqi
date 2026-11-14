// Civic Air Quality Briefing Studio - core engine (part 1: types + rows)
export type Row = {
  id: string; location: string; time: string; pollutant: string;
  value: number | null; unit: string; raw: Record<string,string>;
  flags: string[]; status: string;
};
export type Finding = { text: string; cited_row_ids: string[] };
export type Brief = { trends: Finding[]; hotspots: Finding[]; gaps: Finding[]; generated_by: string };
export type Action = { rank: number; text: string; cited_row_ids: string[] };
const rid = (i: number) => "R" + String(i + 1).padStart(4, "0");
export const BAND = (pm: number) => pm <= 50 ? "Good" : pm <= 100 ? "Moderate" : pm <= 200 ? "Poor" : "Very Poor";
export function bandColor(b: string) {
  if (b === "Good") return "#2E7D32";
  if (b === "Moderate") return "#F9A825";
  if (b === "Poor") return "#EF6C00";
  return "#C62828";
}
export const SAMPLE_CSV = [
  "location,time,pollutant,value,unit",
  "Shivaji Chowk,2026-11-10 08:00,PM2.5,168,ug/m3",
  "Shivaji Chowk,2026-11-10 09:00,PM2.5,,ug/m3",
  "Kothrud,2026-11-10 08:00,PM2.5,0.09,ppm",
  "Kothrud,2026-11-10 09:00,PM2.5,132,ug/m3",
  "Hadapsar,2026-11-10 08:00,PM2.5,210,ug/m3",
  "Hadapsar,2026-11-10 09:00,PM2.5,-12,ug/m3",
  "Shivaji Chowk,2026-11-10 08:00,PM2.5,168,ug/m3",
  "Baner,2026-11-11 08:00,PM2.5,95,ug/m3",
].join("\n");
export function buildRows(records: Record<string,string>[]): Row[] {
  const pick = (r: Record<string,string>, ...names: string[]) => {
    const keys = Object.keys(r);
    for (const n of names) { const h = keys.find(k => k.trim().toLowerCase() === n); if (h) return r[h]; }
    return "";
  };
  const seen = new Set<string>();
  const rows: Row[] = records.map((r, i) => {
    const location = pick(r, "location", "site", "station", "area", "ward") || "Unknown";
    const time = pick(r, "time", "date", "datetime", "timestamp", "hour") || ("T" + i);
    const pollutant = pick(r, "pollutant", "parameter", "poll") || "PM2.5";
    const rawVal = pick(r, "value", "concentration", "reading", "level", "pm2.5", "pm25");
    const unit = pick(r, "unit", "units") || "ug/m3";
    const flags: string[] = [];
    let value: number | null = (rawVal === "" || rawVal == null) ? null : Number(String(rawVal).trim());
    if (rawVal === "" || rawVal == null || (value != null && Number.isNaN(value))) { flags.push("MISSING_VALUE"); value = null; }
    if (value != null && !Number.isNaN(value) && value < 0) flags.push("NEGATIVE_VALUE");
    if (value != null && /pm/i.test(pollutant) && value > 2000 && /ug|mg/i.test(unit)) flags.push("IMPLAUSIBLE_HIGH");
    const key = location + "|" + time + "|" + pollutant + "|" + rawVal;
    if (seen.has(key)) flags.push("DUPLICATE_ROW");
    seen.add(key);
    return { id: rid(i), location, time, pollutant, value, unit, raw: r, flags, status: "usable" };
  });
  const units = new Set(rows.map(r => r.unit.toLowerCase()));
  const hasPpm = [...units].some(u => u.indexOf("ppm") >= 0 || u === "ppb");
  const hasUg = [...units].some(u => u.indexOf("ug") >= 0 || u.indexOf("mg") >= 0);
  rows.forEach(r => { if (hasPpm && hasUg) r.flags.push("UNIT_INCONSISTENT"); });
  const byLoc: Record<string, number> = {};
  rows.forEach(r => { byLoc[r.location] = (byLoc[r.location] || 0) + 1; });
  const mx = Math.max(1, ...Object.values(byLoc));
  rows.forEach(r => { if ((byLoc[r.location] / mx) < 0.5) r.flags.push("STALE_GAP"); });
  rows.forEach(r => {
    r.flags = [...new Set(r.flags)];
    const bad = r.flags.some(f => f === "MISSING_VALUE" || f === "NEGATIVE_VALUE" || f === "IMPLAUSIBLE_HIGH" || f === "DUPLICATE_ROW");
    r.status = bad ? "unreliable" : (r.flags.length ? "suspect" : "usable");
  });
  return rows;
}
export function metrics(rows: Row[]) {
  const ok = rows.filter(r => r.status !== "unreliable" && r.value != null);
  const vals = ok.map(r => r.value as number);
  const mean = vals.length ? vals.reduce((a,b) => a+b, 0) / vals.length : 0;
  const byLoc: Record<string, number[]> = {};
  ok.forEach(r => { (byLoc[r.location] = byLoc[r.location] || []).push(r.value as number); });
  const locMean = Object.entries(byLoc).map(([loc, vs]) => ({ loc, mean: vs.reduce((a,b) => a+b, 0) / vs.length, n: vs.length }));
  locMean.sort((a,b) => b.mean - a.mean);
  const worst = ok.slice().sort((a,b) => (b.value as number) - (a.value as number)).slice(0, 5);
  return {
    total: rows.length,
    usable: rows.filter(r => r.status === "usable").length,
    suspect: rows.filter(r => r.status === "suspect").length,
    unusable: rows.filter(r => r.status === "unreliable").length,
    mean: Math.round(mean * 10) / 10, okCount: ok.length, locMean, worst,
  };
}
export function heuristicBrief(rows: Row[]): Brief {
  const m = metrics(rows);
  const top = m.locMean[0];
  const wids = m.worst.map(r => r.id);
  const gaps: Finding[] = [];
  const trends: Finding[] = [];
  if (top) trends.push({ text: "Average reading is " + m.mean + " ug/m3 across " + m.okCount + " valid readings, with " + top.loc + " highest at " + Math.round(top.mean) + " ug/m3 (" + BAND(top.mean) + ").", cited_row_ids: wids.slice(0, 3) });
  if (m.locMean[1]) trends.push({ text: m.locMean[1].loc + " is the second hotspot, below " + top.loc + " but still above the average level.", cited_row_ids: wids.slice(1, 4) });
  if (!top) trends.push({ text: "No valid readings are available, so no trend can be stated.", cited_row_ids: rows.slice(0, 1).map(r => r.id) });
  const hotspots: Finding[] = m.locMean.slice(0, 3).map((l, i) => ({
    text: "Hotspot " + (i+1) + ": " + l.loc + " averages " + Math.round(l.mean) + " ug/m3 over " + l.n + " readings, rated " + BAND(l.mean) + ".",
    cited_row_ids: rows.filter(r => r.location === l.loc && r.status !== "unreliable").slice(0, 2).map(r => r.id),
  }));
  const badRows = rows.filter(r => r.status === "unreliable").map(r => r.id);
  if (badRows.length) gaps.push({ text: badRows.length + " readings are unreliable or missing and were excluded from averages; they appear as data gaps.", cited_row_ids: badRows.slice(0, 3) });
  else gaps.push({ text: "No unreliable readings; all " + rows.length + " rows passed quality checks.", cited_row_ids: rows.slice(0, 2).map(r => r.id) });
  const sus = rows.filter(r => r.status === "suspect");
  if (sus.length) gaps.push({ text: sus.length + " readings are suspect (mixed units or sparse times) and need field verification.", cited_row_ids: sus.slice(0, 3).map(r => r.id) });
  return { trends, hotspots, gaps, generated_by: "heuristic_fallback" };
}
const ROLE_CATALOG: Record<string, string[]> = {
  ward: ["Inspect construction sites and road dust in the hotspot wards", "Order extra road sweeping and water sprinkling on dusty stretches", "Issue a public notice limiting waste burning and traffic idling", "Divert heavy traffic away from hotspot roads during peak hours", "Deploy mobile monitoring near the worst station for one week"],
  housing: ["Shift outdoor work by staff to morning low-pollution hours", "Switch to wet mopping and keep windows closed during dusty hours", "Run community air purifiers in common halls and lobbies", "Stop waste burning and compost garden waste instead", "Share the citizen advisory in the society group daily"],
  school: ["Move PE and games indoors on poor-air days", "Stop outdoor sports and hold morning assembly indoors", "Issue a mask advisory for children on the school bus route", "Run classroom purifiers and seal dusty windows", "Send the advisory note to parents every morning"],
};
export function actionsFor(role: string, rows: Row[]): Action[] {
  const list = ROLE_CATALOG[role] || ROLE_CATALOG.ward;
  const m = metrics(rows);
  let cite = m.worst.map(r => r.id).slice(0, 2);
  if (!cite.length) cite = rows.slice(0, 2).map(r => r.id);
  return list.slice(0, 5).map((t, i) => ({ rank: i < 2 ? 1 : i < 4 ? 2 : 3, text: t, cited_row_ids: cite }));
}
export function applyLevel(text: string, level: string): string {
  const parts = text.split(/(?<=[.!])\s+/);
  const cap = (s: string, n: number) => { const w = s.split(/\s+/); return w.length <= n ? s : w.slice(0, n).join(" ") + "."; };
  if (level === "child") return parts.map(s => cap(s, 12)).join(" ");
  if (level === "easy_read") return parts.map(s => cap(s, 8)).join("\n");
  return text;
}
export const LANGS = ["en", "hi"] as const;
export type Lang = "en" | "hi";
export const STR: Record<string, Record<string,string>> = {
  en: { internal: "Internal Briefing Note", citizen: "Citizen Advisory", children: "Section for Children", older: "Section for Older Adults", sensitive: "Section for Sensitive People", actions: "Today Actions", quality: "Current Quality", updates: "Updates", disclaimer: "Disclaimer: this note uses the latest available readings and may change.", trends: "Trends", hotspots: "Hotspots", gaps: "Data Gaps", priority: "Priority Actions", changed: "What Changed", confidence: "Confidence" },
};
STR.hi = {"internal": "\u0906\u0902\u0924\u0930\u093f\u0915 \u092c\u094d\u0930\u0940\u092b\u093f\u0902\u0917 \u0928\u094b\u091f", "citizen": "\u0928\u093e\u0917\u0930\u093f\u0915 \u0938\u0932\u093e\u0939", "children": "\u092c\u091a\u094d\u091a\u094b\u0902 \u0915\u0947 \u0932\u093f\u090f \u0916\u0902\u0921", "older": "\u092c\u0941\u091c\u0941\u0930\u094d\u0917\u094b\u0902 \u0915\u0947 \u0932\u093f\u090f \u0916\u0902\u0921", "sensitive": "\u0938\u0902\u0935\u0947\u0926\u0928\u0936\u0940\u0932 \u0932\u094b\u0917\u094b\u0902 \u0915\u0947 \u0932\u093f\u090f \u0916\u0902\u0921", "actions": "\u0906\u091c \u0915\u0947 \u0915\u093e\u0930\u094d\u092f", "quality": "\u0935\u0930\u094d\u0924\u092e\u093e\u0928 \u0917\u0941\u0923\u0935\u0924\u094d\u0924\u093e", "updates": "\u0905\u0926\u094d\u092f\u0924\u0928", "disclaimer": "\u0905\u0938\u094d\u0935\u0940\u0915\u0930\u0923: \u092f\u0939 \u0928\u094b\u091f \u0928\u0935\u0940\u0928\u0924\u092e \u0909\u092a\u0932\u092c\u094d\u0927 \u0906\u0902\u0915\u0921\u093c\u094b\u0902 \u092a\u0930 \u0906\u0927\u093e\u0930\u093f\u0924 \u0939\u0948\u0964", "trends": "\u0930\u0941\u091d\u093e\u0928", "hotspots": "\u0939\u0949\u091f\u0938\u094d\u092a\u0949\u091f", "gaps": "\u0921\u0947\u091f\u093e \u0905\u0902\u0924\u0930\u093e\u0932", "priority": "\u092a\u094d\u0930\u093e\u0925\u092e\u093f\u0915\u0924\u093e \u0915\u093e\u0930\u094d\u092f", "changed": "\u0915\u094d\u092f\u093e \u092c\u0926\u0932\u093e", "confidence": "\u0935\u093f\u0936\u094d\u0935\u093e\u0938"};
export const VULN: Record<string,string> = {"child_en": "Children: play indoors today. Wear a mask outside. Drink water. Tell a teacher if you cough.", "older_en": "Older adults: skip the morning walk. Keep medicines near you. Keep windows closed in dusty hours.", "sens_en": "Sensitive people: stay indoors if you feel breathless. Wear a mask outside. See a doctor if symptoms rise.", "child_hi": "\u092c\u091a\u094d\u091a\u094b\u0902: \u0906\u091c \u092c\u093e\u0939\u0930 \u0928 \u0916\u0947\u0932\u0947\u0902\u0964 \u092e\u093e\u0938\u094d\u0915 \u092a\u0939\u0928\u0947\u0902\u0964 \u092a\u093e\u0928\u0940 \u092a\u093f\u090f\u0902\u0964 \u0916\u093e\u0902\u0938\u0940 \u0906\u090f \u0924\u094b \u0936\u093f\u0915\u094d\u0937\u0915 \u0915\u094b \u092c\u0924\u093e\u090f\u0902\u0964", "older_hi": "\u092c\u0941\u091c\u0941\u0930\u094d\u0917: \u0938\u0941\u092c\u0939 \u0915\u0940 \u0938\u0948\u0930 \u091f\u093e\u0932\u0947\u0902\u0964 \u0926\u0935\u093e \u0938\u093e\u0925 \u0930\u0916\u0947\u0902\u0964 \u0927\u0942\u0932 \u092d\u0930\u0947 \u0938\u092e\u092f \u0916\u093f\u0921\u093c\u0915\u093f\u092f\u093e\u0902 \u092c\u0902\u0926 \u0930\u0916\u0947\u0902\u0964", "sens_hi": "\u0938\u0902\u0935\u0947\u0926\u0928\u0936\u0940\u0932 \u0932\u094b\u0917: \u0938\u093e\u0902\u0938 \u092b\u0942\u0932\u0947 \u0924\u094b \u0918\u0930 \u092e\u0947\u0902 \u0930\u0939\u0947\u0902\u0964 \u092c\u093e\u0939\u0930 \u092e\u093e\u0938\u094d\u0915 \u092a\u0939\u0928\u0947\u0902\u0964 \u0932\u0915\u094d\u0937\u0923 \u092c\u0922\u093c\u0947\u0902 \u0924\u094b \u0921\u0949\u0915\u094d\u091f\u0930 \u0938\u0947 \u092e\u093f\u0932\u0947\u0902\u0964"};
export function vulnSection(group: string, lang: string): string {
  const k = group + "_" + lang;
  return VULN[k] || VULN[group + "_en"] || "";
}
export function buildInternalDoc(rows: Row[], brief: Brief, actions: Action[], changeText: string, lang: string, level: string): string {
  const s = STR[lang] || STR.en;
  const L1 = (t: string) => applyLevel(t, level);
  const m = metrics(rows);
  const out: string[] = [];
  out.push("# " + s.internal);
  out.push("");
  out.push("## " + s.trends);
  brief.trends.forEach(f => out.push("- " + L1(f.text) + " [" + f.cited_row_ids.join(", ") + "]"));
  out.push("");
  out.push("## " + s.hotspots);
  brief.hotspots.forEach(f => out.push("- " + L1(f.text) + " [" + f.cited_row_ids.join(", ") + "]"));
  out.push("");
  out.push("## " + s.gaps + " (" + m.unusable + " unusable, " + m.suspect + " suspect of " + m.total + ")");
  brief.gaps.forEach(f => out.push("- " + L1(f.text) + " [" + f.cited_row_ids.join(", ") + "]"));
  out.push("");
  out.push("## " + s.priority);
  actions.forEach(a => out.push(a.rank + ". " + L1(a.text) + " [" + a.cited_row_ids.join(", ") + "]"));
  out.push("");
  out.push("## " + s.changed);
  out.push(L1(changeText || "This is the first brief; no previous brief exists."));
  out.push("");
  out.push("## " + s.confidence);
  out.push(L1("Confidence is medium: " + m.okCount + " of " + m.total + " readings were valid."));
  out.push("");
  out.push("_generated_by: " + brief.generated_by + "_");
  return out.join("\n");
}
export function buildCitizenDoc(rows: Row[], brief: Brief, actions: Action[], lang: string, level: string): string {
  const s = STR[lang] || STR.en;
  const L1 = (t: string) => applyLevel(t, level);
  const m = metrics(rows);
  const top = m.locMean[0];
  const out: string[] = [];
  out.push("# " + s.citizen);
  out.push("");
  out.push("## " + s.quality);
  out.push(L1(top ? ("Air in " + top.loc + " is " + BAND(top.mean) + " at " + Math.round(top.mean) + " ug/m3.") : "No valid air readings today."));
  out.push("");
  out.push("## " + s.actions);
  actions.slice(0, 4).forEach(a => out.push("- " + L1(a.text)));
  out.push("");
  out.push("## " + s.children);
  out.push(L1(vulnSection("child", lang)));
  out.push("");
  out.push("## " + s.older);
  out.push(L1(vulnSection("older", lang)));
  out.push("");
  out.push("## " + s.sensitive);
  out.push(L1(vulnSection("sens", lang)));
  out.push("");
  out.push("## " + s.updates);
  out.push(L1(brief.trends[0] ? brief.trends[0].text : "New readings will be shared tomorrow."));
  out.push("");
  out.push("_" + s.disclaimer + "_");
  out.push("");
  out.push("_generated_by: " + brief.generated_by + "_");
  return out.join("\n");
}
