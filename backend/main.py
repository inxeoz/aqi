"""Civic Air Quality Briefing Studio - Python backend (FastAPI).

POST /api/analyze - two-model GenAI pipeline with strict validation.
Code computes all numbers. AI only writes text.
"""
import json
import os
import subprocess
from typing import Any, Optional

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

app = FastAPI(title="aqi-studio-backend")
try:
    from app.v1 import r as v1
    app.include_router(v1)
except Exception:
    pass
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class Finding(BaseModel):
    text: str
    cited_row_ids: list[str] = Field(default_factory=list)


class AnalyzeBody(BaseModel):
    rows: list[dict[str, Any]] = Field(default_factory=list)
    role: str = "ward"
    prev: Optional[dict[str, Any]] = None
    changes: Optional[dict[str, Any]] = None


def band(pm: float) -> str:
    if pm <= 50:
        return "Good"
    if pm <= 100:
        return "Moderate"
    if pm <= 200:
        return "Poor"
    return "Very Poor"


def metrics(rows: list[dict]) -> dict:
    ok = [r for r in rows if r.get("status") != "unreliable" and r.get("value") is not None]
    vals = [float(r["value"]) for r in ok if isinstance(r.get("value"), (int, float))]
    mean = round(sum(vals) / len(vals), 1) if vals else 0
    by_loc: dict[str, list[float]] = {}
    for r in ok:
        by_loc.setdefault(str(r.get("location")), []).append(float(r["value"]))
    loc_mean = sorted(
        ({"loc": k, "mean": sum(v) / len(v), "n": len(v)} for k, v in by_loc.items()),
        key=lambda d: d["mean"],
        reverse=True,
    )
    worst = sorted(ok, key=lambda r: float(r["value"]), reverse=True)[:5]
    return {
        "total": len(rows),
        "usable": sum(1 for r in rows if r.get("status") == "usable"),
        "suspect": sum(1 for r in rows if r.get("status") == "suspect"),
        "unusable": sum(1 for r in rows if r.get("status") == "unreliable"),
        "mean": mean,
        "okCount": len(ok),
        "locMean": loc_mean,
        "worst": worst,
    }


def heuristic_brief(rows: list[dict]) -> dict:
    m = metrics(rows)
    top = m["locMean"][0] if m["locMean"] else None
    wids = [r["id"] for r in m["worst"]]
    trends, hotspots, gaps = [], [], []
    if top:
        trends.append({
            "text": f"Average reading is {m['mean']} ug/m3 across {m['okCount']} valid readings, with {top['loc']} highest at {round(top['mean'])} ug/m3 ({band(top['mean'])}).",
            "cited_row_ids": wids[:3],
        })
    if len(m["locMean"]) > 1:
        trends.append({
            "text": f"{m['locMean'][1]['loc']} is the second hotspot, below {top['loc']} but still above the average level.",
            "cited_row_ids": wids[1:4],
        })
    if not top:
        trends.append({
            "text": "No valid readings are available, so no trend can be stated.",
            "cited_row_ids": [rows[0]["id"]] if rows else [],
        })
    for i, loc in enumerate(m["locMean"][:3]):
        ids = [r["id"] for r in rows if r.get("location") == loc["loc"] and r.get("status") != "unreliable"][:2]
        hotspots.append({
            "text": f"Hotspot {i+1}: {loc['loc']} averages {round(loc['mean'])} ug/m3 over {loc['n']} readings, rated {band(loc['mean'])}.",
            "cited_row_ids": ids,
        })
    bad = [r["id"] for r in rows if r.get("status") == "unreliable"]
    if bad:
        gaps.append({
            "text": f"{len(bad)} readings are unreliable or missing and were excluded from averages; they appear as data gaps.",
            "cited_row_ids": bad[:3],
        })
    else:
        gaps.append({
            "text": f"No unreliable readings; all {len(rows)} rows passed quality checks.",
            "cited_row_ids": [r["id"] for r in rows[:2]],
        })
    sus = [r for r in rows if r.get("status") == "suspect"]
    if sus:
        gaps.append({
            "text": f"{len(sus)} readings are suspect (mixed units or sparse times) and need field verification.",
            "cited_row_ids": [r["id"] for r in sus[:3]],
        })
    return {"trends": trends, "hotspots": hotspots, "gaps": gaps, "generated_by": "heuristic_fallback"}


ROLE_CATALOG = {
    "ward": [
        "Inspect construction sites and road dust in the hotspot wards",
        "Order extra road sweeping and water sprinkling on dusty stretches",
        "Issue a public notice limiting waste burning and traffic idling",
        "Divert heavy traffic away from hotspot roads during peak hours",
        "Deploy mobile monitoring near the worst station for one week",
    ],
    "housing": [
        "Shift outdoor work by staff to morning low-pollution hours",
        "Switch to wet mopping and keep windows closed during dusty hours",
        "Run community air purifiers in common halls and lobbies",
        "Stop waste burning and compost garden waste instead",
        "Share the citizen advisory in the society group daily",
    ],
    "school": [
        "Move PE and games indoors on poor-air days",
        "Stop outdoor sports and hold morning assembly indoors",
        "Issue a mask advisory for children on the school bus route",
        "Run classroom purifiers and seal dusty windows",
        "Send the advisory note to parents every morning",
    ],
}


def actions_for(role: str, rows: list[dict]) -> list[dict]:
    items = ROLE_CATALOG.get(role, ROLE_CATALOG["ward"])
    m = metrics(rows)
    cite = [r["id"] for r in m["worst"][:2]] or [r["id"] for r in rows[:2]]
    return [{"rank": 1 if i < 2 else 2 if i < 4 else 3, "text": t, "cited_row_ids": cite} for i, t in enumerate(items[:5])]


def ai_conf() -> dict:
    return {
        "analyst": os.getenv("ANALYST_MODEL") or os.getenv("AI_MODEL") or "opencode-go/beam-free#low",
        "writer": os.getenv("WRITER_MODEL") or os.getenv("AI_MODEL") or "opencode-go/beam-free#low",
    }


def extract_text(stdout: str) -> str:
    parts = []
    for line in stdout.splitlines():
        t = line.strip()
        if not t or not t.startswith("{"):
            continue
        try:
            ev = json.loads(t)
            if ev.get("type") == "text" and isinstance(ev.get("part"), dict) and isinstance(ev["part"].get("text"), str):
                parts.append(ev["part"]["text"])
        except Exception:
            continue
    return "\n".join(parts).strip()


def strip_fences(s: str) -> str:
    t = s.strip()
    if t.startswith("```"):
        i, j = t.find("\n"), t.rfind("```")
        if i >= 0 and j > i:
            return t[i + 1:j].strip()
    return t


def opencode_run(model: str, prompt: str) -> str:
    out = subprocess.run(
        ["opencode", "run", "--model", model, "--format", "json", prompt],
        capture_output=True, text=True, timeout=15,
    )
    text = extract_text(out.stdout or "")
    if not text:
        raise RuntimeError("empty model reply")
    return text


def analyst_call(prompt: str) -> dict:
    raw = opencode_run(ai_conf()["analyst"], prompt + " Reply with JSON only, no code fences.")
    data = json.loads(strip_fences(raw))
    trends = [Finding(**f) for f in data.get("trends", [])]
    hotspots = [Finding(**f) for f in data.get("hotspots", [])]
    gaps = [Finding(**f) for f in data.get("gaps", [])]
    if not (1 <= len(trends) <= 4 and 1 <= len(hotspots) <= 4 and 1 <= len(gaps) <= 4):
        raise ValueError("analyst returned wrong counts")
    return {"trends": [t.model_dump() for t in trends], "hotspots": [h.model_dump() for h in hotspots], "gaps": [g.model_dump() for g in gaps]}


def writer_call(prompt: str) -> str:
    return opencode_run(ai_conf()["writer"], prompt)


def clean_findings(items: list[dict], valid: set) -> list[dict]:
    out = []
    for f in items or []:
        good = [i for i in (f.get("cited_row_ids") or []) if i in valid]
        if good:
            out.append({"text": f.get("text", ""), "cited_row_ids": good})
    return out


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/api/analyze")
def analyze(body: AnalyzeBody):
    rows = body.rows
    m = metrics(rows)
    valid = {r.get("id") for r in rows}
    flagged = [r for r in rows if r.get("status") != "usable"][:12]
    fb = heuristic_brief(rows)
    fb_actions = actions_for(body.role, rows)
    try:
        prompt = (
            "You are an air quality analyst. Use ONLY these calculated metrics: "
            + json.dumps({"mean": m["mean"], "locMean": m["locMean"],
                          "worst": [w.get("id") for w in m["worst"]],
                          "counts": {"total": m["total"], "usable": m["usable"], "suspect": m["suspect"], "unusable": m["unusable"]}})
            + ". Flagged sample: "
            + json.dumps([{"id": r.get("id"), "flags": r.get("flags")} for r in flagged])
            + ". Return JSON with trends, hotspots, gaps; each item has text and cited_row_ids using ONLY ids from the sample/worst lists. Select 4-6 actions is NOT needed here."
        )
        a = analyst_call(prompt)
        change = ""
        if body.prev:
            change = writer_call("In 150 words explain these calculated changes for a ward officer: " + json.dumps(body.changes or {}))
        brief = {
            "trends": clean_findings(a["trends"], valid),
            "hotspots": clean_findings(a["hotspots"], valid),
            "gaps": clean_findings(a["gaps"], valid),
            "generated_by": "analyst:" + ai_conf()["analyst"],
        }
        if not brief["trends"]:
            brief["trends"] = fb["trends"]
        if not brief["hotspots"]:
            brief["hotspots"] = fb["hotspots"]
        if not brief["gaps"]:
            brief["gaps"] = fb["gaps"]
        return {"brief": brief, "actions": fb_actions, "change": change, "ai": True}
    except Exception:
        fb["generated_by"] = "fallback_template"
        return {"brief": fb, "actions": fb_actions, "change": "", "ai": False,
                "notice": "The AI service did not respond. This document used a standard template."}
