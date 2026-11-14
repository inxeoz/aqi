# API /api/v1
POST /analyses | GET /analyses | GET /analyses/{id}
POST /analyses/{id}/files (csv,tsv,json,txt,xlsx) | POST /analyses/{id}/text
GET /analyses/{id}/status | GET /analyses/{id}/events (SSE)
GET /analyses/{id}/datasets | GET /datasets/{id}/records?page&limit | GET /datasets/{id}/quality | GET /datasets/{id}/export
GET /analyses/{id}/statistics | GET /analyses/{id}/comparison?prev=
POST /analyses/{id}/recommendations/generate {role} | GET /analyses/{id}/recommendations
POST /analyses/{id}/reports/generate {kind,lang,level} | GET /reports/{id}/versions
Legacy: POST /api/analyze (used by Canvas UI).
