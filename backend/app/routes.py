"""The permit navigator API. Contract: docs/API_CONTRACT.md."""

import uuid

from fastapi import APIRouter
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel

from .models.jev import OpenRouterJevClient
from .models.llm import OpenRouterLlmClient
from .navigator import Navigator, Session

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
