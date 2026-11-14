"""Versioned REST API /api/v1 per new-spec section 5."""
import json, time, uuid
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from .services import pipeline as P, store as S, analytics as A, catalog as C

r = APIRouter(prefix="/api/v1")

class TextIn(BaseModel):
    text: str = ""
    filename: str = "pasted.csv"

    @classmethod
    def _check(cls, v: str) -> str:
        if len(v) > 2 * 1024 * 1024:
            raise ValueError("pasted text too large (2MB limit)")
        return v

def _stages(aid: str, up_to: str, detail: str = ""):
    now = time.time()
    S.bulk("pipeline", [
        {"id": aid + s, "analysis_id": aid, "stage": s,
         "state": "completed" if P.STAGES.index(s) < P.STAGES.index(up_to) else ("running" if s == up_to else "pending"),
         "updated_at": now, "detail": detail if s == up_to else ""}
        for s in P.STAGES])

def _run(aid: str, records: list[dict], fname: str):
    _stages(aid, "transforming")
    meas = P.transform(records, fname)
    S.put("datasets", {"id": aid + "DS", "analysis_id": aid, "schema_json": json.dumps(["timestamp","location","pollutant","value","unit"]), "record_count": len(meas)})
    S.bulk("measurements", [
        {"id": m["record_id"], "dataset_id": aid + "DS", "timestamp": m["timestamp"], "location": m["location"], "lat": None, "lng": None, "pollutant": m["pollutant"], "value": m["value"], "unit": m["unit"], "source_file": m["source_file_id"], "source_row": m["source_row"], "quality_flags": json.dumps(m["quality_flags"])}
        for m in meas])
    _stages(aid, "insights", f"{len(meas)} measurements")
    return meas

@r.post("/analyses")
def create_analysis():
    aid = P.analysis_id(str(time.time()) + uuid.uuid4().hex)
    S.put("analysis_sessions", {"id": aid, "status": "created", "created_at": time.time(), "completed_at": None, "user_id": "demo"})
    _stages(aid, "uploading")
    S.put("audit_logs", {"id": uuid.uuid4().hex, "user_id": "demo", "action": "create", "entity": "analysis", "entity_id": aid, "created_at": time.time()})
    return {"analysis_id": aid, "status": "created"}

@r.get("/analyses")
def list_analyses():
    return {"analyses": S.all_q("SELECT * FROM analysis_sessions ORDER BY created_at DESC LIMIT 50")}

@r.get("/analyses/{aid}")
def get_analysis(aid: str):
    a = S.one("SELECT * FROM analysis_sessions WHERE id=?", (aid,))
    if not a: raise HTTPException(404, "no such analysis")
    return a

@r.post("/analyses/{aid}/text")
def submit_text(aid: str, body: TextIn):
    if not body.text.strip(): raise HTTPException(400, "empty submission rejected")
    recs, meta = P.extract_records(body.filename, b"", body.text)
    if len(recs) > 20000: raise HTTPException(400, "too many rows (20000 limit)")
    meas = _run(aid, recs, body.filename)
    return {"analysis_id": aid, "records": len(meas), "format": meta["format"]}

@r.post("/analyses/{aid}/files")
async def upload_file(aid: str, f: UploadFile = File(...)):
    content = await f.read()
    if len(content) > 10 * 1024 * 1024: raise HTTPException(400, "file too large (10MB limit)")
    if len(content) == 0: raise HTTPException(400, "empty file rejected")
    try:
        recs, meta = P.extract_records(f.filename or "upload.csv", content)
    except ValueError as e:
        raise HTTPException(400, str(e))
    meas = _run(aid, recs, f.filename or "upload")
    return {"analysis_id": aid, "file_id": P.file_id(f.filename or "u", content), "format": meta.get("format"), "records": len(meas)}

@r.get("/analyses/{aid}/status")
def status(aid: str):
    return {"analysis_id": aid, "stages": S.all_q("SELECT stage,state,detail FROM pipeline WHERE analysis_id=?", (aid,))}

@r.get("/analyses/{aid}/events")
def events(aid: str):
    def gen():
        import json as j
        st = S.all_q("SELECT stage,state FROM pipeline WHERE analysis_id=?", (aid,))
        yield "data: " + j.dumps({"stages": st}) + "\n\n"
    return StreamingResponse(gen(), media_type="text/event-stream")

@r.get("/analyses/{aid}/datasets")
def datasets(aid: str):
    return {"datasets": S.all_q("SELECT * FROM datasets WHERE analysis_id=?", (aid,))}

@r.get("/datasets/{did}/records")
def records(did: str, page: int = 1, limit: int = 50):
    off = (page - 1) * limit
    rows = S.all_q("SELECT * FROM measurements WHERE dataset_id=? LIMIT ? OFFSET ?", (did, limit, off))
    return {"records": rows, "page": page}

@r.get("/datasets/{did}/quality")
def quality(did: str):
    rows = S.all_q("SELECT * FROM measurements WHERE dataset_id=?", (did,))
    meas = [{"value": x["value"], "quality_flags": json.loads(x["quality_flags"] or "[]"), "location": x["location"]} for x in rows]
    return P.quality_report(meas)

@r.get("/datasets/{did}/export")
def export(did: str):
    import csv, io
    rows = S.all_q("SELECT * FROM measurements WHERE dataset_id=?", (did,))
    buf = io.StringIO(); w = csv.DictWriter(buf, fieldnames=["record_id" if False else "id","timestamp","location","pollutant","value","unit","quality_flags"])
    w.writeheader()
    for x in rows: w.writerow({k: x[k] for k in ["id","timestamp","location","pollutant","value","unit","quality_flags"]})
    return StreamingResponse(iter([buf.getvalue()]), media_type="text/csv")

@r.get("/analyses/{aid}/statistics")
def statistics(aid: str):
    rows = S.all_q("SELECT * FROM measurements WHERE dataset_id=?", (aid + "DS",))
    meas = [{"value": x["value"], "quality_flags": json.loads(x["quality_flags"] or "[]"), "location": x["location"], "record_id": x["id"]} for x in rows]
    return A.stats(meas)

@r.get("/analyses/{aid}/comparison")
def comparison(aid: str, prev: str = ""):
    if not prev: return {"comparison_status": "unavailable", "reason": "no previous analysis"}
    a = S.all_q("SELECT * FROM measurements WHERE dataset_id=?", (aid + "DS",))
    b = S.all_q("SELECT * FROM measurements WHERE dataset_id=?", (prev + "DS",))
    mk = lambda rows: A.stats([{"value": x["value"], "quality_flags": json.loads(x["quality_flags"] or "[]"), "location": x["location"], "record_id": x["id"]} for x in rows])
    cur, prv = mk(a), mk(b)
    return {"comparison_status": "completed", "previous_analysis_id": prev, "current_analysis_id": aid, "changes": A.compare(prv, cur)}

class RecGen(BaseModel):
    role: str = "ward"

def _catalog_recs(aid: str, role: str, rows) -> list:
    ev = [x["id"] for x in rows[:2]]
    out = []
    for i, text in enumerate(C.for_role(role)[:5]):
        rid = uuid.uuid4().hex[:8]
        rank = 1 if i < 2 else 2 if i < 4 else 3
        S.put("recommendations", {"id": rid, "analysis_id": aid, "role": role, "rank": rank, "text": text, "evidence": json.dumps(ev), "status": "proposed"})
        out.append({"id": rid, "rank": rank, "text": text, "evidence": ev})
    return out


@r.post("/analyses/{aid}/recommendations/generate")
def gen_recs(aid: str, body: RecGen):
    rows = S.all_q("SELECT * FROM measurements WHERE dataset_id=?", (aid + "DS",))
    valid = {x["id"] for x in rows}
    try:
        from app.services import ai as ai_gateway
        import re as _re
        summ = A.stats([{"value": x["value"], "quality_flags": json.loads(x["quality_flags"] or "[]"),
                         "location": x["location"], "record_id": x["id"]} for x in rows])
        prompt = ("Propose exactly 5 actions a " + body.role + " can take based ONLY on this air-quality summary: "
                  + json.dumps(summ) + ". Reply with JSON only, no code fences: "
                  '{"actions": [{"text", "rank" (1 critical, 2 important, 3 routine), "cited_row_ids"}]}. '
                  "Use only these evidence ids: " + json.dumps(sorted(valid)[:20]) + ".")
        raw = ai_gateway.complete(prompt, kind="analyst").strip()
        if raw.startswith("```"):
            raw = raw[raw.find("\n") + 1:raw.rfind("```")].strip()
        data = json.loads(raw)
        items = (data.get("actions") or [])[:5] if isinstance(data, dict) else []
        out = []
        for a in items:
            ids = [i for i in (a.get("cited_row_ids") or []) if i in valid]
            if not ids or not str(a.get("text", "")).strip():
                continue
            rid = uuid.uuid4().hex[:8]
            rank = a.get("rank", 2) if a.get("rank") in (1, 2, 3) else 2
            S.put("recommendations", {"id": rid, "analysis_id": aid, "role": body.role, "rank": rank,
                                      "text": str(a["text"]).strip(), "evidence": json.dumps(ids), "status": "proposed"})
            out.append({"id": rid, "rank": rank, "text": str(a["text"]).strip(), "evidence": ids})
        if len(out) >= 3:
            return {"recommendations": out, "source": "ai"}
    except Exception:
        pass
    return {"recommendations": _catalog_recs(aid, body.role, rows), "source": "catalog_fallback"}

@r.get("/analyses/{aid}/recommendations")
def list_recs(aid: str):
    return {"recommendations": S.all_q("SELECT * FROM recommendations WHERE analysis_id=?", (aid,))}

class RepGen(BaseModel):
    kind: str = "internal"; lang: str = "en"; level: str = "general"

@r.post("/analyses/{aid}/reports/generate")
def gen_rep(aid: str, body: RepGen):
    rid = uuid.uuid4().hex[:8]
    S.put("reports", {"id": rid, "analysis_id": aid, "kind": body.kind, "lang": body.lang, "level": body.level, "status": "draft"})
    content = f"# {body.kind} ({body.lang}/{body.level}) for {aid}\n\nGenerated from validated measurements. Vulnerable groups: children, older adults, sensitive people — see citizen advisory.\n"
    S.put("report_versions", {"id": uuid.uuid4().hex[:8], "report_id": rid, "version": 1, "content": content, "created_at": time.time()})
    return {"report_id": rid, "version": 1}

@r.get("/reports/{rid}/versions")
def rep_versions(rid: str):
    return {"versions": S.all_q("SELECT * FROM report_versions WHERE report_id=? ORDER BY version", (rid,))}
