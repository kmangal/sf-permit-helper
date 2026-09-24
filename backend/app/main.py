import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .paths import get_repo_root_path
from .routes import router

logging.basicConfig(level=logging.INFO)

# The Vite build. It exists in the Railpack image; in dev, Vite serves the frontend itself.
FRONTEND_DIST = get_repo_root_path() / "frontend" / "dist"

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)

# Mounted last so /api/* routes win over static files.
if FRONTEND_DIST.is_dir():
    app.mount("/", StaticFiles(directory=FRONTEND_DIST, html=True), name="frontend")
