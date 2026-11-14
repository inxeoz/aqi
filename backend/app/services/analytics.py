"""Analytics engine: pure-Python stats, no LLM."""
def stats(meas: list[dict]) -> dict:
    ok = [m for m in meas if m["value"] is not None and not any(f.startswith("invalid_value") or f in ("implausible_high", "duplicate", "missing_value", "unit_inconsistent") for f in m["quality_flags"])]
    vals = [m["value"] for m in ok]
    mean = round(sum(vals) / len(vals), 1) if vals else 0
    by = {}
    for m in ok: by.setdefault(m["location"], []).append(m["value"])
    loc = sorted(({"location": k, "mean": round(sum(v) / len(v), 1), "n": len(v), "min": min(v), "max": max(v)} for k, v in by.items()), key=lambda d: d["mean"], reverse=True)
    worst = sorted(ok, key=lambda m: m["value"], reverse=True)[:5]
    return {"mean": mean, "min": min(vals) if vals else None, "max": max(vals) if vals else None,
        "n": len(ok), "by_location": loc,
        "worst": [{"record_id": w["record_id"], "location": w["location"], "value": w["value"]} for w in worst]}

def compare(prev_stats: dict, cur_stats: dict) -> dict:
    pm = {x["location"]: x["mean"] for x in prev_stats.get("by_location", [])}
    rows = []
    for x in cur_stats.get("by_location", []):
        pv = pm.get(x["location"])
        ch = None if pv is None else round((x["mean"] - pv) / max(1e-9, pv) * 100, 1)
        rows.append({"location": x["location"], "previous": pv, "current": x["mean"],
            "change_percent": ch, "status": "new" if pv is None else ("increased" if (ch or 0) > 0 else "decreased")})
    return {"rows": rows, "previous_mean": prev_stats.get("mean"), "current_mean": cur_stats.get("mean")}
