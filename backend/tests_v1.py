"""Smoke tests for /api/v1 (stdlib + fastapi TestClient)."""
from fastapi.testclient import TestClient
from main import app
c = TestClient(app)
a = c.post("/api/v1/analyses").json()["analysis_id"]
print("analysis", a)
r = c.post(f"/api/v1/analyses/{a}/text", json={"text": "location,time,pollutant,value,unit\nA,2026-11-10 08:00,PM2.5,168,ug/m3\nB,2026-11-10 08:00,PM2.5,,ug/m3\n", "filename": "t.csv"}).json()
print("ingest", r)
did = a + "DS"
print("quality", c.get(f"/api/v1/datasets/{did}/quality").json()["total_records"])
print("stats", c.get(f"/api/v1/analyses/{a}/statistics").json()["mean"])
print("recs", len(c.post(f"/api/v1/analyses/{a}/recommendations/generate", json={"role": "school"}).json()["recommendations"]))
print("rep", c.post(f"/api/v1/analyses/{a}/reports/generate", json={"kind": "citizen", "lang": "hi", "level": "child"}).json())
print("status stages", len(c.get(f"/api/v1/analyses/{a}/status").json()["stages"]))
print("ALL OK")
