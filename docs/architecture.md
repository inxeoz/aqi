# Architecture (new-spec)
Frontend (Next.js Chat+Canvas) -> Backend FastAPI `/api/v1` -> pipeline services
(ingestion/extraction/transformation/validation/geospatial/analytics/insights/recommendations/comparison/reports)
-> SQLite (WAL) store. Rule: Python computes numbers; AI only writes text with cited IDs validated in code.
Pipeline stages: uploading, extracting, interpreting, transforming, validating, geospatial, analyzing, insights.
Live status via GET /api/v1/analyses/{id}/status (poll) and /events (SSE).
