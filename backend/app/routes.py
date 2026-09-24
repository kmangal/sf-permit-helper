"""The permit navigator API. Contract: docs/API_CONTRACT.md."""

import tomllib
import uuid
from functools import cache

from fastapi import APIRouter
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel

from .engine import load_ruleset
from .engine.diagrams import diagrams
from .models.jev import OpenRouterJevClient
from .models.llm import OpenRouterLlmClient
from .navigator import Navigator, Session
from .paths import get_repo_root_path

router = APIRouter(prefix="/api/v1")

# Open navigator sessions, dropped once they reach a terminal or abort.
SESSIONS: dict[str, Session] = {}


class NavigatorStart(BaseModel):
    description: str


class NavigatorAnswer(BaseModel):
    answer: str


class NavigatorClarify(BaseModel):
    question: str


def error(status: int, code: str, message: str, missing: list[str] | None = None) -> JSONResponse:
    return JSONResponse(
        status_code=status,
        content={"error": {"code": code, "message": message, "missing": missing or []}},
    )


def navigator() -> Navigator:
    return Navigator(OpenRouterJevClient())


def _navigator_turn(session_id: str, session: Session, turn: dict) -> dict:
    if session.done:
        SESSIONS.pop(session_id, None)
    return {"session_id": session_id, **turn}


@cache
def _version() -> str:
    """The release version from backend/pyproject.toml, which release.sh bumps."""
    with (get_repo_root_path() / "backend" / "pyproject.toml").open("rb") as f:
        return tomllib.load(f)["project"]["version"]


@router.get("/health")
async def get_health():
    """Liveness check for the deploy platform, with the running release version."""
    return {"status": "ok", "version": _version()}


@cache
def _rule_diagrams() -> list[dict]:
    return [
        {"id": d.id, "kind": d.kind, "title": d.title, "source": d.body}
        for d in diagrams(load_ruleset())
    ]


@router.get("/rules/diagrams")
async def get_rule_diagrams():
    """The rules engine's decision flow as Mermaid flowcharts, drawn from the live rules file."""
    return {"diagrams": _rule_diagrams()}


@router.post("/navigator")
async def post_navigator_start(req: NavigatorStart):
    """Start from a description; jev checks it is an event, answers what it can, and the rest
    comes back as a question."""
    session_id = uuid.uuid4().hex
    session = Session(description=req.description)
    SESSIONS[session_id] = session
    return _navigator_turn(session_id, session, await navigator().start(session))


@router.post("/navigator/{session_id}")
async def post_navigator_answer(session_id: str, req: NavigatorAnswer):
    session = SESSIONS.get(session_id)
    if session is None:
        return error(404, "unknown_session", f"No open navigator session {session_id!r}.")
    return _navigator_turn(session_id, session, await navigator().reply(session, req.answer))


@router.post("/navigator/{session_id}/clarify")
async def post_navigator_clarify(session_id: str, req: NavigatorClarify):
    """Stream an answer, as plain text, to a question about the pending question."""
    session = SESSIONS.get(session_id)
    if session is None or session.pending is None:
        return error(404, "unknown_session", f"No open navigator session {session_id!r}.")
    stream = navigator().clarify(OpenRouterLlmClient(), session, req.question)
    return StreamingResponse(stream, media_type="text/plain; charset=utf-8")
