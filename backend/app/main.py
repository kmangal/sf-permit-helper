import logging
import os
import sys
import time
from collections.abc import Awaitable, Callable
from pathlib import Path

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def startup_context() -> str:
    """What the process ran with, for diagnosing a failed start. Never logs secret values."""
    backend_dir = Path(__file__).resolve().parent.parent
    api_key = "set" if os.environ.get("OPENROUTER_API_KEY") else "NOT SET"
    return "\n".join(
        [
            f"  python: {sys.version.split()[0]} at {sys.executable}",
            f"  cwd: {os.getcwd()}",
            f"  backend dir: {backend_dir}",
            f"  PERMIT_HELPER_ENV: {os.environ.get('PERMIT_HELPER_ENV', '<unset>')}",
            f"  OPENROUTER_API_KEY in process env: {api_key}",
            f"  sys.path: {sys.path}",
        ]
    )


async def log_requests(
    request: Request, call_next: Callable[[Request], Awaitable[Response]]
) -> Response:
    """Acknowledge every request on arrival, then log how it finished. Bodies are not logged:
    they carry what users typed."""
    client = request.client.host if request.client else "unknown"
    logger.info("Request received: %s %s from %s", request.method, request.url.path, client)
    start = time.perf_counter()
    try:
        response = await call_next(request)
    except Exception:
        elapsed_ms = (time.perf_counter() - start) * 1000
        logger.exception(
            "Request failed: %s %s after %.0f ms", request.method, request.url.path, elapsed_ms
        )
        raise
    elapsed_ms = (time.perf_counter() - start) * 1000
    # For the streaming clarify route this is when the stream starts, not when it ends.
    logger.info(
        "Request handled: %s %s -> %d in %.0f ms",
        request.method,
        request.url.path,
        response.status_code,
        elapsed_ms,
    )
    return response


# Importing the routes pulls in the model clients and the rules engine, which is
# where startup usually fails. Log the full traceback before re-raising so it
# shows up in the deploy logs; the process still exits.
try:
    from .routes import router

    app = FastAPI()

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.middleware("http")(log_requests)

    app.include_router(router)
except Exception as exc:
    logger.exception(
        "Backend failed to start: %s: %s\n%s",
        type(exc).__name__,
        exc,
        startup_context(),
    )
    raise

logger.info("Backend app built with %d routes", len(app.routes))
