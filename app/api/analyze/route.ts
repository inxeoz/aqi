// POST /api/analyze - two-model GenAI pipeline with strict validation
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { metrics, heuristicBrief, actionsFor } from '@/lib/aqi';


const Finding = z.object({ text: z.string(), cited_row_ids: z.array(z.string()) });
const Analyst = z.object({
  trends: z.array(Finding).min(1).max(4),
  hotspots: z.array(Finding).min(1).max(4),
  gaps: z.array(Finding).min(1).max(4),
});
async function analystCall(prompt: string, key: string) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + key },
    body: JSON.stringify({
      model: process.env.ANALYST_MODEL || "gpt-4o",
      temperature: 0.1,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) throw new Error("analyst HTTP " + res.status);
  const data = await res.json();
  const txt = data.choices?.[0]?.message?.content || "{}";
  return Analyst.parse(JSON.parse(txt));
}
async function writerCall(prompt: string, key: string): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + key },
    body: JSON.stringify({
      model: process.env.WRITER_MODEL || "gpt-4o-mini",
      temperature: 0.5,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error("writer HTTP " + res.status);
  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}
function cleanFindings(list: { text: string; cited_row_ids: string[] }[], valid: Set<string>) {
  const out: { text: string; cited_row_ids: string[]; unverified?: boolean }[] = [];
  for (const f of list || []) {
    const good = (f.cited_row_ids || []).filter(id => valid.has(id));
    if (!good.length) continue;
    out.push({ text: f.text, cited_row_ids: good });
  }
  return out;
}
export async function POST(req: Request) {
  const body = await req.json();
  const rows = body.rows || [];
  const role = body.role || "ward";
  const prev = body.prev || null;
  const m = metrics(rows);
  const valid = new Set<string>(rows.map((r: { id: string }) => r.id));
  const flagged = rows.filter((r: { status: string }) => r.status !== "usable").slice(0, 12);
  const key = process.env.OPENAI_API_KEY || "";
  const fb = heuristicBrief(rows);
  const fbActions = actionsFor(role, rows);
  if (!key) return NextResponse.json({ brief: fb, actions: fbActions, change: "", ai: false });
  try {
    const prompt = "You are an air quality analyst. Use ONLY these calculated metrics: " + JSON.stringify({ mean: m.mean, locMean: m.locMean, worst: m.worst.map((w: { id: string }) => w.id), counts: { total: m.total, usable: m.usable, suspect: m.suspect, unusable: m.unusable } }) + ". Flagged sample: " + JSON.stringify(flagged.map((r: { id: string; flags: string[] }) => ({ id: r.id, flags: r.flags }))) + ". Return JSON with trends, hotspots, gaps; each item has text and cited_row_ids using ONLY ids from the sample/worst lists. Select 4-6 actions is NOT needed here.";
    const a = await analystCall(prompt, key);
    let change = "";
    if (prev) {
      change = await writerCall("In 150 words explain these calculated changes for a ward officer: " + JSON.stringify(body.changes || {}), key);
    }
    const brief = { trends: cleanFindings(a.trends, valid), hotspots: cleanFindings(a.hotspots, valid), gaps: cleanFindings(a.gaps, valid), generated_by: "analyst:" + (process.env.ANALYST_MODEL || "gpt-4o") };
    if (!brief.trends.length) brief.trends = fb.trends;
    if (!brief.hotspots.length) brief.hotspots = fb.hotspots;
    if (!brief.gaps.length) brief.gaps = fb.gaps;
    return NextResponse.json({ brief, actions: fbActions, change, ai: true });
  } catch (e) {
    return NextResponse.json({ brief: { ...fb, generated_by: "fallback_template" }, actions: fbActions, change: "", ai: false, notice: "The AI service did not respond. This document used a standard template." });
  }
}
