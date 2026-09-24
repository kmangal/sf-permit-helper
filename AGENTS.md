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

# Import layering (from backend/; contracts in .importlinter)
uv run lint-imports

# All pre-commit hooks (from the repo root)
uv run --project backend pre-commit run --all-files
```

Commit messages must be Conventional Commits (`feat:`, `fix:`, `chore:` …); a commitizen `commit-msg` hook enforces this. See `CONTRIBUTING.md`.

## Key API endpoints

Full contract in `docs/API_CONTRACT.md`.

- `POST /api/v1/navigator`, `/api/v1/navigator/{session_id}` — conversational navigator: jev answers from the description, the rules engine picks questions. The frontend chat runs on this
- `POST /api/v1/navigator/{session_id}/clarify` — streams an LLM's plain-text answer to a question about the pending question
