#!/usr/bin/env bash
# Production entrypoint: runs the backend and the frontend as two processes in
# one container. Vite serves the public port and proxies /api to uvicorn, which
# listens only on localhost. If either process exits, the script exits so
# Railway restarts the container.
#
# Every step logs with a [start.sh] prefix so a failed deploy shows how far the
# script got and which process died.
set -euo pipefail
cd "$(dirname "$0")"

log() { echo "[start.sh] $*"; }

# set -e exits silently on its own; say which command failed and where.
trap 'log "ERROR: command failed (exit $?) at line $LINENO: $BASH_COMMAND"' ERR
trap 'log "shutting down; stopping remaining processes"; kill 0' EXIT

log "starting in $(pwd) as $(whoami); bash $BASH_VERSION"
log "PORT=${PORT:-<unset, using 5173>} PERMIT_HELPER_ENV=${PERMIT_HELPER_ENV:-<unset>}"
log "OPENROUTER_API_KEY is $([[ -n "${OPENROUTER_API_KEY:-}" ]] && echo set || echo NOT SET)"
log "PATH=$PATH"

# Check what each process needs before launching it, so a missing file shows up
# as a named error rather than a bare "No such file or directory".
check() {
  if [[ -e "$1" ]]; then log "found $1"; else log "MISSING $1"; fi
}
check .permit-helper-root
check backend/.venv/bin/uvicorn
check backend/.venv/bin/python
check frontend/node_modules/.bin/vite
check frontend/dist/index.html
check frontend/vite.config.ts
log "python: $(backend/.venv/bin/python --version 2>&1 || echo unavailable)"
log "node: $(command -v node || echo 'not on PATH') $(node --version 2>&1 || echo unavailable)"

(cd backend && exec .venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000) &
BACKEND_PID=$!
log "launched backend (uvicorn) pid $BACKEND_PID on 127.0.0.1:8000"

(cd frontend && exec node_modules/.bin/vite preview --host 0.0.0.0 --port "${PORT:-5173}" --strictPort) &
FRONTEND_PID=$!
log "launched frontend (vite preview) pid $FRONTEND_PID on 0.0.0.0:${PORT:-5173}"

# wait -n returns the first child's exit status; -p records which child it was.
# Capture the status without tripping set -e so it can be logged.
status=0
wait -n -p EXITED_PID || status=$?
case "${EXITED_PID:-}" in
  "$BACKEND_PID") name="backend (uvicorn)" ;;
  "$FRONTEND_PID") name="frontend (vite preview)" ;;
  *) name="unknown process" ;;
esac
log "$name pid ${EXITED_PID:-?} exited with status $status"
exit "$status"
