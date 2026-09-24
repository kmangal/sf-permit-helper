"""The deterministic rules engine. No model is in this path.

Ported from `rules()`, `extras()` and the `siteCheck` block of the prototype at
design/canvas/Main.dc.html: the same 13 permits, the same thresholds, the same
fee tiers and the same limits text. Every outcome carries a citation.
"""

from datetime import date as date_cls
from datetime import timedelta
from urllib.parse import urlparse

FETCHED_AT = "2026-09-12"

# Status vocabulary: the prototype's "no" is the contract's "not_needed".
_STATUS = {"required": "required", "likely": "likely", "no": "not_needed", "pending": "pending"}


def _days_out(iso: str | None, today: date_cls | None = None) -> int | None:
    if not iso:
        return None
    today = today or date_cls.today()
    return (date_cls.fromisoformat(iso) - today).days


def _tier(days: int | None, arr: list[int]) -> int | None:
    if days is None:
        return None
    if days >= 90:
        return arr[0]
    if days >= 60:
        return arr[1]
    if days >= 30:
        return arr[2]
    return None


def _citation_title(url: str) -> str:
    parts = urlparse(url)
    host = parts.netloc.removeprefix("www.")
    slug = [p for p in parts.path.split("/") if p]
    if not slug:
        return host
    words = slug[-1].replace("-", " ").replace("_", " ").strip()
    return f"{host}: {words[:1].upper()}{words[1:]}"


def _citation(url: str, quote: str, title: str | None = None) -> dict:
    # The prototype only carries `url` per rule, so the rule's own `why` is the
    # quote until each source page is pulled and a real excerpt is stored.
    return {
        "url": url,
        "title": title or _citation_title(url),
        "quote": quote,
        "fetched_at": FETCHED_AT,
    }


def _split_limits(text: str, citation: dict) -> list[dict]:
    out = []
    for part in text.split(". "):
        part = part.strip()
        if not part:
            continue
        if not part.endswith("."):
            part += "."
        out.append({"text": part, "citation": citation})
    return out


def _split_you_add(text: str) -> list[str]:
    return [p.strip().rstrip(".") for p in text.split(", ") if p.strip()]


def rules(f: dict, days: int | None) -> list[dict]:
    """The 13 rules, in the prototype's order. Raw records, pre-serialization."""

    def need(*keys: str) -> list[str]:
        return [k for k in keys if f.get(k) is None]

    out: list[dict] = []
    bp_eligible = (
        f.get("site") == "street"
        and f.get("scope") == "one_block"
        and f.get("alcohol") == "none"
        and f.get("sales") == "no"
    )
    street_closure = f.get("site") == "street"
    plan_channel = (
        "Upload with the Rec and Park application."
        if f.get("site") == "park"
        else "Send to your Port point of contact."
        if f.get("site") == "waterfront"
        else "Upload with the closure application."
    )

    # 1. Block party street closure
    missing = need("site", "scope", "alcohol", "sales")
    if f.get("site") is not None and f.get("site") != "street":
        status, why = "no", "Only for events on a street."
    elif missing:
        status, why = "pending", ""
    elif bp_eligible:
        status, why = "required", "One residential block, no Muni, nothing sold, no alcohol."
    else:
        status = "no"
        why = (
            "More than one block or a transit street."
            if f.get("scope") != "one_block"
            else "Alcohol or sales disqualify it."
        )
    fee = _tier(days, [58, 122, 250])
    out.append(
        {
            "id": "bp",
            "name": "Block party street closure",
            "agency": "SFMTA",
            "status": status,
            "why": why,
            "missing": missing,
            "lead": 30,
            "fee": 250 if fee is None else fee,
            "feeLabel": "$58 to $250" if fee is None else f"${fee}",
            "purpose": (
                "Closes your block to traffic for the day. The city posts the hearing "
                "notice rule on you: 7 days on the block, with photos."
            ),
            "url": "https://www.sf.gov/host-a-neighborhood-block-party",
            "channel": (
                "Submit through the SFMTA online form, then post the notice for 7 days "
                "and file the declaration with photos."
            ),
            "youAdd": "photos of the posted notice.",
            "paperAgency": "San Francisco Municipal Transportation Agency",
            "paperTitle": "Neighborhood Block Party Street Closure Application",
            "paperRef": "ISCOTT\nFY 2026-27",
        }
    )

    # 2. Special event street closure
    missing = need("site", "scope", "alcohol", "sales")
    if f.get("site") is not None and f.get("site") != "street":
        status, why = "no", "Only for events on a street."
    elif missing:
        status, why = "pending", ""
    elif not bp_eligible:
        status, why = "required", "Multi-block, transit street, sales, or alcohol."
    else:
        status, why = "no", "Covered by the block party closure."
    small = _tier(days, [166, 277, 333])
    out.append(
        {
            "id": "se",
            "name": "Special event street closure",
            "agency": "SFMTA, ISCOTT",
            "status": status,
            "why": why,
            "missing": missing,
            "lead": 90 if f.get("sales") == "yes" else 30,
            "fee": 333 if small is None else small,
            "feeLabel": "$166 to $2,441" if small is None else f"from ${small}",
            "purpose": (
                "Closes the street through the ISCOTT committee, which meets twice a "
                "month and hears you in public. Needed once sales, alcohol, Muni, or "
                "more than one block are involved."
            ),
            "url": "https://www.sf.gov/close-a-streets-for-an-outdoor-event",
            "channel": (
                "Submit through the SFMTA online form. ISCOTT hears it twice monthly. "
                "Post the notice 10 days before the hearing."
            ),
            "youAdd": "certificate of insurance ($500K to $1M), posting photos.",
            "paperAgency": "San Francisco Municipal Transportation Agency",
            "paperTitle": "Special Event Street Closure Application",
            "paperRef": "ISCOTT\nFY 2026-27",
        }
    )

    # 3. One-Time Outdoor Event permit
    missing = need("site", "sound")
    if missing:
        status, why = "pending", ""
    elif f.get("site") == "park":
        status, why = "no", "Parks use Rec and Park sound permits."
    elif f.get("sound") in ("amp_short", "amp_long"):
        status, why = "required", "Amplified sound on a street or sidewalk."
    else:
        status, why = "no", "No amplified sound."
    out.append(
        {
            "id": "ent",
            "name": "One-Time Outdoor Event permit",
            "agency": "Entertainment Commission",
            "status": status,
            "why": why,
            "missing": missing,
            "lead": 45 if f.get("sound") == "amp_long" else 14,
            "fee": 586,
            "feeLabel": "$586",
            "purpose": (
                "Covers the band or any speakers, up to 6 hours between 9am and 10pm. "
                "Wants the street closure permit attached and proof you told neighbors "
                "within 150 feet."
            ),
            "url": "https://www.sf.gov/get-entertainment-permit-your-outdoor-event",
            "channel": (
                "Paste into the Entertainment Commission online application and pay "
                "through the SF payment portal."
            ),
            "youAdd": (
                "the street closure permit once issued."
                if street_closure
                else "a Public Works permit or owner letter."
            ),
            "paperAgency": "San Francisco Entertainment Commission",
            "paperTitle": "One-Time Outdoor Event Permit Application",
            "paperRef": "Police Code 1060.29.2\nFY 2026-27",
        }
    )

    # 4. Event sponsor and vendor food permits
    missing = need("food")
    if missing:
        status, why = "pending", ""
    elif f.get("food") == "none":
        status, why = "no", "No vendors."
    else:
        status, why = "required", "A vendor selling or giving away food."
    vendor = 286 if f.get("food") == "vendor_high" else 146
    out.append(
        {
            "id": "dph",
            "name": "Event sponsor and vendor food permits",
            "agency": "Public Health",
            "status": status,
            "why": why,
            "missing": missing,
            "lead": 14,
            "fee": 211 + vendor,
            "feeLabel": f"$211 + ${vendor} per vendor",
            "purpose": (
                "You sponsor the event for the health department and collect a permit "
                "application from every food vendor. Goes in by mail."
            ),
            "url": "https://www.sf.gov/organize-food-vendors-for-a-special-event",
            "channel": (
                "Mail the packet to Environmental Health, 49 South Van Ness Ave, Suite 600."
            ),
            "youAdd": "vendor food safety certificates, signatures.",
            "paperAgency": "San Francisco Department of Public Health",
            "paperTitle": "Temporary Event Sponsor Application",
            "paperRef": "Environmental Health\nFY 2026-27",
        }
    )

    # 5. Fire: temporary special event permit
    missing = need("food", "structures")
    if missing:
        status, why = "pending", ""
    elif f.get("food") == "vendor_high" or f.get("structures") == "large":
        status = "required"
        why = ("Cooking with propane or open flame. " if f.get("food") == "vendor_high" else "") + (
            "Tents over 400 sq ft, stages, or generators." if f.get("structures") == "large" else ""
        )
    else:
        status, why = "no", "No cooking, large tents, or generators."
    acts = (1 if f.get("food") == "vendor_high" else 0) + (
        1 if f.get("structures") == "large" else 0
    )
    out.append(
        {
            "id": "fire",
            "name": "Temporary special event permit",
            "agency": "Fire Department",
            "status": status,
            "why": why,
            "missing": missing,
            "lead": 14 if street_closure else 5,
            "fee": 436 + 95 * max(acts - 1, 0),
            "feeLabel": "$436 + $95 per extra activity",
            "purpose": (
                "Covers propane, open flame cooking, large tents, and generators. Walked "
                "in to the Permit Center with a site plan showing where the cooking sits."
            ),
            "url": "https://www.sf.gov/apply-for-a-fire-permit-special-event",
            "channel": (
                "Bring the printed form to the Permit Center, 49 South Van Ness Ave, 2nd floor."
            ),
            "youAdd": "certificate of insurance, $1M, City as additional insured.",
            "paperAgency": "San Francisco Fire Department, Bureau of Fire Prevention",
            "paperTitle": "BFP Form 1010, Permit Application",
            "paperRef": "Rev. 7/2024\nFee $436",
        }
    )

    # 6. Security plan
    missing = need("attendance", "alcohol")
    if missing:
        status, why = "pending", ""
    elif f["attendance"] > 500:
        status, why = "required", "Over 500 attendees."
    elif f.get("alcohol") != "none":
        status, why = "likely", "Under 500, but alcohol is a risk factor."
    else:
        status, why = "no", "Under 500 attendees, no alcohol."
    out.append(
        {
            "id": "sec",
            "name": "Security plan",
            "agency": "Police district station",
            "status": status,
            "why": why,
            "missing": missing,
            "lead": 90,
            "fee": 0,
            "feeLabel": "no fee",
            "purpose": (
                "A written plan for crowd, alcohol, and access, reviewed by the Special "
                "Event Sergeant at your district station."
            ),
            "url": "https://www.sf.gov/guidelines-for-outdoor-event-security",
            "channel": (
                "PDF to the Special Event Sergeant at your district station. " + plan_channel
            ),
            "youAdd": "security vendor name if hired.",
            "paperAgency": "San Francisco Police Department",
            "paperTitle": "Special Event Security Plan",
            "paperRef": "Events over 500\n3 months prior",
        }
    )

    # 7. Emergency medical plan
    missing = need("attendance")
    if missing:
        status, why = "pending", ""
    elif f["attendance"] >= 1000:
        status, why = "required", "1,000 or more attendees."
    else:
        status, why = "no", "Under 1,000 attendees."
    out.append(
        {
            "id": "med",
            "name": "Emergency medical plan",
            "agency": "Emergency Management",
            "status": status,
            "why": why,
            "missing": missing,
            "lead": 90,
            "fee": 160,
            "feeLabel": "$160 review",
            "purpose": (
                "How medical emergencies get handled on site for a crowd of 1,000 or more."
            ),
            "url": "https://www.sf.gov/close-a-streets-for-an-outdoor-event",
            "channel": plan_channel,
            "youAdd": "medical provider contract.",
            "paperAgency": "Department of Emergency Management",
            "paperTitle": "Emergency Medical Plan",
            "paperRef": "Events of 1,000+\n90 days prior",
        }
    )

    # 8. Zero waste plan
    missing = need("attendance")
    if missing:
        status, why = "pending", ""
    elif f["attendance"] >= 1000:
        status, why = "required", "1,000 or more attendees."
    else:
        status, why = "no", "Under 1,000 attendees."
    out.append(
        {
            "id": "zw",
            "name": "Zero waste plan",
            "agency": "Environment",
            "status": status,
            "why": why,
            "missing": missing,
            "lead": 30,
            "fee": 0,
            "feeLabel": "no fee",
            "purpose": (
                "Recycling and compost plan for events of 1,000 or more, with Recology "
                "service ordered 30 days out."
            ),
            "url": "https://www.sf.gov/zero-waste-resources-for-special-events",
            "channel": plan_channel + " Order Recology service 30 days out.",
            "youAdd": "Recology order confirmation.",
            "paperAgency": "San Francisco Environment Department",
            "paperTitle": "Zero Waste Event Plan",
            "paperRef": "Events of 1,000+\n30 days prior",
        }
    )

    # 9. ABC daily license
    missing = need("alcohol")
    if missing:
        status, why = "pending", ""
    elif f.get("alcohol") == "nonprofit":
        status, why = "required", "Nonprofit serving or selling alcohol."
    elif f.get("alcohol") == "private":
        status, why = "no", "Daily licenses go to nonprofits only. A licensed caterer pours."
    else:
        status, why = "no", "No alcohol."
    out.append(
        {
            "id": "abc",
            "name": "Daily license, ABC-221",
            "agency": "California ABC",
            "status": status,
            "why": why,
            "missing": missing,
            "lead": 10,
            "fee": 75,
            "feeLabel": "$50 to $75",
            "purpose": (
                "The state one-day alcohol license for nonprofits. Needs a police "
                "signature and a certified server on site."
            ),
            "url": "https://www.abc.ca.gov/licensing/license-forms/form-abc-221-instructions/",
            "channel": (
                "File with the ABC district office, with a police signature, between "
                "30 and 10 days before."
            ),
            "youAdd": "nonprofit proof, police signature, RBS certificate.",
            "paperAgency": "California Department of Alcoholic Beverage Control",
            "paperTitle": "ABC-221 Daily License Application",
            "paperRef": "Rev. 2022\n$50 / $75",
        }
    )

    # 10. Temporary No Parking signs
    missing = need("site", "structures")
    if missing:
        status, why = "pending", ""
    elif f.get("site") != "street":
        status, why = "no", "Only for street closures."
    elif f.get("structures") != "none":
        status, why = "likely", "Things in the roadway usually need the curb clear."
    else:
        status, why = "no", "Most block parties skip signs."
    out.append(
        {
            "id": "signs",
            "name": "Temporary No Parking signs",
            "agency": "SFMTA",
            "status": status,
            "why": why,
            "missing": missing,
            "lead": 14,
            "fee": 357,
            "feeLabel": "from $357",
            "purpose": (
                "Clears parked cars from the curb so the bounce house and tables fit. "
                "Optional, and most block parties skip it."
            ),
            "url": "https://www.sf.gov/fees-for-outdoor-special-event-permitting",
            "channel": "Requested with the closure application.",
            "youAdd": "nothing.",
            "paperAgency": "San Francisco Municipal Transportation Agency",
            "paperTitle": "Temporary No Parking Sign Request",
            "paperRef": "1 to 4 signs\n$357",
        }
    )

    # 11. Public Works temporary occupancy
    missing = need("site", "structures")
    if missing:
        status, why = "pending", ""
    elif f.get("site") == "sidewalk" and f.get("structures") != "none":
        status, why = "required", "Structures on the sidewalk."
    else:
        status = "no"
        why = (
            "Covered by the street closure."
            if f.get("site") == "street"
            else "Nothing on the sidewalk."
        )
    out.append(
        {
            "id": "dpw",
            "name": "Temporary occupancy permit",
            "agency": "Public Works",
            "status": status,
            "why": why,
            "missing": missing,
            "lead": 5,
            "fee": 0,
            "feeLabel": "per block face, per day",
            "purpose": (
                "Lets you set things on the sidewalk while keeping a 4-foot clear path "
                "for pedestrians."
            ),
            "url": "https://sfpublicworks.org/services/permits/temporary-occupancy",
            "channel": "Submit through the Public Works permit portal.",
            "youAdd": "certificate of insurance.",
            "paperAgency": "San Francisco Public Works",
            "paperTitle": "Temporary Occupancy Permit Application",
            "paperRef": "Bureau of Street Use\n5 business days",
        }
    )

    # 12. Park special event permit
    missing = need("site")
    if missing:
        status, why = "pending", ""
    elif f.get("site") == "park":
        status, why = "required", "City park event."
    else:
        status, why = "no", "Not in a park."
    out.append(
        {
            "id": "rpd",
            "name": "Park special event permit",
            "agency": "Recreation and Parks",
            "status": status,
            "why": why,
            "missing": missing,
            "lead": 60,
            "fee": 85,
            "feeLabel": "$85 + venue fee",
            "purpose": ("The single permit for events in a city park. Venue fees vary by site."),
            "url": "https://sfrecpark.org/541/Special-Event-Application-Information",
            "channel": (
                "Submit to the Rec and Park special events office and pay the $85 fee by phone."
            ),
            "youAdd": "certificate of insurance, $2M.",
            "paperAgency": "San Francisco Recreation and Park Department",
            "paperTitle": "Special Event Application",
            "paperRef": "60 days prior\n$85",
        }
    )

    # 13. Port special event license
    missing = need("site")
    if missing:
        status, why = "pending", ""
    elif f.get("site") == "waterfront":
        status, why = "required", "Port property."
    else:
        status, why = "no", "Not on Port property."
    out.append(
        {
            "id": "port",
            "name": "Port special event license",
            "agency": "Port of San Francisco",
            "status": status,
            "why": why,
            "missing": missing,
            "lead": 120,
            "fee": 0,
            "feeLabel": "set by license",
            "purpose": (
                "A license to use Port property, needed for any event on the waterfront "
                "regardless of size."
            ),
            "url": "https://www.sfport.com/form/special-event-permit-application",
            "channel": "Submit the Port special events form, Pier 1.",
            "youAdd": "certificate of insurance, $1M to $5M.",
            "paperAgency": "Port of San Francisco",
            "paperTitle": "Special Event Permit Application",
            "paperRef": "120 days prior",
        }
    )

    return out


def extras(r: dict, f: dict, days: int | None) -> dict:
    """Fee basis, per-vendor variable, and limits text for this event. Port of extras()."""
    tier_name = (
        ""
        if days is None
        else "90+ day tier"
        if days >= 90
        else "60 to 89 day tier"
        if days >= 60
        else "30 to 59 day tier"
        if days >= 30
        else "under the 30 day minimum"
    )
    acts = (1 if f.get("food") == "vendor_high" else 0) + (
        1 if f.get("structures") == "large" else 0
    )
    vendor = 286 if f.get("food") == "vendor_high" else 146
    se_idx = 3
    if days is not None:
        se_idx = 0 if days >= 120 else 1 if days >= 90 else 2 if days >= 60 else 3
    se_regular = [1331, 1665, 1998, 2441][se_idx]
    m = {
        "bp": {
            "fee": f"${r['fee']}, {tier_name}. Drops to $58 at 90 days.",
            "variable": 0,
            "limits": (
                "One block, residential, no Muni. Under 8 hours between 7am and 10pm. "
                "Nothing sold, no alcohol, no stages. Grills stay on private property."
            ),
        },
        "se": {
            "fee": (
                f"From ${r['fee']} (small community, {tier_name}) to ${se_regular:,} regular rate."
            ),
            "variable": 0,
            "limits": (
                "14-foot emergency lane the full length. Sidewalks and intersections "
                "stay open. ISCOTT can decline arterials and transit streets."
            ),
        },
        "ent": {
            "fee": "$586 flat. Waivable for nonprofits and free public events.",
            "variable": 0,
            "limits": (
                "Up to 6 hours of sound per day, 9am to 10pm. Up to 12 days per year "
                "at one location."
            ),
        },
        "dph": {
            "fee": (
                f"$211 sponsor fee, plus ${vendor} per vendor "
                f"({'high' if f.get('food') == 'vendor_high' else 'low'} hazard). "
                "One vendor assumed."
            ),
            "variable": vendor,
            "limits": (
                "Food from an approved kitchen or prepackaged. Enclosed booth with "
                "handwashing. No home-cooked food for sale."
            ),
        },
        "fire": {
            "fee": (
                "$436 base"
                + (" + $95 for the second activity" if acts > 1 else "")
                + ". Fire watch billed separately if required."
            ),
            "variable": 0,
            "limits": (
                "No cooking inside a tent open to the public. Under 20 gallons of "
                "propane per 10x10 booth. Cooking 20 ft from tents, 10 ft from booths. "
                "Tents over 400 sq ft."
            ),
        },
        "sec": {
            "fee": "No fee. SFPD officers, if required, from $160 per hour.",
            "variable": 0,
            "limits": (
                "Required over 500 people. One-sentence answers get rejected. SFPD has "
                "final say on staffing."
            ),
        },
        "med": {
            "fee": "$160 plan review for 1,000 to 4,999 people.",
            "variable": 0,
            "limits": "Required at 1,000 or more. Start 90 days out.",
        },
        "zw": {
            "fee": "No fee. Recology service billed by the hauler.",
            "variable": 0,
            "limits": ("Required at 1,000 or more. Compost and recycling at every waste station."),
        },
        "abc": {
            "fee": "$50 beer and wine, $75 with spirits, per day.",
            "variable": 0,
            "limits": (
                "Nonprofits only. Certified RBS server on site. File between 30 and 10 "
                "days before, not earlier."
            ),
        },
        "signs": {
            "fee": "$357 for 1 to 4 signs, $478 for 5 to 9. $140 late fee under 14 days.",
            "variable": 0,
            "limits": "Signs post 72 hours ahead. Optional for block parties.",
        },
        "dpw": {
            "fee": "Per block face, per day, from the Public Works schedule.",
            "variable": 0,
            "limits": "4-foot clear path on the sidewalk, 6 feet in commercial areas.",
        },
        "rpd": {
            "fee": (
                "$85 application, plus a venue fee set by the park. Sound adds $743, "
                "or $103 for nonprofits."
            ),
            "variable": 0,
            "limits": ("Apply 60 days to 1 year out. Cancellation inside 30 days forfeits fees."),
        },
        "port": {
            "fee": "Set by the license. Nonprofits get 25 to 50 percent off.",
            "variable": 0,
            "limits": "120 days lead. Port Good Neighbor standards apply.",
        },
    }
    return m.get(r["id"], {"fee": r["feeLabel"], "variable": 0, "limits": r["why"]})


def _fmt_short(iso: str | None) -> str:
    if not iso:
        return "that day"
    d = date_cls.fromisoformat(iso)
    return f"{d.strftime('%b')} {d.day}"


def site_check(f: dict) -> dict:
    """Derived from facts, the way the prototype's siteCheck block is.

    TODO: the real version geocodes `address` and intersects it against the
    DataSF layers named in `checks` (Muni routes, street classification, ISCOTT
    closures 8x25-yybr, park and Port boundaries). Until then the results below
    are asserted from the facts, not from a spatial query.
    """
    site = f.get("site")
    site_name = f.get("address") or (
        "the park" if site == "park" else "the waterfront" if site == "waterfront" else "the site"
    )
    when = _fmt_short(f.get("date"))
    iso = f.get("date") or ""

    if site == "street" and f.get("scope") == "one_block":
        return {
            "status": "ok",
            "title": f"{site_name} qualifies for a block party closure",
            "text": (
                "Residential block with no Muni line on it. No other closure is booked "
                f"there on {when}."
            ),
            "checks": [
                {"layer": "muni_routes", "dataset": "DataSF", "result": "no route on segment"},
                {"layer": "street_classification", "dataset": "DataSF", "result": "residential"},
                {
                    "layer": "iscott_closures",
                    "dataset": "8x25-yybr",
                    "result": f"no conflict on {iso}" if iso else "no conflict found",
                },
            ],
        }
    if site == "street":
        return {
            "status": "caution",
            "title": f"{site_name} needs a special event closure",
            "text": (
                "Muni service or more than one block. ISCOTT reviews these in public "
                "and can decline arterials, so apply early."
            ),
            "checks": [
                {
                    "layer": "muni_routes",
                    "dataset": "DataSF",
                    "result": "transit route or multi-block segment",
                },
                {
                    "layer": "street_classification",
                    "dataset": "DataSF",
                    "result": "not a single residential block",
                },
                {
                    "layer": "iscott_closures",
                    "dataset": "8x25-yybr",
                    "result": f"no conflict on {iso}" if iso else "no conflict found",
                },
            ],
        }
    if site == "sidewalk":
        return {
            "status": "ok",
            "title": f"{site_name}, sidewalk only",
            "text": (
                "No street closure. A 4-foot clear path stays open the whole time, "
                "6 feet in commercial areas."
            ),
            "checks": [
                {
                    "layer": "street_classification",
                    "dataset": "DataSF",
                    "result": "sidewalk, no roadway closure",
                }
            ],
        }
    owner = "Rec and Park property" if site == "park" else "Port property"
    layer = "park_boundaries" if site == "park" else "port_boundaries"
    return {
        "status": "different_track",
        "title": f"{site_name} is {owner}",
        "text": (
            "A different track from the street process. One permit from the property "
            "owner, then activity permits on top."
        ),
        "checks": [{"layer": layer, "dataset": "DataSF", "result": owner.lower()}],
    }


def determine(facts: dict, today: date_cls | None = None) -> dict:
    """The /api/determine response. Money in integer cents."""
    today = today or date_cls.today()
    f = {k: v for k, v in (facts or {}).items() if v is not None}
    event_date = f.get("date")
    days = _days_out(event_date, today)
    rs = rules(f, days)

    permits = []
    fixed_cents = 0
    per_vendor_cents = 0
    first: tuple[date_cls, str] | None = None

    for r in rs:
        ex = extras(r, f, days)
        status = _STATUS[r["status"]]
        citation = _citation(r["url"], r["why"] or r["purpose"])
        due_date = None
        if event_date:
            due_date = (date_cls.fromisoformat(event_date) - timedelta(days=r["lead"])).isoformat()
        if status == "required":
            fixed_cents += r["fee"] * 100
            per_vendor_cents += ex["variable"] * 100
            if due_date:
                d = date_cls.fromisoformat(due_date)
                if first is None or d < first[0]:
                    first = (d, r["id"])
        permits.append(
            {
                "id": r["id"],
                "name": r["name"],
                "agency": r["agency"],
                "status": status,
                "why": r["why"],
                "missing_facts": r["missing"] if status == "pending" else [],
                "purpose": r["purpose"],
                "lead_days": r["lead"],
                "due_date": due_date,
                "fee_cents": r["fee"] * 100,
                "fee_basis": ex["fee"],
                "limits": _split_limits(ex["limits"], citation),
                "channel": r["channel"],
                "self_serve_url": r["url"],
                "you_must_add": _split_you_add(r["youAdd"]),
                "citation": citation,
            }
        )

    notes = (
        f"Includes ${per_vendor_cents // 100:,} per food vendor, one assumed. "
        "Fee waivers exist for nonprofits."
        if per_vendor_cents
        else "Fee waivers exist for nonprofits and free public events."
    )
    first_deadline = None
    if first:
        first_deadline = {
            "date": first[0].isoformat(),
            "permit_id": first[1],
            "days_from_now": (first[0] - today).days,
        }

    return {
        "site_check": site_check(f),
        "fees": {
            "fixed_cents": fixed_cents,
            "per_vendor_cents": per_vendor_cents,
            "notes": notes,
        },
        "first_deadline": first_deadline,
        "permits": permits,
    }
