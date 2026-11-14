# Data schema (canonical long measurement)
measurements(id, dataset_id, timestamp, location, lat, lng, pollutant, value, unit, source_file, source_row, quality_flags)
quality_flags: missing_value | invalid_value:negative | implausible_high | duplicate | unit_inconsistent
Lineage: measurement -> dataset -> analysis + source_file + source_row.
Reports versioned in report_versions. Findings link to measurement ids (evidence).
