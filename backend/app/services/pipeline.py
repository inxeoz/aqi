"""Deterministic pipeline: extraction -> transformation -> validation -> analytics."""
import hashlib, json
from . import quality as Q
from . import analytics as A

STAGES = ["uploading","extracting","interpreting","transforming","validating","geospatial","analyzing","insights"]

def file_id(name: str, content: bytes) -> str:
    return "FILE-" + hashlib.sha256(name.encode()+content).hexdigest()[:8].upper()

def analysis_id(seed: str) -> str:
    return "ANL-" + hashlib.sha256(seed.encode()).hexdigest()[:8].upper()

def extract_records(filename: str, content: bytes, text: str | None = None):
    """Return list of raw dicts + meta. Supports csv/tsv/json/txt; xlsx via openpyxl if installed."""
    name = filename.lower() if filename else ""
    out = []
    if text is not None:
        import csv, io
        rdr = csv.DictReader(io.StringIO(text))
        for r in rdr: out.append(dict(r))
        return out, {"format": "text", "rows": len(out)}
    if name.endswith(".json"):
        data = json.loads(content.decode("utf-8", "replace"))
        rows = data if isinstance(data, list) else data.get("rows", data.get("data", []))
        return [dict(r) for r in rows], {"format": "json", "rows": len(rows)}
    if name.endswith(".tsv") or name.endswith(".txt"):
        import csv, io
        sep = "\t" if name.endswith(".tsv") else None
        sample = content.decode("utf-8", "replace")
        if sep is None and "\t" in sample.splitlines()[0]: sep = "\t"
        rdr = csv.DictReader(io.StringIO(sample), delimiter=sep or ",")
        for r in rdr: out.append(dict(r))
        return out, {"format": "txt", "rows": len(out)}
    if name.endswith(".xlsx") or name.endswith(".xls"):
        try:
            import openpyxl
            import io as _io
            wb = openpyxl.load_workbook(_io.BytesIO(content), read_only=True, data_only=True)
            ws = wb.active
            rows = list(ws.rows)
            hdr = [str(c.value or "") for c in rows[0]]
            for rr in rows[1:]:
                out.append({h: ("" if c.value is None else str(c.value)) for h, c in zip(hdr, rr)})
            return out, {"format": "xlsx", "rows": len(out), "sheet": ws.title}
        except ImportError:
            raise ValueError("xlsx support needs openpyxl (pip install openpyxl)")
    # default csv
    import csv, io
    rdr = csv.DictReader(io.StringIO(content.decode("utf-8", "replace")))
    for r in rdr: out.append(dict(r))
    return out, {"format": "csv", "rows": len(out)}

def transform(records: list[dict], source_file: str) -> list[dict]:
    """Wide rows -> canonical long measurements with lineage."""
    out = []
    for i, r in enumerate(records):
        low = {k.strip().lower(): (k, v) for k, v in r.items()}
        def pick(*names):
            for n in names:
                if n in low: return low[n][1]
            return ""
        loc = pick("location","site","station","area","ward") or "Unknown"
        ts = pick("time","date","datetime","timestamp","hour","last_update") or f"T{i}"
        pol = pick("pollutant","parameter","poll","pollutant_id") or "PM2.5"
        raw = pick("value","concentration","reading","level","pm2.5","pm25","pollutant_avg")
        unit = pick("unit","units") or "ug/m3"
        try: val = None if raw == "" or raw is None else float(str(raw).strip())
        except Exception: val = None
        if isinstance(val, float) and str(val) == "nan": val = None
        out.append({"record_id": f"REC-{i+1:05d}", "timestamp": str(ts), "location": str(loc),
            "pollutant": str(pol), "value": val, "unit": str(unit or "ug/m3"),
            "averaging_period": None, "source_file_id": source_file, "source_row": i,
            "quality_flags": [], "raw": dict(r)})
    # unit-mix + duplicate + missing flags
    units = {str(m["unit"]).lower() for m in out}
    mix = any("ppm" in u or u == "ppb" for u in units) and any("ug" in u or "mg" in u for u in units)
    seen = set()
    for m in out:
        f = []
        if m["value"] is None: f.append("missing_value")
        if m["value"] is not None and m["value"] < 0: f.append("invalid_value:negative")
        if m["value"] is not None and "pm" in m["pollutant"].lower() and m["value"] > 2000: f.append("implausible_high")
        key = (m["location"], m["timestamp"], m["pollutant"], m["value"])
        if key in seen: f.append("duplicate")
        seen.add(key)
        if mix: f.append("unit_inconsistent")
        m["quality_flags"] = f
    return out

def quality_report(meas: list[dict]) -> dict:
    return Q.report(meas)

def stats(meas: list[dict]) -> dict:
    return A.stats(meas)
