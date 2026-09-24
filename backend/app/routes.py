"""The permit navigator API. Contract: docs/API_CONTRACT.md."""

import asyncio
import json
import logging
import re
import uuid
from datetime import datetime
from typing import Literal

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from .intake import extract_fallback, intake_schema, next_question
from .models.jev import OpenRouterJevClient
from .models.llm import LLMClient
from .navigator import Navigator, Session
from .rules import determine

logger = logging.getLogger("permit-api")

router = APIRouter(prefix="/api")

# Open navigator sessions, dropped once they reach a terminal or abort.
SESSIONS: dict[str, Session] = {}

EXTRACT_SYSTEM = """\
You pull facts about an event out of free text for a San Francisco permit tool.

Extract only what the text actually states. Never infer or mention permits; a \
separate rules engine decides those. Leave anything the text does not say out \
rather than guessing. Write dates as ISO YYYY-MM-DD, assuming the next \
occurrence of the date given.

Reply with ONE JSON object and nothing else, no prose, no code fence. Keys, all \
optional:
  event_name (string), organizer (string), email (string), phone (string),
  site: "street" | "sidewalk" | "park" | "waterfront",
  address (string, the block or street address),
  scope: "one_block" | "multi"   (street only; a block party is one_block),
  date (YYYY-MM-DD), hours (string like "noon to 6pm"), attendance (integer),
  food: "none" | "vendor_low" | "vendor_high"   (vendor_high = cooking on site),
  sound: "none" | "acoustic" | "amp_short" | "amp_long"   (amp_long = over 6 hours or after 10pm),
  alcohol: "none" | "nonprofit" | "private",
  structures: "none" | "small" | "large"   (large = tent over 400 sq ft, stage, generator),
  sales: "no" | "yes",
  found: list of {"fact": key, "label": short human phrase, "confidence": "high"|"medium"|"low"}
    with one entry per key you set."""

EXTRACT_TIMEOUT_S = 20


def parse_json_object(text: str) -> dict:
    """Pull the first JSON object out of a model reply, tolerating fences and prose."""
    cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", text.strip(), flags=re.IGNORECASE)
    start, end = cleaned.find("{"), cleaned.rfind("}")
    if start == -1 or end == -1:
        raise ValueError("no JSON object in reply")
    return json.loads(cleaned[start : end + 1])


class Found(BaseModel):
    fact: str
    label: str
    confidence: Literal["high", "medium", "low"]


class Facts(BaseModel):
    """Every key optional until the text says otherwise."""

    event_name: str | None = None
    organizer: str | None = None
    email: str | None = None
    phone: str | None = None
    site: Literal["street", "sidewalk", "park", "waterfront"] | None = None
    address: str | None = None
    scope: Literal["one_block", "multi"] | None = None
    date: str | None = None
    hours: str | None = None
    attendance: int | None = None
    food: Literal["none", "vendor_low", "vendor_high"] | None = None
    sound: Literal["none", "acoustic", "amp_short", "amp_long"] | None = None
    alcohol: Literal["none", "nonprofit", "private"] | None = None
    structures: Literal["none", "small", "large"] | None = None
    sales: Literal["no", "yes"] | None = None
    found: list[Found] = Field(default_factory=list)


class ExtractRequest(BaseModel):
    text: str


class DetermineRequest(BaseModel):
    facts: dict = Field(default_factory=dict)


class NavigatorStart(BaseModel):
    description: str


class NavigatorAnswer(BaseModel):
    answer: str


def error(status: int, code: str, message: str, missing: list[str] | None = None) -> JSONResponse:
    return JSONResponse(
        status_code=status,
        content={"error": {"code": code, "message": message, "missing": missing or []}},
    )


@router.get("/intake/schema")
async def get_intake_schema():
    return intake_schema()


@router.post("/extract")
async def post_extract(req: ExtractRequest):
    """Free text to facts. The LLM extracts; it never decides permits."""
    # Regex first: cheap, deterministic, and the floor if the model is slow or down.
    facts, found = extract_fallback(req.text)
    source = "fallback"
    try:
        today = datetime.now().date()
        reply = await asyncio.wait_for(
            LLMClient().complete(
                f"Today is {today.isoformat()}.\n\n{req.text}", system=EXTRACT_SYSTEM
            ),
            timeout=EXTRACT_TIMEOUT_S,
        )
        parsed = Facts.model_validate(parse_json_object(reply))
        data = parsed.model_dump()
        if data.get("date"):
            # The model sometimes picks a past year; the event is always ahead of us.
            try:
                d = datetime.strptime(data["date"], "%Y-%m-%d").date()
                while d < today:
                    d = d.replace(year=d.year + 1)
                data["date"] = d.isoformat()
            except ValueError:
                data["date"] = None
        llm_found = [f for f in data.pop("found", []) if f.get("fact") in data]
        llm_facts = {k: v for k, v in data.items() if v is not None}
        if llm_facts:
            facts = {**facts, **llm_facts}
            seen = {f["fact"] for f in llm_found}
            found = llm_found + [f for f in found if f.get("fact") not in seen]
            source = "llm"
    except Exception as exc:  # no API key, timeout, network, or a malformed reply
        logger.info("extract: using regex only (%s: %s)", type(exc).__name__, exc)

    logger.info("extract: source=%s facts=%d found=%d", source, len(facts), len(found))
    return {
        "facts": facts,
        "found": found,
        "next_question": next_question(facts),
        "source": source,
    }


@router.post("/determine")
async def post_determine(req: DetermineRequest):
    facts = {k: v for k, v in (req.facts or {}).items() if v is not None}
    if not facts:
        return error(
            400,
            "insufficient_facts",
            "Need at least the site before determining.",
            ["site"],
        )
    return determine(facts)


def navigator() -> Navigator:
    return Navigator(OpenRouterJevClient())


def _navigator_turn(session_id: str, session: Session, turn: dict) -> dict:
    if session.done:
        SESSIONS.pop(session_id, None)
    return {"session_id": session_id, **turn}


@router.post("/navigator")
async def post_navigator_start(req: NavigatorStart):
    """Start from a description; jev answers what it can, the rest comes back as a question."""
    session_id = uuid.uuid4().hex
    session = Session(description=req.description)
    SESSIONS[session_id] = session
    return _navigator_turn(session_id, session, await navigator().advance(session))


@router.post("/navigator/{session_id}")
async def post_navigator_answer(session_id: str, req: NavigatorAnswer):
    session = SESSIONS.get(session_id)
    if session is None:
        return error(404, "unknown_session", f"No open navigator session {session_id!r}.")
    return _navigator_turn(session_id, session, await navigator().reply(session, req.answer))
