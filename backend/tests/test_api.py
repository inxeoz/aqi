"""API tests: v1 flow + legacy analyze fallback (no AI key set)."""
import os
os.environ.pop("ADAPTION_API_KEY", None)
os.environ.pop("ADPAPI", None)
os.environ["AQI_DB"] = "/tmp/aqi-test.db"
if os.path.exists("/tmp/aqi-test.db"):
    os.remove("/tmp/aqi-test.db")
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from fastapi.testclient import TestClient
from main import app

c = TestClient(app)

def test_health():
    assert c.get("/health").json() == {"ok": True}

def test_full_flow():
    aid = c.post("/api/v1/analyses").json()["analysis_id"]
    r = c.post(f"/api/v1/analyses/{aid}/text",
               json={"text": "location,time,pollutant,value,unit\nA,t1,PM2.5,100,ug/m3\nB,t1,PM2.5,,ug/m3\n",
                     "filename": "t.csv"}).json()
    assert r["records"] == 2
    did = aid + "DS"
    q = c.get(f"/api/v1/datasets/{did}/quality").json()
    assert q["total_records"] == 2 and q["missing_values"] == 1
    assert c.get(f"/api/v1/analyses/{aid}/statistics").json()["mean"] == 100
    recs = c.post(f"/api/v1/analyses/{aid}/recommendations/generate", json={"role": "school"}).json()
    assert len(recs["recommendations"]) == 5
    rep = c.post(f"/api/v1/analyses/{aid}/reports/generate",
                 json={"kind": "citizen", "lang": "hi", "level": "child"}).json()
    assert rep["version"] == 1
    assert len(c.get(f"/api/v1/analyses/{aid}/status").json()["stages"]) == 8
    cmp0 = c.get(f"/api/v1/analyses/{aid}/comparison").json()
    assert cmp0["comparison_status"] == "unavailable"

def test_rejects():
    aid = c.post("/api/v1/analyses").json()["analysis_id"]
    assert c.post(f"/api/v1/analyses/{aid}/text", json={"text": "  ", "filename": "t.csv"}).status_code == 400
    assert c.post(f"/api/v1/analyses/{aid}/files", files={"f": ("e.csv", b"")}).status_code == 400

def test_legacy_analyze_fallback_no_key():
    body = {"rows": [{"id": "R0001", "location": "A", "time": "t", "pollutant": "PM2.5",
                       "value": 100, "unit": "ug/m3", "status": "usable", "flags": []}],
            "role": "ward"}
    d = c.post("/api/analyze", json=body).json()
    assert d["brief"]["generated_by"]  # adaption, opencode, or fallback_template
    cites = [cid for sec in ("trends", "hotspots", "gaps") for f in d["brief"][sec] for cid in f["cited_row_ids"]]
    assert cites and set(cites) <= {"R0001"}  # every citation must exist
