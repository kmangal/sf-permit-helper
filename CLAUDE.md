# SF Permit Helper

A web app that helps people identify the permits they need for tasks in San Francisco. Users describe what they want to do and the system returns relevant permits, related complaints, and similar prior permits.

## Architecture

- **Backend:** FastAPI (`backend/app/`) — API-only, no server-side rendering. `main.py` builds the app; every route lives in `routes.py`.
- **Frontend:** React + TypeScript + Vite (`frontend/`) — proxies `/api/*` to the backend in dev. Layout in `frontend/README.md`

## Data sources

Three data sources feed the RAG system (details in `docs/DATA_SOURCES.md`):

1. **DBI Complaints** (`gm2e-bten`) — ~335K complaints, via Socrata SODA API
2. **Building Permits** (`i98e-djp9`) — ~1.3M historical permits, via SODA API
3. **SF Regulations** — no API; scrape from American Legal Publishing (amlegal) or sf.gov PDFs

All Socrata endpoints use `https://data.sf.gov/resource/{id}.json`. No auth required for basic access.

## Development

```bash
# Backend
cd backend
source .venv/bin/activate
uvicorn app.main:app --reload --port 8000

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

# Frontend checks (from frontend/)
npm run typecheck
npm run lint      # oxlint; inline `style` on DOM elements is an error
npm test          # vitest + Testing Library
```

## Key API endpoints

Full contract in `docs/API_CONTRACT.md`.

- `GET /api/intake/schema` — intake questions, in ask order
- `POST /api/extract` — free text to facts (LLM, with a regex fallback)
- `POST /api/determine` — facts to permits (deterministic rules engine)
- `POST /api/forms/{permit_id}/spec`, `/pdf`, `/sent` — form fields, filled PDF, sent record
- `POST /api/navigator`, `/api/navigator/{session_id}` — conversational navigator: jev answers from the description, the rules engine picks questions. The frontend chat runs on this; `/extract` and `/determine` are no longer called by it
