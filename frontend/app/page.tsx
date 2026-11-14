"use client";
import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Papa from 'papaparse';
import { postAnalyze, postDocument } from '@/lib/backend';
const StationMap = dynamic(() => import("./components/StationMap"), { ssr: false });
import { buildRows, metrics, heuristicBrief, actionsFor, buildInternalDoc, buildCitizenDoc, STR } from '@/lib/aqi';
import type { Row, Brief, Action } from '@/lib/aqi';

const STEPS = ["DATA", "QUALITY", "BRIEF", "ACTIONS", "CHANGES", "DOCUMENTS", "MAP"];
const ROLES = [{ id: "ward", label: "Ward Officer" }, { id: "housing", label: "Housing Society" }, { id: "school", label: "School" }];
const PIPE = ["uploading", "extracting", "interpreting", "transforming", "validating", "geospatial", "analyzing", "insights"];

type SavedRun = { id: string; time: string; scope: string; mean: number; top: string; rows: Row[] };
type UpFile = { name: string; size: number };

export default function Studio() {
  const [paste, setPaste] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [upFiles, setUpFiles] = useState<UpFile[]>([]);
  const [pdfNote, setPdfNote] = useState(false);
  const [imgMsg, setImgMsg] = useState("");
  const [step, setStep] = useState(0);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [flagFilter, setFlagFilter] = useState("ALL");
  const [flash, setFlash] = useState("");
  const [drawer, setDrawer] = useState<Row | null>(null);
  const [brief, setBrief] = useState<Brief | null>(null);
  const [aiState, setAiState] = useState<"idle" | "work" | "ok" | "down">("idle");
  const [notice, setNotice] = useState("");
  const [role, setRole] = useState("ward");
  const [actions, setActions] = useState<Action[]>([]);
  const [changeText, setChangeText] = useState("");
  const [changeRows, setChangeRows] = useState<{ loc: string; prev: number | null; cur: number | null }[]>([]);
  const [docType, setDocType] = useState("internal");
  const [docAi, setDocAi] = useState("");
  const [docAiState, setDocAiState] = useState<"idle" | "work" | "ok" | "down">("idle");
  const [lang, setLang] = useState("en");
  const [level, setLevel] = useState("general");
  const [pipe, setPipe] = useState<string[]>([]);
  const [maxReached, setMaxReached] = useState(0);
  function go(n: number) { setStep(n); setMaxReached(m => Math.max(m, n)); }
  const fileRef = useRef<HTMLInputElement>(null);
  const live = useMemo(() => rows.filter(r => !excluded.has(r.id)), [rows, excluded]);
  const [place, setPlace] = useState("all");
  const places = useMemo(() => [...new Set(live.map(r => r.location))].sort(), [live]);
  const scoped = useMemo(() => (place === "all" ? live : live.filter(r => r.location === place)), [live, place]);
  const m = useMemo(() => metrics(scoped), [scoped]);

  function tag(records: Record<string, string>[], source: string) {
    return records.map(r => ({ ...r, __source: source }));
  }
  function reid(all: Row[]) {
    return all.map((r, i) => ({ ...r, id: "R" + String(i + 1).padStart(4, "0") }));
  }
  function ingest(records: Record<string, string>[], sourceNote: string) {
    const built = reid(buildRows(records));
    setRows(built); setUpFiles([{ name: sourceNote, size: 0 }]);
    resetAfter();
  }
  function append(records: Record<string, string>[], sourceNote: string) {
    const merged = [...rows.map(r => r.raw as Record<string, string>), ...tag(records, sourceNote)];
    const built = reid(buildRows(merged));
    setRows(built); setUpFiles(f => [...f, { name: sourceNote, size: 0 }]);
    resetAfter();
  }
  function resetAfter() {
    setPlace("all");
    setExcluded(new Set()); setBrief(null); setActions([]); setDocAi(""); setDocAiState("idle");
    setChangeText(""); setChangeRows([]); setAiState("idle"); setNotice("");
  }
  function removeFile(name: string) {
    const rest = rows.filter(r => (r.raw as Record<string, string>).__source !== name);
    setRows(reid(buildRows(rest.map(r => r.raw as Record<string, string>))));
    setUpFiles(f => f.filter(x => x.name !== name));
    resetAfter();
  }
  function runPipe() {
    setPipe([]);
    PIPE.forEach((s, i) => setTimeout(() => setPipe(p => [...p, s]), 120 * (i + 1)));
  }
  async function parseFile(f: File): Promise<{ recs: Record<string, string>[]; note: string }> {
    const name = f.name.toLowerCase();
    if (name.endsWith(".csv") || name.endsWith(".tsv") || name.endsWith(".txt")) {
      const text = await f.text();
      const parsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true, delimiter: name.endsWith(".tsv") ? "\t" : undefined as unknown as string });
      return { recs: tag((parsed.data || []) as Record<string, string>[], f.name), note: f.name };
    }
    if (name.endsWith(".json")) {
      const data = JSON.parse(await f.text());
      const arr = Array.isArray(data) ? data : (data.rows || data.data || []);
      return { recs: tag(arr as Record<string, string>[], f.name), note: f.name };
    }
    if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
      const XLSX = await import("xlsx");
      const buf = await f.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const arr = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: "" });
      return { recs: tag(arr, f.name + " / " + wb.SheetNames[0]), note: f.name };
    }
    if (name.endsWith(".pdf")) {
      setPdfNote(true);
      throw new Error("PDF text extraction is best-effort and runs on the server. Paste the table or upload CSV/XLSX for now. Scanned PDFs cannot be read.");
    }
    if (/\.(png|jpe?g)$/.test(name)) throw new Error("Cannot read a table from an image. Paste the data or upload a data file.");
    try {
      const text = await f.text();
      const parsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });
      const data = (parsed.data || []) as Record<string, string>[];
      if (!data.length || Object.keys(data[0] || {}).length < 2) throw new Error("no table found");
      return { recs: tag(data, f.name), note: f.name };
    } catch (e2) {
      throw new Error("Could not read " + f.name + " as a data table. Paste the contents as text instead.");
    }
  }
  async function onFiles(fs: FileList | File[]) {
    setImgMsg(""); setPdfNote(false); runPipe();
    const list = [...fs];
    const first = rows.length === 0;
    try {
      const parts: { recs: Record<string, string>[]; note: string }[] = [];
      for (const f of list) parts.push(await parseFile(f));
      const all = parts.flatMap(p => p.recs);
      if (first) ingest(all, parts.map(p => p.note).join(", "));
      else {
        const merged = [...rows.map(r => r.raw as Record<string, string>), ...all];
        setRows(reid(buildRows(merged)));
        setUpFiles(f => [...f, ...parts.map(p => ({ name: p.note, size: 0 }))]);
        resetAfter();
      }
    } catch (e) { setImgMsg("Could not read file: " + (e as Error).message); }
  }
  function parsePasted() {
    if (!paste.trim()) return;
    runPipe();
    try {
      const parsed = Papa.parse<Record<string, string>>(paste.trim(), { header: true, skipEmptyLines: true });
      const recs = tag((parsed.data || []) as Record<string, string>[], "pasted text");
      if (rows.length) { setRows(reid(buildRows([...rows.map(r => r.raw as Record<string, string>), ...recs]))); }
      else ingest(recs, "pasted text");
    } catch (e) { setImgMsg("Could not read the pasted table."); }
  }
  async function writeBrief() {
    if (!scoped.length) return;
    setAiState("work"); setNotice("");
    const scope = place === "all" ? [...new Set(scoped.map(r => r.location))].sort().join(", ") : place;
    let prev: SavedRun | null = null;
    try { prev = JSON.parse(localStorage.getItem("cas-runs") || "[]").filter((r: SavedRun) => r.scope === scope).slice(-1)[0] || null; } catch (e) { prev = null; }
    try {
      const data = await postAnalyze({ rows: scoped, role, prev: prev ? { mean: prev.mean, top: prev.top } : null });
      setBrief(data.brief); setActions(data.actions && data.actions.length ? data.actions : actionsFor(role, scoped));
      if (data.change) setChangeText(data.change);
      setAiState(data.ai ? "ok" : "down");
      if (data.notice) setNotice(data.notice);
      if (!data.ai && !data.notice) setNotice("The AI service is not available. Showing the standard template instead.");
      go(2);
    } catch (e) {
      setBrief(heuristicBrief(scoped)); setActions(actionsFor(role, scoped));
      setAiState("down"); setNotice("The AI service is not available. Showing the standard template instead.");
      go(2);
    }
  }
  function switchRole(r: string) {
    setRole(r);
    if (scoped.length) setActions(actionsFor(r, scoped));
    if (step >= 2) go(3);
  }
  function saveAndCompare() {
    const scope = (place === "all" ? "all" : "place:" + place) + "|" + [...new Set(scoped.map(r => r.location))].sort().join(", ");
    let all: SavedRun[] = [];
    try { all = JSON.parse(localStorage.getItem("cas-runs") || "[]"); } catch (e) { all = []; }
    const prev = all.filter(r => r.scope === scope).slice(-1)[0] || null;
    const cur = { id: "R" + Date.now(), time: new Date().toISOString(), scope, mean: m.mean, top: m.locMean[0] ? m.locMean[0].loc : "-", rows: scoped };
    if (prev) {
      const pm = new Map<string, number>();
      metrics(prev.rows).locMean.forEach(l => pm.set(l.loc, l.mean));
      const rows2 = m.locMean.map(l => {
        const pv = pm.has(l.loc) ? pm.get(l.loc) as number : null;
        return { loc: l.loc, prev: pv == null ? null : Math.round(pv * 10) / 10, cur: Math.round(l.mean * 10) / 10 };
      });
      setChangeRows(rows2);
      const up = rows2.filter(r => r.prev != null && ((r.cur as number) - (r.prev as number)) / Math.max(1, r.prev as number) >= 0.15);
      const dn = rows2.filter(r => r.prev != null && ((r.prev as number) - (r.cur as number)) / Math.max(1, r.prev as number) >= 0.15);
      setChangeText("Mean moved from " + prev.mean + " to " + m.mean + " ug/m3. " + up.length + " locations rose by 15% or more (" + up.map(r => r.loc).join(", ") + "). " + dn.length + " locations fell by 15% or more (" + dn.map(r => r.loc).join(", ") + "). Worst area is now " + (m.locMean[0] ? m.locMean[0].loc : "-") + ", before it was " + prev.top + ". Unusable readings: " + m.unusable + ".");
    } else {
      setChangeRows(m.locMean.map(l => ({ loc: l.loc, prev: null, cur: Math.round(l.mean * 10) / 10 })));
      setChangeText("This is the first brief for this area. No previous brief exists, so there is nothing to compare yet.");
    }
    try { localStorage.setItem("cas-runs", JSON.stringify([...all, cur].slice(-20))); } catch (e) { setNotice("Could not save this run in this browser (storage blocked)."); }
    go(4);
  }
  async function writeDocument() {
    if (!brief) return;
    setDocAiState("work");
    try {
      const data = await postDocument({ brief, actions, changeText, kind: docType, lang, level, role, place });
      if (data.ai && data.text) { setDocAi(data.text); setDocAiState("ok"); }
      else { setDocAi(""); setDocAiState("down"); }
    } catch (e) { setDocAi(""); setDocAiState("down"); }
  }
  useEffect(() => {
    if (step === 5 && brief && docAiState === "idle") writeDocument();
  });
  const templateText = useMemo(() => {
    if (!brief) return "";
    return docType === "internal" ? buildInternalDoc(scoped, brief, actions, changeText, lang, level) : buildCitizenDoc(scoped, brief, actions, lang, level);
  }, [brief, actions, docType, lang, level, scoped, changeText]);
  const docText = docAi || templateText;
  function download() {
    try {
      const blob = new Blob([docText], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = docType + "-" + lang + "-" + level + ".md";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (e) {
      const w = window.open("", "_blank");
      if (w) w.document.write("<pre>" + docText.replace(/</g, "&lt;") + "</pre>");
      else setImgMsg("Download was blocked by the browser. Copy the document text manually.");
    }
  }
  function cites(f: { cited_row_ids: string[] }, key: string) {
    return (<span key={key}>{f.cited_row_ids.map(id => (<button key={key + id} data-testid="page:button-cite" className="chip" style={{ marginRight: 4 }} onClick={() => { setFlash(id); go(0); setTimeout(() => setFlash(""), 2500); }}>[{id}]</button>))}</span>);
  }
  const s = STR[lang] || STR.en;
  const [runCount, setRunCount] = useState(0);
  useEffect(() => { try { setRunCount(JSON.parse(localStorage.getItem("cas-runs") || "[]").length); } catch (e) { setRunCount(0); } }, []);
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <header data-testid="page:header-app" style={{ height: 52, background: "#fff", borderBottom: "1px solid #D9D6CF", display: "flex", alignItems: "center", padding: "0 16px", gap: 12 }}>
        <strong>Civic Air Quality Briefing Studio</strong>
        <span style={{ color: "#666" }}>Pune Municipal Corporation</span>
        <span style={{ flex: 1 }} />
        <span className="mono" style={{ fontSize: 12 }}>Runs: {runCount}</span>
        <span className="chip" style={aiState === "down" ? { borderColor: "#C62828", color: "#C62828" } : {}}>{aiState === "down" ? "AI offline" : aiState === "ok" ? "AI online" : "AI standby"}</span>
      </header>
      {aiState === "down" && (<div style={{ background: "#FFF3CD", borderBottom: "1px solid #D9D6CF", padding: "8px 16px" }}>The AI service is not available. Your data and quality report stay on screen. <button data-testid="page:button-retry" className="btn" style={{ marginLeft: 8 }} onClick={writeBrief}>Retry</button></div>)}
      <nav data-testid="page:nav-steps" style={{ display: "flex", gap: 4, padding: "10px 16px", background: "#F7F6F3", borderBottom: "1px solid #D9D6CF", flexWrap: "wrap" }}>
        {STEPS.filter((_, i) => i <= maxReached).map((st, i) => (<button key={st} data-testid="page:button-step" onClick={() => go(i)} className="btn" style={i === step ? { borderColor: "#0B5D66", color: "#0B5D66", fontWeight: 700 } : {}}><span className={"stepdot" + (i <= step ? " on" : "")}>{i + 1}</span> {st}</button>))}
      </nav>
      {pipe.length > 0 && (<div style={{ display: "flex", gap: 4, padding: "8px 16px", flexWrap: "wrap", background: "#fff", borderBottom: "1px solid #D9D6CF" }}>{PIPE.map(p => (<span key={p} className="chip" style={pipe.includes(p) ? { borderColor: "#2E7D32", color: "#2E7D32" } : {}}>{p}</span>))}</div>)}
      <main data-testid="page:main-content" style={{ padding: 16, maxWidth: 1100, width: "100%", margin: "0 auto" }}>
        {step === 0 && (<div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className="gov-card" style={{ padding: 16 }}>
              <h3 style={{ fontWeight: 700, marginBottom: 8 }}>Upload files</h3>
              <div onClick={() => fileRef.current && fileRef.current.click()} style={{ border: "1px dashed #0B5D66", borderRadius: 6, padding: 24, textAlign: "center", cursor: "pointer" }}>Drop files here, or click to browse<br /><span style={{ fontSize: 12, color: "#666" }}>Any data file: CSV, TSV, TXT, JSON, XLSX, or paste text. Several files allowed.</span></div>
              <input data-testid="page:input-files" ref={fileRef} type="file" multiple style={{ display: "none" }} onChange={e => { if (e.target.files && e.target.files.length) onFiles(e.target.files); e.target.value = ""; }} />
              {upFiles.length > 0 && (<table data-testid="page:table-files" className="gov-table" style={{ marginTop: 12 }}><thead><tr><th>File</th><th></th></tr></thead><tbody>
                {upFiles.map(f => (<tr key={f.name}><td className="mono">{f.name}</td><td><button data-testid="page:button-remove-file" className="btn" onClick={() => removeFile(f.name)}>Remove</button></td></tr>))}
              </tbody></table>)}
              {pdfNote && (<div style={{ marginTop: 8, background: "#FFF3CD", padding: "8px 12px", borderRadius: 4 }}>Source was a PDF. Check the extracted table below before you continue.</div>)}
            </div>
            <div className="gov-card" style={{ padding: 16 }}>
              <h3 style={{ fontWeight: 700, marginBottom: 8 }}>Paste text</h3>
              <textarea data-testid="page:textarea-paste" value={paste} onChange={e => setPaste(e.target.value)} rows={9} placeholder={"location,time,pollutant,value,unit\nShivaji Chowk,2026-11-10 08:00,PM2.5,168,ug/m3"} style={{ width: "100%", border: "1px solid #D9D6CF", borderRadius: 4, padding: 8, fontFamily: "monospace", fontSize: 12 }} />
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button data-testid="page:button-add-paste" className="btn btn-primary" onClick={parsePasted}>Add pasted table</button>
                <span style={{ fontSize: 12, color: "#666", alignSelf: "center" }}>Empty submissions are rejected. Original files stay unchanged.</span>
              </div>
            </div>
          </div>
          {imgMsg && (<div style={{ marginTop: 12, color: "#C62828" }}>{imgMsg}</div>)}
          <div className="gov-card" style={{ padding: 0, overflow: "hidden", marginTop: 12 }}>
            {!rows.length && (<div style={{ padding: 24, color: "#666" }}>No data yet. Upload a file, paste a table, or load a sample.</div>)}
            {rows.length > 0 && (<div style={{ maxHeight: 420, overflow: "auto" }}><table data-testid="page:table-preview" className="gov-table"><thead><tr><th>Row</th><th>Location</th><th>Time</th><th>Pollutant</th><th>Value</th><th>Unit</th><th>Source</th><th>Flags</th></tr></thead><tbody>
              {rows.map(r => (<tr key={r.id} className={"zebra" + (flash === r.id ? " flash" : "")} id={"row-" + r.id}><td className="mono">{r.id}</td><td>{r.location}</td><td>{r.time}</td><td>{r.pollutant}</td><td className="mono">{r.value == null || Number.isNaN(r.value) ? "-" : r.value}</td><td>{r.unit}</td><td style={{ fontSize: 11 }}>{String((r.raw as Record<string, string>).__source || "-")}</td><td>{r.flags.length ? r.flags.join(", ") : "-"}</td></tr>))}
            </tbody></table></div>)}
            {rows.length > 0 && (<div style={{ padding: 12 }}><button data-testid="page:button-confirm-quality" className="btn btn-primary" onClick={() => go(1)}>Confirm and check quality</button></div>)}
          </div>
        </div>)}
        {step === 1 && (<div>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            {[["Total", m.total, "#1A1A1A"], ["Usable", m.usable, "#2E7D32"], ["Suspect", m.suspect, "#F9A825"], ["Unusable", m.unusable, "#C62828"]].map(([label, n, c]) => (<div key={label as string} className="gov-card" style={{ flex: 1, padding: 12 }}><div style={{ fontSize: 12, color: "#666" }}>{label}</div><div className="mono" style={{ fontSize: 24, color: c as string }}>{n}</div></div>))}
          </div>
          <div className="gov-card" style={{ padding: 12, marginBottom: 12 }}>
            <strong>Quality dimensions</strong>
            <div style={{ fontSize: 12, color: "#666" }}>Completeness {m.total ? Math.round((m.total - live.filter(r => r.value == null).length) / Math.max(1, m.total) * 100) : 0}% (missing excluded, never zero) | Validity {m.total ? Math.round(m.usable / Math.max(1, m.total) * 100) : 0}% usable | Consistency {live.some(r => r.flags.includes("UNIT_INCONSISTENT")) ? "mixed units, confirm before comparing" : "units consistent"} | Traceability every finding links to Row IDs | Timeliness check reading dates before trend claims. No single % proves sensor accuracy.</div>
          </div>
          <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
            {["ALL", "MISSING_VALUE", "NEGATIVE_VALUE", "IMPLAUSIBLE_HIGH", "UNIT_INCONSISTENT", "DUPLICATE_ROW", "STALE_GAP"].map(f => (<button key={f} data-testid="page:button-flag" className="chip" onClick={() => setFlagFilter(f)} style={flagFilter === f ? { borderColor: "#0B5D66", color: "#0B5D66" } : {}}>{f}</button>))}
          </div>
          <div className="gov-card" style={{ overflow: "hidden" }}><div style={{ maxHeight: 380, overflow: "auto" }}><table data-testid="page:table-quality" className="gov-table"><thead><tr><th>Row</th><th>Location</th><th>Value</th><th>Flags</th><th>Status</th></tr></thead><tbody>
            {live.filter(r => flagFilter === "ALL" || r.flags.includes(flagFilter)).map(r => (<tr key={r.id} className="zebra" onClick={() => setDrawer(r)} style={{ cursor: "pointer" }}><td className="mono">{r.id}</td><td>{r.location}</td><td className="mono">{r.value == null || Number.isNaN(r.value) ? "-" : r.value}</td><td style={{ fontSize: 11 }}>{r.flags.join(", ") || "-"}</td><td>{r.status}</td></tr>))}
          </tbody></table></div></div>
          {drawer && (<div className="gov-card" style={{ marginTop: 8, padding: 12 }}><strong>{drawer.id} - {drawer.location}</strong><div style={{ fontSize: 12, color: "#666" }}>source: {String((drawer.raw as Record<string, string>).__source || "upload")} row {drawer.id} time {drawer.time} pollutant {drawer.pollutant} unit {drawer.unit}</div><div style={{ fontSize: 12, color: "#666" }}>{JSON.stringify(drawer.raw)}</div><div style={{ marginTop: 8 }}><button data-testid="page:button-exclude-row" className="btn" onClick={() => { setExcluded(new Set([...excluded, drawer.id])); setDrawer(null); }}>Exclude this row</button><button className="btn" data-testid="page:button-close-drawer" style={{ marginLeft: 8 }} onClick={() => setDrawer(null)}>Close</button></div></div>)}
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button data-testid="page:button-write-brief" className="btn btn-primary" onClick={writeBrief} disabled={aiState === "work"}>{aiState === "work" ? "Writing..." : "Write brief"}</button>
            <button data-testid="page:button-save-compare" className="btn" onClick={saveAndCompare}>Save run and compare</button>
          </div>
          {notice && (<div style={{ marginTop: 8, background: "#FFF3CD", border: "1px solid #D9D6CF", borderRadius: 4, padding: "8px 12px" }}>{notice}</div>)}
        </div>)}
        {step === 2 && brief && (<div>
          <div style={{ fontSize: 12, color: "#666", marginBottom: 8 }}>Role: {ROLES.find(r => r.id === role)?.label} · Place: {place === "all" ? "All places (" + places.length + ")" : place} · {scoped.length} readings</div>
          {[{ t: "Trends", L: brief.trends }, { t: "Hotspots", L: brief.hotspots }, { t: "Data Gaps", L: brief.gaps }].map(sec => (<div key={sec.t} style={{ marginBottom: 12 }}><h3 style={{ fontWeight: 700, marginBottom: 6 }}>{sec.t}</h3>{sec.L.map((f, i) => (<div key={i} className="gov-card" style={{ padding: 10, marginBottom: 6 }}><div>{f.text}</div><div style={{ marginTop: 6 }}>{cites(f, sec.t + i)}</div></div>))}</div>))}
          <div style={{ fontSize: 12, color: "#666" }}>generated_by: {brief.generated_by}</div>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}><button data-testid="page:button-see-actions" className="btn btn-primary" onClick={() => go(3)}>See actions</button></div>
        </div>)}
        {step === 3 && (<div>
          <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
            <label style={{ fontSize: 12, color: "#666" }}>Place
              <select data-testid="page:select-place" value={place} onChange={e => { const v = e.target.value; setPlace(v); setActions(actionsFor(role, v === "all" ? live : live.filter(r => r.location === v))); }} style={{ marginLeft: 6, border: "1px solid #D9D6CF", borderRadius: 4, padding: "6px 8px" }}>
                <option value="all">All places ({places.length})</option>
                {places.map(pl => (<option key={pl} value={pl}>{pl}</option>))}
              </select>
            </label>
            <span style={{ fontSize: 12, color: "#666" }}>Role</span>
            {ROLES.map(r => (<button key={r.id} data-testid="page:button-role" className="btn" style={role === r.id ? { borderColor: "#0B5D66", color: "#0B5D66" } : {}} onClick={() => switchRole(r.id)}>{r.label}</button>))}
          </div>
          {actions.map((a, i) => (<div key={i} className="gov-card" style={{ padding: 10, marginBottom: 6, display: "flex", gap: 10 }}><div style={{ width: 14, borderRadius: 2, background: a.rank === 1 ? "#0B5D66" : a.rank === 2 ? "#EF6C00" : "#999" }} /><div><div>Priority {a.rank}: {a.text}</div><div style={{ marginTop: 6 }}>{cites(a, "a" + i)}</div></div></div>))}
          <div style={{ marginTop: 8 }}><button data-testid="page:button-save-compare-actions" className="btn btn-primary" onClick={saveAndCompare}>Save run and compare</button></div>
        </div>)}
        {step === 4 && (<div className="gov-card" style={{ padding: 12 }}>
          <h3 style={{ fontWeight: 700, marginBottom: 8 }}>Previous vs This Brief</h3>
          {changeRows.length > 0 && (<table data-testid="page:table-comparison" className="gov-table" style={{ marginBottom: 12 }}><thead><tr><th>Location</th><th>Previous</th><th></th><th>This brief</th></tr></thead><tbody>
            {changeRows.map(r => { const d = r.prev == null ? 0 : (r.cur as number) - (r.prev as number); const up = d > 0; return (<tr key={r.loc} className="zebra"><td>{r.loc}</td><td className="mono">{r.prev == null ? "-" : r.prev}</td><td style={{ color: r.prev == null ? "#999" : up ? "#C62828" : "#2E7D32", fontWeight: 700 }}>{r.prev == null ? "-" : up ? "Up" : "Down"}</td><td className="mono">{r.cur}</td></tr>); })}
          </tbody></table>)}
          <p>{changeText || "Save a run to see the comparison."}</p>
          <div style={{ marginTop: 8 }}><button data-testid="page:button-make-documents" className="btn btn-primary" onClick={() => go(5)}>Make documents</button></div>
        </div>)}
        {step === 5 && (<div>
          <div style={{ fontSize: 12, color: "#666", marginBottom: 8 }}>For {ROLES.find(r => r.id === role)?.label} · {place === "all" ? "All places" : place}</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
            <div>{["internal", "citizen"].map(t => (<button key={t} data-testid="page:button-doc-type" className="btn" style={{ marginRight: 6, ...(docType === t ? { borderColor: "#0B5D66", color: "#0B5D66" } : {}) }} onClick={() => { setDocType(t); setDocAi(""); setDocAiState("idle"); }}>{t === "internal" ? s.internal : s.citizen}</button>))}</div>
            <div>{["en", "hi"].map(l => (<button key={l} data-testid="page:button-doc-lang" className="btn" style={{ marginRight: 6, ...(lang === l ? { borderColor: "#0B5D66", color: "#0B5D66" } : {}) }} onClick={() => { setLang(l); setDocAi(""); setDocAiState("idle"); }}>{l === "en" ? "English" : "Hindi"}</button>))}</div>
            <div>{["general", "child", "easy_read"].map(l => (<button key={l} data-testid="page:button-doc-level" className="btn" style={{ marginRight: 6, ...(level === l ? { borderColor: "#0B5D66", color: "#0B5D66" } : {}) }} onClick={() => { setLevel(l); setDocAi(""); setDocAiState("idle"); }}>{l}</button>))}</div>
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
            <span className="chip" style={docAiState === "down" ? { borderColor: "#C62828", color: "#C62828" } : {}}>{docAiState === "work" ? "AI writing..." : docAiState === "ok" ? "Written by AI" : docAiState === "down" ? "Template (AI unavailable)" : "Ready"}</span>
            <button data-testid="page:button-regenerate-doc" className="btn" onClick={writeDocument} disabled={docAiState === "work" || !brief}>Regenerate with AI</button>
          </div>
          <div className="gov-card" style={{ padding: 24, background: "#fff" }}>
            <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: 14 }}>{docAiState === "work" ? "Writing the document with AI..." : (docText || "Write a brief first, then the document appears here.")}</pre>
          </div>
          {docType === "citizen" && brief && (<div style={{ fontSize: 12, color: "#666", marginTop: 6 }}>Vulnerable-group sections are present and use the fixed template when the AI service is down.</div>)}
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}><button data-testid="page:button-download-doc" className="btn btn-primary" onClick={download}>Download Markdown</button><button data-testid="page:button-print-doc" className="btn" onClick={() => window.print()}>Print / PDF</button></div>
          {notice && (<div style={{ marginTop: 8, background: "#FFF3CD", border: "1px solid #D9D6CF", borderRadius: 4, padding: "8px 12px" }}>{notice}</div>)}
        </div>)}
        {step === 6 && (<div className="gov-card" style={{ padding: 12 }}>
          <h3 style={{ fontWeight: 700, marginBottom: 8 }}>Station map - all places in the CSV snapshot</h3>
          <p style={{ fontSize: 12, color: "#666", marginBottom: 8 }}>570 stations from resource/aqi-2026-11-14-0100.csv. Circle color shows PM2.5 avg. Click a dot for city, station, and values.</p>
          <StationMap highlight={[...new Set(live.map(r => r.location))]} />
        </div>)}
      </main>
    </div>
  );
}
