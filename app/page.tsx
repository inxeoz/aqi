"use client";
import { useEffect, useMemo, useRef, useState } from 'react';
import Papa from 'papaparse';
import { buildRows, metrics, heuristicBrief, actionsFor, buildInternalDoc, buildCitizenDoc, STR, BAND, bandColor, SAMPLE_CSV } from '@/lib/aqi';
import type { Row, Brief, Action } from '@/lib/aqi';

const STEPS = ["DATA", "QUALITY", "BRIEF", "ACTIONS", "CHANGES", "DOCUMENTS"];
const ROLES = [{ id: "ward", label: "Ward Officer" }, { id: "housing", label: "Housing Society" }, { id: "school", label: "School" }];

type ChatMsg = { from: string; text: string };
type SavedRun = { id: string; time: string; scope: string; mean: number; top: string; rows: Row[] };
export default function Studio() {
  const [paste, setPaste] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
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
  const [lang, setLang] = useState("en");
  const [level, setLevel] = useState("general");
  const [chat, setChat] = useState<ChatMsg[]>([{ from: "studio", text: "Paste data or upload a file, then press Confirm and check quality." }]);
  const [cmd, setCmd] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const live = useMemo(() => rows.filter(r => !excluded.has(r.id)), [rows, excluded]);
  const m = useMemo(() => metrics(live), [live]);
  function ingest(records: Record<string, string>[], sourceNote: string) {
    const built = buildRows(records);
    setRows(built); setExcluded(new Set()); setBrief(null); setActions([]);
    setChangeText(""); setChangeRows([]); setStep(0); setAiState("idle"); setNotice("");
    setChat(c => [...c, { from: "studio", text: "Loaded " + built.length + " readings from " + sourceNote + ". Press Confirm and check quality." }]);
  }
  function parsePasted() {
    if (!paste.trim()) return;
    try {
      const parsed = Papa.parse<Record<string, string>>(paste.trim(), { header: true, skipEmptyLines: true });
      ingest((parsed.data || []) as Record<string, string>[], "pasted table");
    } catch (e) { setImgMsg("Could not read the pasted table."); }
  }
  function loadSample() {
    const parsed = Papa.parse<Record<string, string>>(SAMPLE_CSV, { header: true, skipEmptyLines: true });
    ingest((parsed.data || []) as Record<string, string>[], "messy sample");
  }
  async function onFile(f: File) {
    setImgMsg(""); setPdfNote(false);
    const name = f.name.toLowerCase();
    if (name.endsWith(".pdf")) {
      try {
        const buf = await f.arrayBuffer();
        const mod = await import("unpdf");
        const pdf = await (mod as { getDocumentProxy: (d: unknown) => Promise<unknown> }).getDocumentProxy(new Uint8Array(buf));
        const out = await (mod as { extractText: (p: unknown, o: unknown) => Promise<{ text: string }> }).extractText(pdf, { mergePages: true });
        const text = (out.text || "").trim();
        if (!text) { setImgMsg("Cannot read table. Paste the data or upload a CSV file."); return; }
        setPaste(text); setPdfNote(true);
        setChat(c => [...c, { from: "studio", text: "PDF text extracted. Check the table below, fix it if needed, then press Use pasted table." }]);
      } catch (e) { setImgMsg("Cannot read table. Paste the data or upload a CSV file."); }
      return;
    }
    if (name.endsWith(".xls") || name.endsWith(".xlsx")) {
      const buf = await f.arrayBuffer();
      const XLSX = await import("xlsx");
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      ingest(XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: "" }), f.name);
      return;
    }
    const text = await f.text();
    if (name.endsWith(".tsv")) {
      const parsed = Papa.parse<Record<string, string>>(text, { header: true, delimiter: "\t", skipEmptyLines: true });
      ingest((parsed.data || []) as Record<string, string>[], f.name);
    } else {
      const parsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });
      ingest((parsed.data || []) as Record<string, string>[], f.name);
    }
  }
  async function writeBrief() {
    if (!live.length) return;
    setAiState("work"); setNotice("");
    const scope = [...new Set(live.map(r => r.location))].sort().join(", ");
    let prev: SavedRun | null = null;
    try { prev = JSON.parse(localStorage.getItem("cas-runs") || "[]").filter((r: SavedRun) => r.scope === scope).slice(-1)[0] || null; } catch (e) { prev = null; }
    try {
      const res = await fetch("/api/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows: live, role, prev: prev ? { mean: prev.mean, top: prev.top } : null }) });
      if (!res.ok) throw new Error("http " + res.status);
      const data = await res.json();
      setBrief(data.brief); setActions(data.actions && data.actions.length ? data.actions : actionsFor(role, live));
      if (data.change) setChangeText(data.change);
      setAiState(data.ai ? "ok" : "down");
      if (data.notice) setNotice(data.notice);
      if (!data.ai && !data.notice) setNotice("The AI service is not available. Showing the standard template instead.");
      setStep(2);
    } catch (e) {
      setBrief(heuristicBrief(live)); setActions(actionsFor(role, live));
      setAiState("down"); setNotice("The AI service is not available. Showing the standard template instead.");
      setStep(2);
    }
  }
  function switchRole(r: string) {
    setRole(r);
    if (live.length) setActions(actionsFor(r, live));
    setChat(c => [...c, { from: "you", text: "Make this for a " + r }, { from: "studio", text: "Role set to " + r + ". Action list updated." }]);
    if (step >= 2) setStep(3);
  }
  function saveAndCompare() {
    const scope = [...new Set(live.map(r => r.location))].sort().join(", ");
    let all: SavedRun[] = [];
    try { all = JSON.parse(localStorage.getItem("cas-runs") || "[]"); } catch (e) { all = []; }
    const prevs = all.filter(r => r.scope === scope);
    const prev = prevs.slice(-1)[0] || null;
    const cur = { id: "R" + Date.now(), time: new Date().toISOString(), scope, mean: m.mean, top: m.locMean[0] ? m.locMean[0].loc : "-", rows: live };
    const curMean = m.mean;
    if (prev) {
      const prevMap = new Map<string, number>();
      const pm = metrics(prev.rows);
      pm.locMean.forEach(l => prevMap.set(l.loc, l.mean));
      const rows2 = m.locMean.map(l => {
        const pv = prevMap.has(l.loc) ? prevMap.get(l.loc) as number : null;
        return { loc: l.loc, prev: pv == null ? null : Math.round(pv * 10) / 10, cur: Math.round(l.mean * 10) / 10 };
      });
      setChangeRows(rows2);
      const up = rows2.filter(r => r.prev != null && ((r.cur as number) - (r.prev as number)) / Math.max(1, r.prev as number) >= 0.15);
      const dn = rows2.filter(r => r.prev != null && ((r.prev as number) - (r.cur as number)) / Math.max(1, r.prev as number) >= 0.15);
      setChangeText("Mean moved from " + prev.mean + " to " + curMean + " ug/m3. " + up.length + " locations rose by 15% or more (" + up.map(r => r.loc).join(", ") + "). " + dn.length + " locations fell by 15% or more (" + dn.map(r => r.loc).join(", ") + "). Worst area is now " + (m.locMean[0] ? m.locMean[0].loc : "-") + ", before it was " + prev.top + ". Unusable readings: " + m.unusable + ".");
    } else {
      setChangeRows(m.locMean.map(l => ({ loc: l.loc, prev: null, cur: Math.round(l.mean * 10) / 10 })));
      setChangeText("This is the first brief for this area. No previous brief exists, so there is nothing to compare yet.");
    }
    localStorage.setItem("cas-runs", JSON.stringify([...all, cur].slice(-20)));
    setStep(4);
  }
  function sendCmd() {
    const t = cmd.toLowerCase(); if (!t.trim()) return;
    setChat(c => [...c, { from: "you", text: cmd }]);
    const low = t;
    if (low.includes("school")) switchRole("school");
    else if (low.includes("hous")) switchRole("housing");
    else if (low.includes("ward") || low.includes("officer")) switchRole("ward");
    if (low.includes("hindi")) { setLang("hi"); setDocType("citizen"); setStep(5); }
    if (low.includes("english")) setLang("en");
    if (low.includes("child")) { setLevel("child"); setDocType("citizen"); setStep(5); }
    if (low.includes("easy")) setLevel("easy_read");
    if (low.includes("citizen")) { setDocType("citizen"); setStep(5); }
    if (low.includes("internal")) { setDocType("internal"); setStep(5); }
    if (low.includes("compar") || low.includes("change") || low.includes("diff")) saveAndCompare();
    if (low.includes("brief") || low.includes("analy")) writeBrief();
    if (low.includes("confirm") || low.includes("quality")) setStep(1);
    setCmd("");
  }
  const docText = useMemo(() => {
    if (!brief) return "";
    return docType === "internal" ? buildInternalDoc(live, brief, actions, changeText, lang, level) : buildCitizenDoc(live, brief, actions, lang, level);
  }, [brief, actions, docType, lang, level, live, changeText]);
  function download() {
    const blob = new Blob([docText], { type: "text/markdown" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = docType + "-" + lang + "-" + level + ".md";
    a.click();
  }
  function cites(f: { cited_row_ids: string[] }, key: string) {
    return (<span key={key}>{f.cited_row_ids.map(id => (<button key={key + id} className="chip" style={{ marginRight: 4 }} onClick={() => { setFlash(id); setStep(0); setTimeout(() => setFlash(""), 2500); }}>[{id}]</button>))}</span>);
  }
  const s = STR[lang] || STR.en;
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <header style={{ height: 48, background: "#fff", borderBottom: "1px solid #D9D6CF", display: "flex", alignItems: "center", padding: "0 16px", gap: 12 }}>
        <strong>Civic Air Quality Briefing Studio</strong>
        <span style={{ color: "#666" }}>Pune Municipal Corporation</span>
        <span style={{ flex: 1 }} />
        <span className="mono" style={{ fontSize: 12 }}>Run History: {(() => { try { return JSON.parse(localStorage.getItem("cas-runs") || "[]").length; } catch (e) { return 0; } })()} runs</span>
      </header>
      {aiState === "down" && (<div style={{ background: "#FFF3CD", borderBottom: "1px solid #D9D6CF", padding: "8px 16px" }}>The AI service is not available. You can see your data and the quality report. <button className="btn" style={{ marginLeft: 8 }} onClick={writeBrief}>Retry</button></div>)}
      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <aside style={{ width: "35%", borderRight: "1px solid #D9D6CF", background: "#fff", display: "flex", flexDirection: "column", minHeight: "calc(100vh - 48px)" }}>
          <div style={{ padding: 12, borderBottom: "1px solid #D9D6CF" }}>
            <div onClick={() => fileRef.current && fileRef.current.click()} style={{ border: "1px dashed #0B5D66", borderRadius: 6, padding: 16, textAlign: "center", cursor: "pointer" }}>Drop a CSV, Excel, or text PDF here, or click to browse</div>
            <input ref={fileRef} type="file" accept=".csv,.tsv,.txt,.xls,.xlsx,.pdf" style={{ display: "none" }} onChange={e => { const f = e.target.files && e.target.files[0]; if (f) onFile(f); }} />
            <textarea value={paste} onChange={e => setPaste(e.target.value)} rows={5} placeholder="Or paste the data table here (CSV with header row)..." style={{ width: "100%", marginTop: 8, border: "1px solid #D9D6CF", borderRadius: 4, padding: 8, fontFamily: "monospace", fontSize: 12 }} />
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button className="btn btn-primary" onClick={parsePasted}>Use pasted table</button>
              <button className="btn" onClick={loadSample}>Load messy sample</button>
            </div>
            {imgMsg && (<div style={{ marginTop: 8, color: "#C62828" }}>{imgMsg}</div>)}
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: 12 }}>
            {chat.map((msg, i) => (<div key={i} style={{ marginBottom: 8, background: msg.from === "you" ? "#F7F6F3" : "#fff", border: "1px solid #D9D6CF", borderRadius: 4, padding: "6px 8px" }}><strong>{msg.from === "you" ? "You" : "Studio"}: </strong>{msg.text}</div>))}
          </div>
          <div style={{ padding: 12, borderTop: "1px solid #D9D6CF", display: "flex", gap: 8 }}>
            <input value={cmd} onChange={e => setCmd(e.target.value)} onKeyDown={e => { if (e.key === "Enter") sendCmd(); }} placeholder='Try "Make this for a school"' style={{ flex: 1, border: "1px solid #D9D6CF", borderRadius: 4, padding: "6px 8px" }} />
            <button className="btn btn-primary" onClick={sendCmd}>Send</button>
          </div>
        </aside>
        <main style={{ width: "65%", padding: 16, overflowY: "auto" }}>
          <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 12 }}>
            {STEPS.map((st, i) => (<span key={st} style={{ display: "flex", alignItems: "center", gap: 6 }}><span className={"stepdot" + (i <= step ? " on" : "")}>{i + 1}</span><button onClick={() => setStep(i)} style={{ fontSize: 12, fontWeight: i === step ? 700 : 400 }}>{st}</button>{i < STEPS.length - 1 && <span style={{ color: "#999" }}>-</span>}</span>))}
          </div>
          {step === 0 && (<div className="gov-card" style={{ padding: 0, overflow: "hidden" }}>
            {pdfNote && (<div style={{ background: "#FFF3CD", padding: "8px 12px", borderBottom: "1px solid #D9D6CF" }}>Source was a PDF. Check the extracted table below before you continue.</div>)}
            {!rows.length && (<div style={{ padding: 24, color: "#666" }}>No data yet. Paste a table, upload a file, or load the messy sample.</div>)}
            {rows.length > 0 && (<div style={{ maxHeight: 480, overflow: "auto" }}><table className="gov-table"><thead><tr><th>Row</th><th>Location</th><th>Time</th><th>Pollutant</th><th>Value</th><th>Unit</th><th>Flags</th></tr></thead><tbody>
              {rows.map(r => (<tr key={r.id} className={"zebra" + (flash === r.id ? " flash" : "")} id={"row-" + r.id}><td className="mono">{r.id}</td><td>{r.location}</td><td>{r.time}</td><td>{r.pollutant}</td><td className="mono">{r.value == null || Number.isNaN(r.value) ? "-" : r.value}</td><td>{r.unit}</td><td>{r.flags.length ? r.flags.join(", ") : "-"}</td></tr>))}
            </tbody></table></div>)}
            {rows.length > 0 && (<div style={{ padding: 12 }}><button className="btn btn-primary" onClick={() => setStep(1)}>Confirm and check quality</button></div>)}
          </div>)}
          {step === 1 && (<div>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              {[["Total", m.total, "#1A1A1A"], ["Usable", m.usable, "#2E7D32"], ["Suspect", m.suspect, "#F9A825"], ["Unusable", m.unusable, "#C62828"]].map(([label, n, c]) => (<div key={label as string} className="gov-card" style={{ flex: 1, padding: 12 }}><div style={{ fontSize: 12, color: "#666" }}>{label}</div><div className="mono" style={{ fontSize: 24, color: c as string }}>{n}</div></div>))}
            </div>
            <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
              {["ALL", "MISSING_VALUE", "NEGATIVE_VALUE", "IMPLAUSIBLE_HIGH", "UNIT_INCONSISTENT", "DUPLICATE_ROW", "STALE_GAP"].map(f => (<button key={f} className="chip" onClick={() => setFlagFilter(f)} style={flagFilter === f ? { borderColor: "#0B5D66", color: "#0B5D66" } : {}}>{f}</button>))}
            </div>
            <div className="gov-card" style={{ overflow: "hidden" }}><div style={{ maxHeight: 380, overflow: "auto" }}><table className="gov-table"><thead><tr><th>Row</th><th>Location</th><th>Value</th><th>Flags</th><th>Status</th></tr></thead><tbody>
              {live.filter(r => flagFilter === "ALL" || r.flags.includes(flagFilter)).map(r => (<tr key={r.id} className="zebra" onClick={() => setDrawer(r)} style={{ cursor: "pointer" }}><td className="mono">{r.id}</td><td>{r.location}</td><td className="mono">{r.value == null || Number.isNaN(r.value) ? "-" : r.value}</td><td style={{ fontSize: 11 }}>{r.flags.join(", ") || "-"}</td><td>{r.status}</td></tr>))}
            </tbody></table></div></div>
            {drawer && (<div className="gov-card" style={{ marginTop: 8, padding: 12 }}><strong>{drawer.id} - {drawer.location}</strong><div style={{ fontSize: 12, color: "#666" }}>{JSON.stringify(drawer.raw)}</div><div style={{ marginTop: 8 }}><button className="btn" onClick={() => { setExcluded(new Set([...excluded, drawer.id])); setDrawer(null); }}>Exclude this row</button><button className="btn" style={{ marginLeft: 8 }} onClick={() => setDrawer(null)}>Close</button></div></div>)}
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button className="btn btn-primary" onClick={writeBrief} disabled={aiState === "work"}>{aiState === "work" ? "Writing..." : "Write brief"}</button>
              <button className="btn" onClick={saveAndCompare}>Save run and compare</button>
            </div>
            {notice && (<div style={{ marginTop: 8, background: "#FFF3CD", border: "1px solid #D9D6CF", borderRadius: 4, padding: "8px 12px" }}>{notice}</div>)}
          </div>)}
          {step === 2 && brief && (<div>
            {[{ t: "Trends", L: brief.trends }, { t: "Hotspots", L: brief.hotspots }, { t: "Data Gaps", L: brief.gaps }].map(sec => (<div key={sec.t} style={{ marginBottom: 12 }}><h3 style={{ fontWeight: 700, marginBottom: 6 }}>{sec.t}</h3>{sec.L.map((f, i) => (<div key={i} className="gov-card" style={{ padding: 10, marginBottom: 6 }}><div>{f.text}</div><div style={{ marginTop: 6 }}>{cites(f, sec.t + i)}</div></div>))}</div>))}
            <div style={{ fontSize: 12, color: "#666" }}>generated_by: {brief.generated_by}</div>
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}><button className="btn btn-primary" onClick={() => setStep(3)}>See actions</button></div>
          </div>)}
          {step === 3 && (<div>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              {ROLES.map(r => (<button key={r.id} className="btn" style={role === r.id ? { borderColor: "#0B5D66", color: "#0B5D66" } : {}} onClick={() => switchRole(r.id)}>{r.label}</button>))}
            </div>
            {actions.map((a, i) => (<div key={i} className="gov-card" style={{ padding: 10, marginBottom: 6, display: "flex", gap: 10 }}><div style={{ width: 14, borderRadius: 2, background: a.rank === 1 ? "#0B5D66" : a.rank === 2 ? "#EF6C00" : "#999" }} /><div><div>Priority {a.rank}: {a.text}</div><div style={{ marginTop: 6 }}>{cites(a, "a" + i)}</div></div></div>))}
            <div style={{ marginTop: 8 }}><button className="btn btn-primary" onClick={saveAndCompare}>Save run and compare</button></div>
          </div>)}
          {step === 4 && (<div className="gov-card" style={{ padding: 12 }}>
            <h3 style={{ fontWeight: 700, marginBottom: 8 }}>Previous vs This Brief</h3>
            {changeRows.length > 0 && (<table className="gov-table" style={{ marginBottom: 12 }}><thead><tr><th>Location</th><th>Previous</th><th></th><th>This brief</th></tr></thead><tbody>
              {changeRows.map(r => { const d = r.prev == null ? 0 : (r.cur as number) - (r.prev as number); const up = d > 0; return (<tr key={r.loc} className="zebra"><td>{r.loc}</td><td className="mono">{r.prev == null ? "-" : r.prev}</td><td style={{ color: r.prev == null ? "#999" : up ? "#C62828" : "#2E7D32", fontWeight: 700 }}>{r.prev == null ? "-" : up ? "Up" : "Down"}</td><td className="mono">{r.cur}</td></tr>); })}
            </tbody></table>)}
            <p>{changeText || "Save a run to see the comparison."}</p>
            <div style={{ marginTop: 8 }}><button className="btn btn-primary" onClick={() => setStep(5)}>Make documents</button></div>
          </div>)}
          {step === 5 && (<div>
            <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
              <div>{["internal", "citizen"].map(t => (<button key={t} className="btn" style={{ marginRight: 6, ...(docType === t ? { borderColor: "#0B5D66", color: "#0B5D66" } : {}) }} onClick={() => setDocType(t)}>{t === "internal" ? s.internal : s.citizen}</button>))}</div>
              <div>{["en", "hi"].map(l => (<button key={l} className="btn" style={{ marginRight: 6, ...(lang === l ? { borderColor: "#0B5D66", color: "#0B5D66" } : {}) }} onClick={() => setLang(l)}>{l === "en" ? "English" : "Hindi"}</button>))}</div>
              <div>{["general", "child", "easy_read"].map(l => (<button key={l} className="btn" style={{ marginRight: 6, ...(level === l ? { borderColor: "#0B5D66", color: "#0B5D66" } : {}) }} onClick={() => setLevel(l)}>{l}</button>))}</div>
            </div>
            <div className="gov-card" style={{ padding: 24, background: "#fff" }}>
              <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: 14 }}>{docText || "Write a brief first, then the document appears here."}</pre>
            </div>
            {docType === "citizen" && brief && (<div style={{ fontSize: 12, color: "#666", marginTop: 6 }}>Vulnerable-group sections are present and use the fixed template when the AI service is down.</div>)}
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}><button className="btn btn-primary" onClick={download}>Download Markdown</button><button className="btn" onClick={() => window.print()}>Print / PDF</button></div>
            {notice && (<div style={{ marginTop: 8, background: "#FFF3CD", border: "1px solid #D9D6CF", borderRadius: 4, padding: "8px 12px" }}>{notice}</div>)}
          </div>)}
        </main>
      </div>
    </div>
  );
}
