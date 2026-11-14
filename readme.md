# Civic Air Quality Briefing Studio

## 1. Chosen vertical
Civic air quality briefings for ward teams. Users: Ward Officer, Housing Society, School.

The app turns raw air tables into local actions. It flags bad data. It writes short summaries. Each claim links to source rows.

## 2. Approach and logic
- Code computes all numbers. AI only writes text.
- Chat + Canvas layout. Left side is input and chat. Right side shows data, quality, brief, actions, changes, documents, map.
- Degraded state: if AI fails, tables and metrics stay on screen with a yellow banner. Heuristic brief takes over.
- Traceability: every finding has `cited_row_ids`. Code checks each ID. Bad IDs are removed.

## 3. How the solution works
Repo layout: `frontend/` is the Next.js app. `backend/` is the Python FastAPI service. All AI APIs live in the backend.

## How to run both services

You need two terminals. The frontend calls the backend, so start the backend first.

**1. Backend (terminal 1):**
```bash
cd backend
uv venv .venv
uv pip install --python .venv/bin/python -r requirements.txt
cp .env.example .env   # fill in model names
.venv/bin/uvicorn main:app --port 8000
```
(Uses `uv`; there is no `pip` module in this setup, so installs go through
`uv pip install --python .venv/bin/python`. No `activate` needed.)
Check it: open http://127.0.0.1:8000/health (expect `{"ok": true}`).
Versioned API lives under `/api/v1` (see `docs/api.md`).

**2. Frontend (terminal 2):**
```bash
cd frontend
npm install
cp .env.example .env.local   # set NEXT_PUBLIC_BACKEND_URL=http://127.0.0.1:8000
npm run dev
```
Open http://localhost:3000.

**Stop:** press `Ctrl+C` in each terminal.
1. DATA (CSV only): paste a CSV table, upload a .csv file, load messy sample, or press Load full snapshot (570 stations). App assigns Row IDs like R0001. Accepted: CSV, TSV, TXT, JSON, XLSX (sheet 1), pasted tables; PDF text is best-effort with user confirm; scanned/image PDFs and JPG/PNG are refused with a message. Backend mirrors this in POST /api/v1/analyses/{id}/files + /text.
2. QUALITY: counts Usable / Suspect / Unusable. Flags: MISSING_VALUE, NEGATIVE_VALUE, IMPLAUSIBLE_HIGH, UNIT_INCONSISTENT, DUPLICATE_ROW, STALE_GAP. Click a row for detail. Exclude rows if needed.
3. BRIEF: press Write brief. Analyst model returns trends, hotspots, gaps as JSON. Click [R0001] to jump to the source row.
4. ACTIONS: switch role. Each role gets 5 actions from a fixed catalog with priority 1-3.
5. CHANGES: Save run and compare stores runs in localStorage. Shows Previous vs This brief table and a short change text.
6. DOCUMENTS: Internal Briefing Note vs Citizen Advisory. English/Hindi. Levels: general, child, easy_read. Citizen doc always has sections for children, older adults, sensitive people. Download as Markdown or Print/PDF.
7. MAP: 570 stations on OpenStreetMap. Dot color shows PM2.5. Click for city, station, values, effect radius. Filters: ALL, POOR+, SEVERE, MISSING. Toggle effect area. Base radius slider 1-20 km.

## 4. Assumptions
- Values are in ug/m3 unless the unit column says ppm/ppb. Mixed units raise UNIT_INCONSISTENT.
- One snapshot file `aqi-2026-11-14-0100.csv` is one hour: 14-11-2026 01:00. No trend across time unless the user saves two runs.
- Missing avg values mean sensor offline, not zero. They are excluded from means.
- PM2.5 drives the map color and the effect radius. Bands: Good <=50, Moderate <=100, Poor <=200, Very Poor >200.
- Runs and history live in browser localStorage. The versioned backend API (`/api/v1`) also persists sessions, datasets, measurements, recommendations, and versioned reports in SQLite (`backend/aqi.db`, ignored by git).

## 5. Changes and updates in the deployed version
- Added MAP step with Leaflet + OpenStreetMap. No API key needed.
- Added `public/stations.json` (570 stations with lat/long, PM2.5, PM10) built from `resource/aqi-2026-11-14-0100.csv`.
- Added Load full snapshot button. It maps station to location, last_update to time, pollutant_id to pollutant, pollutant_avg to value.
- Added effect area circles. Radius = base radius x severity factor (<=60: x0.5, 61-120: x1, 121-250: x2, 250+: x3). Toggle show/hide. Base radius slider 1-20 km, default 5 km.
- Fixed map re-init crash (Map container is already initialized) by keeping the Leaflet map in a ref and calling remove() on cleanup.
- Added leaflet 1.9.4 and react-leaflet 5.0.0 to dependencies.
- Added `.env.example` with key names only. Real keys stay in `.env.local` (ignored).
- AI route now runs through the `opencode run` CLI instead of direct OpenAI HTTP. Model names come from env, with free-tier defaults.

## 6. Gen AI services utilized
- Runner: `opencode run --model <name> --format json` from `backend/main.py` (`POST /api/analyze`). The old Next.js route is removed; the frontend calls the backend through `frontend/lib/backend.ts`.
- Analyst model (env `ANALYST_MODEL`, fallback `AI_MODEL`, default `opencode-go/beam-free#low`): reads only calculated metrics (mean, location means, worst IDs) plus a sample of flagged rows. Returns strict JSON validated by Zod: trends, hotspots, gaps, each with text and cited_row_ids. Used in the BRIEF step.
- Writer model (env `WRITER_MODEL`, fallback `AI_MODEL`, default `opencode-go/beam-free#low`): writes the 150-word change summary for a ward officer in the CHANGES step. Used only for wording, not numbers.
- Where AI is NOT used: means, ranks, bands, flags, effect radius, document structure, vulnerable-group fixed templates. All computed in `lib/aqi.ts`.
- Fallback: if the runner fails, `heuristicBrief()` and `actionsFor()` render a template brief with generated_by heuristic_fallback and a yellow banner. The app stays usable.
