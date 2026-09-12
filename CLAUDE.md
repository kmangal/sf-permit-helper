# SF Permit Helper

A web app that helps people identify the permits they need for tasks in San Francisco. Users describe what they want to do and the system returns relevant permits, related complaints, and similar prior permits.

## Architecture

- **Backend:** FastAPI (`app.py`) — API-only, no server-side rendering
- **Frontend:** React + Vite (`frontend/`) — proxies `/api/*` to the backend in dev
- **Permit database:** `permits.py` — `PermitType` enum (31 types) mapped to `PermitInfo` (name, description, url). Source of truth for all permit types.

## Data sources

Three data sources feed the RAG system (details in `docs/DATA_SOURCES.md`):

1. **DBI Complaints** (`gm2e-bten`) — ~335K complaints, via Socrata SODA API
2. **Building Permits** (`i98e-djp9`) — ~1.3M historical permits, via SODA API
3. **SF Regulations** — no API; scrape from American Legal Publishing (amlegal) or sf.gov PDFs

All Socrata endpoints use `https://data.sf.gov/resource/{id}.json`. No auth required for basic access.

## Development

```bash
# Backend
source .venv/bin/activate
uvicorn app:app --reload --port 8000

# Frontend (separate terminal)
cd frontend
npm run dev
```

Frontend runs on port 5173, proxies `/api` to port 8000.

## Commands

```bash
# Lint and format
ruff format .
ruff check .

# Type check
ty check

# Install Python deps
uv pip install -r requirements.txt

# Install frontend deps
cd frontend && npm install
```

## Key API endpoints

- `GET /api/permit-types` — list all 31 permit types
- `POST /api/permits` — accepts `{"description": "..."}`, returns matching permits (RAG lookup TBD)
