"""Rules engine and fallback extraction tests.

Expectations come from the prototype in design/canvas/Main.dc.html and the
shapes in docs/API_CONTRACT.md.
"""

from datetime import date, timedelta

import pytest

from app.intake import extract_fallback
from app.rules import determine

BOCANA_TEXT = (
    "Block party on the 400 block of Bocana St, Saturday Oct 24, noon to 6pm, "
    "about 80 people. A neighbor band plays for an hour, a taco stand cooking "
    "on site, a bounce house in the street, no alcohol, nothing sold."
)


def days_out(n: int) -> str:
    return (date.today() + timedelta(days=n)).isoformat()


def bocana_facts(**overrides) -> dict:
    facts = {
        "site": "street",
        "scope": "one_block",
        "address": "400 block of Bocana St",
        "alcohol": "none",
        "sales": "no",
        "food": "vendor_high",
        "sound": "amp_short",
        "structures": "small",
        "attendance": 80,
        "date": days_out(42),
    }
    facts.update(overrides)
    return facts


def by_status(result: dict) -> dict[str, set[str]]:
    out: dict[str, set[str]] = {}
    for p in result["permits"]:
        out.setdefault(p["status"], set()).add(p["id"])
    return out


def permit(result: dict, permit_id: str) -> dict:
    return next(p for p in result["permits"] if p["id"] == permit_id)


# --- determine ---------------------------------------------------------------


def test_bocana_block_party():
    groups = by_status(determine(bocana_facts()))
    assert groups["required"] == {"bp", "ent", "dph", "fire"}
    assert groups["likely"] == {"signs"}
    assert {"se", "sec"} <= groups["not_needed"]
    assert "pending" not in groups


def test_bocana_shape_matches_contract():
    result = determine(bocana_facts())
    assert result["site_check"]["status"] == "ok"
    layers = [c["layer"] for c in result["site_check"]["checks"]]
    assert layers == ["muni_routes", "street_classification", "iscott_closures"]

    bp = permit(result, "bp")
    assert bp["due_date"] == (date.today() + timedelta(days=42 - 30)).isoformat()
    assert bp["you_must_add"] == ["photos of the posted notice"]
    assert bp["citation"]["url"] == "https://www.sf.gov/host-a-neighborhood-block-party"
    assert bp["citation"]["fetched_at"] == "2026-09-12"
    assert {limit["text"] for limit in bp["limits"]} >= {
        "Under 8 hours between 7am and 10pm.",
        "Nothing sold, no alcohol, no stages.",
    }
    # $286 high-hazard vendor fee, in cents.
    assert result["fees"]["per_vendor_cents"] == 28600
    assert result["first_deadline"]["permit_id"] == "bp"


def test_large_event_adds_security_medical_and_zero_waste():
    groups = by_status(determine(bocana_facts(attendance=1500)))
    assert {"sec", "med", "zw"} <= groups["required"]


def test_private_alcohol_sends_you_to_a_caterer():
    abc = permit(determine(bocana_facts(alcohol="private")), "abc")
    assert abc["status"] == "not_needed"
    assert abc["why"] == "Daily licenses go to nonprofits only. A licensed caterer pours."


@pytest.mark.parametrize(("days", "cents"), [(60, 12200), (89, 12200), (90, 5800), (120, 5800)])
def test_block_party_fee_tiers(days, cents):
    bp = permit(determine(bocana_facts(date=days_out(days))), "bp")
    assert bp["fee_cents"] == cents


def test_block_party_fee_basis_names_the_tier():
    bp = permit(determine(bocana_facts(date=days_out(60))), "bp")
    assert bp["fee_basis"] == "$122, 60 to 89 day tier. Drops to $58 at 90 days."


def test_park_site_goes_to_rec_and_park():
    result = determine(bocana_facts(site="park", scope=None, address="Precita Park"))
    groups = by_status(result)
    assert "rpd" in groups["required"]
    assert {"bp", "se"} <= groups["not_needed"]
    assert permit(result, "bp")["why"] == "Only for events on a street."
    assert result["site_check"]["status"] == "different_track"


def test_missing_facts_only_on_pending():
    result = determine({"site": "street"})
    bp = permit(result, "bp")
    assert bp["status"] == "pending"
    assert bp["missing_facts"] == ["scope", "alcohol", "sales"]
    assert permit(result, "rpd")["missing_facts"] == []


# --- extraction --------------------------------------------------------------


def test_extract_fallback_reads_the_bocana_sentence():
    facts, found = extract_fallback(BOCANA_TEXT)
    assert facts["site"] == "street"
    assert facts["scope"] == "one_block"
    assert facts["address"] == "400 block of Bocana St"
    assert facts["date"].endswith("-10-24")
    assert facts["attendance"] == 80
    assert facts["food"] == "vendor_high"
    assert facts["sound"] == "amp_short"
    assert facts["alcohol"] == "none"
    assert facts["sales"] == "no"
    assert {f["fact"] for f in found} >= {
        "site",
        "address",
        "date",
        "attendance",
        "food",
        "sound",
        "alcohol",
        "sales",
    }
    assert all(f["confidence"] in {"high", "medium", "low"} for f in found)
