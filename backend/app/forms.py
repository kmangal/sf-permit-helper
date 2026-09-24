"""Per-permit form specs. Port of paperSpec() in design/canvas/Main.dc.html.

Same sections, same field order, same labels and ask prompts. Values come from
the shared facts; anything in `answers` overrides and is marked source "user".
"""

import re
from datetime import date as date_cls

from .rules import find_rule

# Shared intake facts autofill on every form; only form-specific fields get asked.
FACT_FIELDS = {
    "organizer": "organizer",
    "email": "email",
    "phone": "phone",
    "address": "address",
    "date": "date",
    "hours": "hours",
    "attendance": "attendance",
    "event": "event_name",
}


def _snake(key: str) -> str:
    s = re.sub(r"(?<=[a-z0-9])(?=[A-Z])", "_", key)
    s = re.sub(r"[^A-Za-z0-9]+", "_", s)
    return s.strip("_").lower()


def _slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def _long_date(iso: str | None) -> str:
    if not iso:
        return ""
    d = date_cls.fromisoformat(iso)
    return f"{d.strftime('%A, %B')} {d.day}, {d.year}"


def _sections(r: dict, f: dict) -> list[dict]:
    date_str = _long_date(f.get("date"))
    applicant = [
        {
            "key": "organizer",
            "label": "Applicant name",
            "value": f.get("organizer") or "",
            "ask": {
                "prompt": "Who should be the applicant of record?",
                "hint": "Name as it should appear on the form.",
                "placeholder": "Full name",
            },
        },
        {"key": "org", "label": "Organization", "value": "Neighborhood residents"},
        {
            "key": "email",
            "label": "Email",
            "value": f.get("email") or "",
            "ask": {
                "prompt": "Best email for the city to reach you?",
                "hint": "Used on every application.",
                "placeholder": "you@example.com",
            },
        },
        {
            "key": "phone",
            "label": "Phone",
            "value": f.get("phone") or "",
            "ask": {
                "prompt": "A phone number for the applications?",
                "hint": "The Fire Department and SFMTA both call.",
                "placeholder": "(415) 555-0100",
            },
        },
    ]
    event = [
        {"key": "event", "label": "Event name", "value": f.get("event_name") or "Event", "span": 2},
        {
            "key": "address",
            "label": "Location",
            "value": f.get("address") or "",
            "span": 2,
            "ask": {
                "prompt": "Which block or address?",
                "hint": "Cross streets help.",
                "placeholder": "400 block of Bocana St",
            },
        },
        {"key": "date", "label": "Event date", "value": date_str},
        {
            "key": "hours",
            "label": "Hours, including setup and cleanup",
            "value": f.get("hours") or "",
        },
        {
            "key": "attendance",
            "label": "Expected attendance",
            "value": str(f["attendance"]) if f.get("attendance") is not None else "",
        },
    ]

    structures = f.get("structures")
    setup_val = (
        "None"
        if structures == "none"
        else "Tables, chairs, bounce house"
        if structures == "small"
        else "Tent over 400 sq ft or stage"
    )
    activities = (
        ", ".join(
            p
            for p in [
                "food" if f.get("food") not in (None, "none") else "",
                "amplified sound" if f.get("sound") not in (None, "none") else "",
                "sales" if f.get("sales") == "yes" else "",
            ]
            if p
        )
        or "gathering"
    )

    specific: dict[str, list[dict]] = {
        "bp": [
            {
                "title": "Closure",
                "fields": [
                    {
                        "key": "items",
                        "label": "Items placed in the roadway",
                        "value": setup_val,
                        "span": 2,
                    },
                    {"key": "muni", "label": "Muni service on this block", "value": "None"},
                    {"key": "sales", "label": "Sales or business promotion", "value": "None"},
                ],
            }
        ],
        "se": [
            {
                "title": "Closure",
                "fields": [
                    {
                        "key": "blocks",
                        "label": "Blocks and intersections to close",
                        "value": f.get("address") or "",
                        "span": 2,
                    },
                    {
                        "key": "muni",
                        "label": "Muni lines affected",
                        "value": "",
                        "ask": {
                            "prompt": "Which Muni lines run on the closed blocks?",
                            "hint": "Route numbers, or none.",
                            "placeholder": "e.g. 24, 67",
                        },
                    },
                    {"key": "activities", "label": "Activities", "value": activities},
                ],
            }
        ],
        "ent": [
            {
                "title": "Entertainment",
                "fields": [
                    {
                        "key": "perf",
                        "label": "Type of entertainment",
                        "value": "",
                        "ask": {
                            "prompt": "What kind of act, and who?",
                            "hint": "Live band, DJ, speeches.",
                            "placeholder": "e.g. Neighbor band, The Cortlands",
                        },
                    },
                    {
                        "key": "soundhours",
                        "label": "Sound hours",
                        "value": (
                            "More than 6 hours"
                            if f.get("sound") == "amp_long"
                            else "Up to 6 hours, 9am to 10pm"
                        ),
                    },
                    {
                        "key": "permission",
                        "label": "Proof of permission for the space",
                        "value": (
                            "Street closure permit, attached when issued"
                            if f.get("site") == "street"
                            else "Owner letter"
                        ),
                        "span": 2,
                    },
                    {
                        "key": "outreach",
                        "label": "Neighbor outreach within 150 ft",
                        "value": "Letter generated, delivered by hand",
                        "span": 2,
                    },
                ],
            }
        ],
        "dph": [
            {
                "title": "Food service",
                "fields": [
                    {"key": "vendors", "label": "Number of food vendors", "value": "1"},
                    {
                        "key": "hazard",
                        "label": "Hazard class",
                        "value": (
                            "High, on-site cooking"
                            if f.get("food") == "vendor_high"
                            else "Low, prepackaged"
                        ),
                    },
                    {
                        "key": "vendorname",
                        "label": "Vendor business name",
                        "value": "",
                        "span": 2,
                        "ask": {
                            "prompt": "What is the food vendor called?",
                            "hint": "The name on their permit or truck.",
                            "placeholder": "e.g. Tacos El Patio",
                        },
                    },
                    {
                        "key": "water",
                        "label": "Water source and grey water disposal",
                        "value": "Residential hose bib; grey water to sanitary sewer",
                        "span": 2,
                    },
                ],
            }
        ],
        "fire": [
            {
                "title": "Regulated activities",
                "fields": [
                    {
                        "key": "acts",
                        "label": "Activities requiring a permit",
                        "value": "; ".join(
                            p
                            for p in [
                                "Cooking with LP gas" if f.get("food") == "vendor_high" else "",
                                (
                                    "Tent over 400 sq ft or generator"
                                    if f.get("structures") == "large"
                                    else ""
                                ),
                            ]
                            if p
                        ),
                        "span": 2,
                    },
                    {
                        "key": "lpg",
                        "label": "LP gas on site",
                        "value": "",
                        "ask": {
                            "prompt": "How many propane cylinders, and what size?",
                            "hint": "Under 20 gallons total for a 10x10 booth.",
                            "placeholder": "e.g. one 5-gallon",
                        },
                    },
                    {
                        "key": "ext",
                        "label": "Fire extinguishers",
                        "value": "1 x 2-A:10-B:C per cooking area",
                    },
                    {
                        "key": "siteplan",
                        "label": "Site plan",
                        "value": "11x17 attached, cooking 20 ft from tents",
                        "span": 2,
                    },
                ],
            }
        ],
        "sec": [
            {
                "title": "Security",
                "fields": [
                    {
                        "key": "staff",
                        "label": "Security staffing",
                        "value": "",
                        "span": 2,
                        "ask": {
                            "prompt": "Who handles security?",
                            "hint": "Private company, volunteers, or SFPD.",
                            "placeholder": "e.g. 4 volunteers, 1 hired guard",
                        },
                    },
                    {
                        "key": "alc",
                        "label": "Alcohol dispensing points",
                        "value": "None" if f.get("alcohol") == "none" else "1",
                    },
                ],
            }
        ],
        "abc": [
            {
                "title": "License",
                "fields": [
                    {"key": "type", "label": "License type", "value": "Beer and wine, $50"},
                    {
                        "key": "rbs",
                        "label": "RBS certified server",
                        "value": "",
                        "ask": {
                            "prompt": "Who is the certified RBS server on site?",
                            "hint": "Name and certificate number.",
                            "placeholder": "Name, cert #",
                        },
                    },
                ],
            }
        ],
    }

    tail = specific.get(
        r["id"],
        [
            {
                "title": "Details",
                "fields": [{"key": "notes", "label": "Notes", "value": r["why"], "span": 2}],
            }
        ],
    )
    return [{"title": "Applicant", "fields": applicant}, {"title": "Event", "fields": event}] + tail


def _source(field: dict, facts: dict, answers: dict, value: str) -> str:
    if field["key"] in answers:
        return "user"
    if value == "" and field.get("ask"):
        return "ask"
    fact = FACT_FIELDS.get(field["key"])
    if fact:
        return "intake"
    return "derived"


def form_spec(permit_id: str, facts: dict, answers: dict | None = None) -> dict | None:
    """The /api/forms/{id}/spec response, or None for an unknown permit id."""
    answers = answers or {}
    f = {k: v for k, v in (facts or {}).items() if v is not None}
    r = find_rule(permit_id, f)
    if r is None:
        return None

    sections = []
    for sec in _sections(r, f):
        fields = []
        for fl in sec["fields"]:
            raw = fl.get("value", "")
            value = answers.get(fl["key"], raw)
            value = "" if value is None else str(value)
            fields.append(
                {
                    "key": fl["key"],
                    "label": fl["label"],
                    "value": value,
                    "source": _source(fl, f, answers, value),
                    "span": fl.get("span", 1),
                    "editable": True,
                    "ask": fl.get("ask"),
                    "pdf_field": _snake(fl["key"]),
                }
            )
        sections.append({"title": sec["title"], "fields": fields})

    return {
        "permit_id": permit_id,
        "form_title": r["paperTitle"],
        "agency_full": r["paperAgency"],
        "reference": r["paperRef"],
        "pdf_template": _slug(r["paperTitle"]) + ".pdf",
        "sections": sections,
    }


def flat_values(spec: dict) -> dict:
    """field key -> value, in render order. Used for the paste-values fallback."""
    return {fl["key"]: fl["value"] for sec in spec["sections"] for fl in sec["fields"]}
