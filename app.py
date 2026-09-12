import logging
import time

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from llm import LLMClient
from permits import PERMITS, PermitType
from routes import router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("permit-api")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)

llm = LLMClient()

PERMIT_CATALOG = "\n".join(
    f"- {pt.value}: {info.name} — {info.description}"
    for pt, info in PERMITS.items()
)

SYSTEM_PROMPT = f"""\
You are an expert on San Francisco permits. Given a description of what someone \
wants to do, return the list of permit types they will need.

Here are all available permit types:

{PERMIT_CATALOG}

Return ONLY the permits that are clearly required. Do not guess or include \
permits that are only tangentially related."""

INPUT_COST_PER_TOKEN = 2.00 / 1_000_000
OUTPUT_COST_PER_TOKEN = 10.00 / 1_000_000


class PermitQuery(BaseModel):
    description: str


class PermitResult(BaseModel):
    permits: list[PermitType]
    reasoning: str


@app.get("/api/permit-types")
async def list_permit_types():
    return [
        {
            "id": pt.value,
            "name": info.name,
            "description": info.description,
            "url": info.url,
        }
        for pt, info in PERMITS.items()
    ]


@app.post("/api/permits")
async def find_permits(query: PermitQuery):
    start = time.monotonic()
    result, response = await llm.parse(
        query.description,
        PermitResult,
        system=SYSTEM_PROMPT,
    )
    latency_ms = (time.monotonic() - start) * 1000

    usage = response.usage
    input_cost = usage.input_tokens * INPUT_COST_PER_TOKEN
    output_cost = usage.output_tokens * OUTPUT_COST_PER_TOKEN
    total_cost = input_cost + output_cost

    logger.info(
        "query=%r | permits_found=%d | latency=%.0fms | "
        "tokens_in=%d tokens_out=%d | cost=$%.4f",
        query.description,
        len(result.permits),
        latency_ms,
        usage.input_tokens,
        usage.output_tokens,
        total_cost,
    )

    return {
        "reasoning": result.reasoning,
        "permits": [
            {
                "id": pt.value,
                "name": PERMITS[pt].name,
                "description": PERMITS[pt].description,
                "url": PERMITS[pt].url,
            }
            for pt in result.permits
            if pt in PERMITS
        ],
    }
