# SF Permit Helper

A web app that helps people identify the permits they need for tasks in San Francisco. Users describe what they want to do and the system returns the permits that apply.

## Architecture

- **Backend:** FastAPI (`backend/app/`) — API-only, no server-side rendering. `main.py` builds the app; every route lives in `routes.py`.
- **Frontend:** React + TypeScript + Vite (`frontend/`) — proxies `/api/*` to the backend in dev. Layout in `frontend/README.md`

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

# Install Python deps (from backend/)
uv sync

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
- `POST /api/navigator`, `/api/navigator/{session_id}` — conversational navigator: jev answers from the description, the rules engine picks questions. The frontend chat runs on this; `/extract` and `/determine` are no longer called by it
