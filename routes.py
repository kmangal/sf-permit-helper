"""The permit navigator API. Contract: docs/API_CONTRACT.md."""

import asyncio
import json
import logging
import re
from datetime import datetime
from typing import Literal

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from forms import flat_values, form_spec
from intake import extract_fallback, intake_schema, next_question
from llm import LLMClient
from rules import determine, find_rule

logger = logging.getLogger("permit-api")

router = APIRouter(prefix="/api")

# The user's own record of what they sent. No city API confirms any of this.
SENT_LOG: dict[str, dict] = {}

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


class SpecRequest(BaseModel):
    facts: dict = Field(default_factory=dict)
    answers: dict = Field(default_factory=dict)


class PdfRequest(BaseModel):
    facts: dict = Field(default_factory=dict)
    answers: dict = Field(default_factory=dict)
    ink: list[dict] = Field(default_factory=list)


class SentRequest(BaseModel):
    method: str = "portal"
    note: str = ""


def error(status: int, code: str, message: str, missing: list[str] | None = None) -> JSONResponse:
    return JSONResponse(
        status_code=status,
        content={"error": {"code": code, "message": message, "missing": missing or []}},
    )


def unknown_permit(permit_id: str) -> JSONResponse:
    return error(404, "unknown_permit", f"No permit with id {permit_id!r}.")


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


@router.post("/forms/{permit_id}/spec")
async def post_form_spec(permit_id: str, req: SpecRequest):
    spec = form_spec(permit_id, req.facts, req.answers)
    if spec is None:
        return unknown_permit(permit_id)
    return spec


@router.post("/forms/{permit_id}/pdf")
async def post_form_pdf(permit_id: str, req: PdfRequest):
    """No AcroForm templates are in the repo yet, so every permit returns 409.

    TODO: once templates land under forms/templates, fill them with pypdf
    (pypdf.PdfWriter.update_page_form_field_values) keyed on each field's
    `pdf_field`, draw `ink` strokes onto the page, and stream application/pdf.
    Web-form-only permits (SFMTA, Entertainment Commission) keep this 409 path.
    """
    spec = form_spec(permit_id, req.facts, req.answers)
    if spec is None:
        return unknown_permit(permit_id)
    rule = find_rule(permit_id, req.facts)
    return JSONResponse(
        status_code=409,
        content={
            "paste_values": flat_values(spec),
            "target_url": rule["url"],
        },
    )


@router.post("/forms/{permit_id}/sent")
async def post_form_sent(permit_id: str, req: SentRequest):
    if find_rule(permit_id, {}) is None:
        return unknown_permit(permit_id)
    record = {
        "sent_at": datetime.now().astimezone().isoformat(timespec="seconds"),
        "method": req.method,
        "note": req.note,
    }
    SENT_LOG[permit_id] = record
    return record
