# sf-permit-helper

Helps you deal with permits to live your best life in the city.

## What it does

You describe what you want to do in San Francisco, and the app works out which city permits you need. You get a summary of each permit with its fees and deadlines.

Right now it covers **events**: block parties, park gatherings, parades, street fairs, film shoots, and similar. It asks about the site, the crowd size, food and alcohol, amplified sound, and structures.

How a request moves through the app:

1. **Intake.** A chat-style navigator reads your description and fills in whatever facts it can (date, site, attendance, and so on). The LLM only extracts facts. It never decides whether a permit applies.
2. **Determination.** A deterministic rules engine (`backend/app/engine/rules.yaml`) turns those facts into a list of permits, and each result cites its source on sf.gov or in the municipal code. The engine also picks the next question to ask. Diagrams of the rules are in `docs/rules/`.

## Layout

```
backend/     FastAPI, API only. app/main.py builds the app; every route is in app/routes.py
  app/engine/    rules engine, permit rules (rules.yaml), and diagram generator
  app/models/    LLM clients
  tests/         pytest
frontend/    React 19 + TypeScript + Vite; see frontend/README.md
docs/        API contract, generated rule diagrams
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

## Deploying to Railway

The repo deploys as two Railway services built with [Railpack](https://railpack.com). Each service builds from its own directory:

| Service    | Root directory | Config file              | What runs                                                    |
| ---------- | -------------- | ------------------------ | ------------------------------------------------------------ |
| `backend`  | `/backend`     | `/backend/railway.json`  | uvicorn on `$PORT`, on both IPv4 and IPv6                     |
| `frontend` | `/frontend`    | `/frontend/railway.json` | Caddy serves the Vite build and proxies `/api/*` to the backend |

In production, `frontend/Caddyfile` does the job that the Vite dev proxy does locally. The browser only talks to the frontend's origin, so the backend needs no CORS change and no public domain.

To set it up:

1. Create two services from this GitHub repo and name them `backend` and `frontend`.
2. For each service, go to **Settings** and set **Root Directory** and **Config file path** as shown in the table. Railway looks up the config file from the repo root, not from the service's root directory, so both settings are needed.
3. Set these variables on `backend`:
   - `OPENROUTER_API_KEY`
   - `PERMIT_HELPER_ENV=production`. The backend defaults to `local`.
   - `PORT=8000`. This fixes the port so the frontend can reference it.
4. Set this variable on `frontend`:
   - `BACKEND_URL=http://${{backend.RAILWAY_PRIVATE_DOMAIN}}:${{backend.PORT}}`
5. Generate a public domain for `frontend` only.

Each service rebuilds only when files under its own directory change (`watchPatterns`). Navigator sessions are kept in memory, so run the backend as a single replica.
