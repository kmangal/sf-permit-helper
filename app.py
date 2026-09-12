from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class PermitQuery(BaseModel):
    description: str


@app.post("/api/permits")
async def find_permits(query: PermitQuery):
    # TODO: replace with real permit lookup logic
    permits = [
        {
            "name": "Building Permit",
            "description": "Required for structural changes to a building.",
            "link": "https://sf.gov/topics/building-permits",
        },
        {
            "name": "Electrical Permit",
            "description": "Required for electrical work.",
            "link": "https://sf.gov/topics/building-permits",
        },
    ]
    return {"permits": permits}
