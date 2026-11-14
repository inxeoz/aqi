# Backend (Python FastAPI)

## Run (uv-managed venv)
```
cd backend
uv venv .venv
uv pip install --python .venv/bin/python -r requirements.txt
cp .env.example .env   # fill model names
.venv/bin/uvicorn main:app --port 8000
```
Notes:
- This project uses `uv` (there is no `pip` module here), so installs go through
  `uv pip install --python .venv/bin/python`.
- No need to `activate` the venv; call binaries directly via `.venv/bin/...`.
- Alternative one-liner without a venv: `uv run --with fastapi --with uvicorn --with pydantic --with httpx --with openpyxl uvicorn main:app --port 8000`

## Endpoints
- GET /health -> {"ok": true}
- POST /api/analyze {rows, role, prev, changes} -> {brief, actions, change, ai, notice?}

The frontend calls this URL via NEXT_PUBLIC_BACKEND_URL.
Code computes all numbers. AI only writes text.

## AI gateway: Adaption (ADPAPI)
- Analyst + writer calls go through `app/services/ai.py` -> Adaption `POST /api/v1/responses` (SDK `adaption`).
- Set `ADAPTION_API_KEY` in `backend/.env` (never commit it). Optional: `ANALYST_MODEL`, `WRITER_MODEL`, `ADAPTION_MODEL` (default `qwen3.5-397b`), `ADAPTION_BASE_URL`.
- Without a key, the backend falls back to the `opencode run` CLI; without either, it serves the heuristic template with a yellow banner.

## New: versioned API /api/v1 (new-spec section 5)
Modular services in `app/services/` (ingestion, extraction, transformation, validation,
geospatial stub, analytics, insights via /api/analyze, recommendations catalog, comparison, reports).
Store: SQLite WAL (`aqi.db`, stdlib only) with analysis_sessions, datasets, measurements
(canonical long schema + lineage), findings, recommendations, reports + report_versions, pipeline, audit_logs.
Docs: `docs/architecture.md`, `docs/api.md`, `docs/data-schema.md`.
Smoke test: `uv run --with fastapi --with httpx --with openpyxl python tests_v1.py`
