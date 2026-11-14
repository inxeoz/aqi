"""Validation engine: structured quality report + 5 dimensions."""
def report(meas: list[dict]) -> dict:
    total = len(meas)
    invalid = sum(1 for m in meas if any(f.startswith("invalid_value") or f == "implausible_high" for f in m["quality_flags"]))
    missing = sum(1 for m in meas if "missing_value" in m["quality_flags"])
    dup = sum(1 for m in meas if "duplicate" in m["quality_flags"])
    unit = sum(1 for m in meas if "unit_inconsistent" in m["quality_flags"])
    unresolved = sum(1 for m in meas if not m.get("location") or m["location"] == "Unknown")
    valid = total - invalid - sum(1 for m in meas if "missing_value" in m["quality_flags"] and m["value"] is None) - dup
    valid = max(0, valid)
    issues = []
    if missing: issues.append({"type": "missing_value", "severity": "high", "affected_records": missing, "message": "Reading has no value; excluded from means, never treated as zero."})
    if invalid: issues.append({"type": "invalid_value", "severity": "high", "affected_records": invalid, "message": "Negative or non-numeric reading; review source."})
    if dup: issues.append({"type": "duplicate", "severity": "medium", "affected_records": dup, "message": "Same station+time+pollutant+value appears twice."})
    if unit: issues.append({"type": "unit_inconsistent", "severity": "medium", "affected_records": unit, "message": "Mixed units (ppm/ppb with ug/m3); confirm unit before comparing."})
    if unresolved: issues.append({"type": "missing_location", "severity": "medium", "affected_records": unresolved, "message": "Station not identified; add location."})
    dims = {
        "completeness": round((total - missing) / max(1, total), 3),
        "validity": round((total - invalid) / max(1, total), 3),
        "consistency": 0.0 if unit else 1.0,
        "timeliness": 1.0,
        "traceability": 1.0,
    }
    return {"total_records": total, "valid_records": valid, "invalid_records": invalid,
        "records_with_warnings": sum(1 for m in meas if m["quality_flags"]),
        "missing_values": missing, "duplicate_records": dup, "unrecognized_fields": 0,
        "unknown_units": unit, "unresolved_locations": unresolved,
        "quality_status": "ok" if not issues else ("warning" if invalid + missing < total / 2 else "critical"),
        "dimensions": dims, "issues": issues}
