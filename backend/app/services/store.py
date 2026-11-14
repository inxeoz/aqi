"""SQLite store for analysis sessions (stdlib only, WAL mode)."""
import sqlite3, json, time, os

DB = os.getenv("AQI_DB", os.path.join(os.path.dirname(__file__), "..", "..", "aqi.db"))

SCHEMA = """
PRAGMA journal_mode=WAL;
CREATE TABLE IF NOT EXISTS analysis_sessions(id TEXT PRIMARY KEY, status TEXT, created_at REAL, completed_at REAL, user_id TEXT);
CREATE TABLE IF NOT EXISTS datasets(id TEXT PRIMARY KEY, analysis_id TEXT, schema_json TEXT, record_count INTEGER);
CREATE TABLE IF NOT EXISTS measurements(id TEXT PRIMARY KEY, dataset_id TEXT, timestamp TEXT, location TEXT, lat REAL, lng REAL, pollutant TEXT, value REAL, unit TEXT, source_file TEXT, source_row INTEGER, quality_flags TEXT);
CREATE TABLE IF NOT EXISTS findings(id TEXT PRIMARY KEY, analysis_id TEXT, kind TEXT, text TEXT, evidence TEXT, confidence REAL);
CREATE TABLE IF NOT EXISTS recommendations(id TEXT PRIMARY KEY, analysis_id TEXT, role TEXT, rank INTEGER, text TEXT, evidence TEXT, status TEXT);
CREATE TABLE IF NOT EXISTS reports(id TEXT PRIMARY KEY, analysis_id TEXT, kind TEXT, lang TEXT, level TEXT, status TEXT);
CREATE TABLE IF NOT EXISTS report_versions(id TEXT PRIMARY KEY, report_id TEXT, version INTEGER, content TEXT, created_at REAL);
CREATE TABLE IF NOT EXISTS pipeline(id TEXT PRIMARY KEY, analysis_id TEXT, stage TEXT, state TEXT, updated_at REAL, detail TEXT);
CREATE TABLE IF NOT EXISTS audit_logs(id TEXT PRIMARY KEY, user_id TEXT, action TEXT, entity TEXT, entity_id TEXT, created_at REAL);
"""

def conn():
    c = sqlite3.connect(DB)
    c.executescript(SCHEMA)
    return c

def put(table, row: dict):
    c = conn()
    cols = ",".join(row.keys()); qs = ",".join("?" for _ in row)
    c.execute(f"INSERT OR REPLACE INTO {table}({cols}) VALUES({qs})", list(row.values()))
    c.commit(); c.close()

def all_q(sql, args=()):
    c = conn(); r = c.execute(sql, args).fetchall()
    cols = [d[0] for d in c.execute(sql, args).description] if r else []
    c.close()
    return [dict(zip(cols, x)) for x in r]

def one(sql, args=()):
    r = all_q(sql, args)
    return r[0] if r else None
