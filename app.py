from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from permits import PERMITS

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class PermitQuery(BaseModel):
    description: str


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
    # TODO: replace with real permit lookup logic (RAG)
    permits = [
        {
            "id": pt.value,
            "name": info.name,
            "description": info.description,
            "url": info.url,
        }
        for pt, info in PERMITS.items()
    ]
    return {"permits": permits[:3]}
