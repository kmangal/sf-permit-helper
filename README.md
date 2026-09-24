# sf-permit-helper

Helps you deal with permits to live your best life in the city.

## What it does

You describe what you want to do in San Francisco, and the app works out which city permits you need. You get a summary with fees and deadlines, and filled-in PDF forms that are ready to sign.

Right now it covers **events**: block parties, park gatherings, parades, street fairs, film shoots, and similar. It asks about the site, the crowd size, food and alcohol, amplified sound, and structures.

How a request moves through the app:

1. **Intake.** A chat-style navigator reads your description and fills in whatever facts it can (date, site, attendance, and so on). The LLM only extracts facts. It never decides whether a permit applies.
2. **Determination.** A deterministic rules engine (`backend/app/rules/sf_event_permits.yaml`) turns those facts into a list of permits, and each result cites its source on sf.gov or in the municipal code. The engine also picks the next question to ask. Diagrams of the rules are in `docs/rules/`.
3. **Forms.** For each permit, the app builds a form spec, pre-fills the PDF, and records it once it's sent.

The plan is to add a RAG layer over DBI complaints, historical building permits, and the SF regulations, so the app can also show related complaints and similar past permits. `docs/DATA_SOURCES.md` covers those sources. None of it is wired up yet.

## Layout

```
backend/     FastAPI, API only. app/main.py builds the app; every route is in app/routes.py
  app/engine/    rules engine and diagram generator
  app/rules/     permit rules (YAML)
  app/models/    LLM clients
  tests/         pytest
frontend/    React 19 + TypeScript + Vite; see frontend/README.md
docs/        API contract, data sources, generated rule diagrams
```

The full API is in `docs/API_CONTRACT.md`.

## Running locally

**Prerequisites:** Python 3.11+, [uv](https://docs.astral.sh/uv/), Node.js with npm, and an [OpenRouter](https://openrouter.ai/) API key.

### Backend

```bash
cd backend
uv sync                          # creates .venv and installs deps from uv.lock
```

Create `backend/.env` with an OpenRouter API key:

```
OPENROUTER_API_KEY=...
```

Values set in the shell environment take precedence over the file. Then start the server:

```bash
source .venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

### Frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. The Vite dev server proxies `/api/*` to the backend on port 8000.

## Checks

```bash
# Backend (from backend/)
uv run pytest
ruff format . && ruff check .
ty check

# Frontend (from frontend/)
npm run typecheck
npm run lint
npm test
```

After you edit the rules YAML, regenerate the diagrams with `cd backend && python -m app.engine.diagrams`.
