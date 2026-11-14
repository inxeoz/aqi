"""Unit tests: transformation, validation, analytics, catalog."""
import os
os.environ["AQI_DB"] = "/tmp/aqi-test.db"
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.services import pipeline as P, quality as Q, analytics as A, catalog as C

RAW = [
    {"location": "A", "time": "t1", "pollutant": "PM2.5", "value": "100", "unit": "ug/m3"},
    {"location": "A", "time": "t2", "pollutant": "PM2.5", "value": "", "unit": "ug/m3"},
    {"location": "B", "time": "t1", "pollutant": "PM2.5", "value": "-5", "unit": "ug/m3"},
    {"location": "B", "time": "t1", "pollutant": "PM2.5", "value": "-5", "unit": "ug/m3"},
    {"location": "C", "time": "t1", "pollutant": "PM2.5", "value": "0.1", "unit": "ppm"},
]

def test_transform_flags():
    meas = P.transform(RAW, "f.csv")
    by = {(m["location"], m["source_row"]): m["quality_flags"] for m in meas}
    assert by[("A", 0)] == ["unit_inconsistent"]  # whole file mixes ppm/ug
    assert "missing_value" in by[("A", 1)]
    assert "invalid_value:negative" in by[("B", 2)]
    assert "duplicate" in by[("B", 3)]
    assert "unit_inconsistent" in by[("C", 4)]

def test_missing_never_zero():
    meas = P.transform(RAW, "f.csv")
    assert meas[1]["value"] is None

def test_quality_report_counts():
    meas = P.transform(RAW, "f.csv")
    rep = Q.report(meas)
    assert rep["total_records"] == 5
    assert rep["missing_values"] == 1
    assert rep["duplicate_records"] == 1
    assert rep["unknown_units"] == 5  # mixed ppm/ug flags all rows
    assert any(i["type"] == "missing_value" for i in rep["issues"])

def test_stats_excludes_bad():
    clean = [dict(r, unit="ug/m3") for r in RAW if r["unit"] == "ug/m3"]
    st = A.stats(P.transform(clean, "f.csv"))
    assert st["n"] == 1 and st["mean"] == 100  # negative/dup/missing excluded
    st2 = A.stats(P.transform(RAW, "f.csv"))
    assert st2["n"] == 0  # mixed ppm/ug file: nothing averaged together

def test_compare():
    cur = {"mean": 120, "by_location": [{"location": "A", "mean": 120}]}
    prv = {"mean": 100, "by_location": [{"location": "A", "mean": 100}]}
    out = A.compare(prv, cur)
    assert out["rows"][0]["change_percent"] == 20.0
    assert out["rows"][0]["status"] == "increased"

def test_catalog_roles_differ():
    assert C.for_role("ward") != C.for_role("school")
    assert len(C.for_role("ward")) == 5
