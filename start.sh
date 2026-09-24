#!/usr/bin/env bash
# Production entrypoint: runs the backend and the frontend as two processes in
# one container. Vite serves the public port and proxies /api to uvicorn, which
# listens only on localhost. If either process exits, the script exits so
# Railway restarts the container.
set -euo pipefail
cd "$(dirname "$0")"

trap 'kill 0' EXIT

(cd backend && exec .venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000) &
(cd frontend && exec node_modules/.bin/vite preview --host 0.0.0.0 --port "${PORT:-5173}" --strictPort) &

wait -n
