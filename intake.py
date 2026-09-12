"""Intake schema, regex fallback extraction, and ask ordering.

Ported from `questions()`, `extract()` and `matchOption()` in the prototype at
design/canvas/Main.dc.html. Prompts, option labels and match patterns are kept
verbatim so the backend asks exactly what the prototype asked.
"""

import re
from datetime import date as date_cls
from datetime import timedelta

# Facts that intake asks once and every form autofills from.
SHARED_FACTS = (
    "organizer",
    "email",
    "phone",
    "address",
    "date",
    "hours",
    "attendance",
    "event_name",
)

MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]

_EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+\.[\w.]+")
_PHONE_RE = re.compile(r"\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}")
_FILLER_RE = re.compile(r"\b(i am|i'm|it's|its|my name is|this is)\b", re.I)
_ADDRESS_RE = re.compile(
    r"(\d{2,5}\s+block\s+of\s+[A-Z][\w']+(?:\s[A-Z][\w']+)?\s(?:St|Street|Ave|Avenue|Blvd|Way|Dr|Pl))"
    r"|(\d{1,5}\s+[A-Z][\w']+(?:\s[A-Z][\w']+)?\s(?:St|Street|Ave|Avenue|Blvd|Way|Dr|Pl))"
)
_MONTH_RE = re.compile(
    r"\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})\b"
)
_HOURS_RE = re.compile(
    r"((?:\d{1,2}(?::\d{2})?\s*(?:am|pm)?)|noon|midnight)"
    r"\s*(?:to|-|until)\s*"
    r"((?:\d{1,2}(?::\d{2})?\s*(?:am|pm)?)|noon|midnight)",
    re.I,
)
_ATTENDANCE_RE = re.compile(
    r"(~|about|around|roughly)?\s*(\d[\d,]*)\s*(people|folks|guests|attendees|neighbors|ppl)"
)


def _opt(label: str, value, match: str | None = None) -> dict:
    o: dict = {"label": label, "value": value}
    if match:
        o["match"] = re.compile(match)
    return o


def questions(today: date_cls | None = None) -> list[dict]:
    """The question list in ask order, with match patterns attached.

    Same 12 questions, prompts, labels and option matchers as the prototype.
    The `date` question's option values are ISO dates rather than the
    prototype's day offsets, so `facts["date"]` is always ISO YYYY-MM-DD.
    """
    today = today or date_cls.today()

    def out(n: int) -> str:
        return (today + timedelta(days=n)).isoformat()

    return [
        {
            "key": "organizer",
            "label": "Organizer",
            "prompt": "Who is organizing? A name, email, and phone. Every form asks for all three.",
            "type": "free",
            "placeholder": "e.g. Maya Reyes, maya@example.com, 415 555 0100",
            "fills": ["organizer", "email", "phone"],
        },
        {
            "key": "site",
            "label": "Location",
            "prompt": "Where does it happen? A street, a sidewalk, a park, or the waterfront?",
            "type": "choice",
            "fills": ["site"],
            "options": [
                _opt("street", "street", r"street|road|block"),
                _opt("sidewalk", "sidewalk", r"sidewalk|curb"),
                _opt("park", "park", r"park|meadow|plaza"),
                _opt("waterfront", "waterfront", r"waterfront|embarcadero|pier|port"),
            ],
        },
        {
            "key": "address",
            "label": "Address",
            "prompt": "Which block or address?",
            "type": "free",
            "placeholder": "e.g. 400 block of Bocana St",
            "fills": ["address"],
        },
        {
            "key": "scope",
            "label": "Street type",
            "prompt": "Is it one residential block with no Muni line, or bigger than that?",
            "type": "choice",
            "only_if": {"site": "street"},
            "fills": ["scope"],
            "options": [
                _opt(
                    "one residential block, no Muni",
                    "one_block",
                    r"one block|single block|residential|no muni|just one|yes",
                ),
                _opt(
                    "more than one block, or a Muni street",
                    "multi",
                    r"more|multi|several|muni|bus|bigger|two|three|not sure|no\b",
                ),
            ],
        },
        {
            "key": "date",
            "label": "Date",
            "prompt": "When is it?",
            "type": "choice",
            "fills": ["date"],
            "options": [
                _opt("about 5 weeks out", out(35)),
                _opt("about 2 months", out(60)),
                _opt("about 3 months", out(95)),
            ],
        },
        {
            "key": "hours",
            "label": "Hours",
            "prompt": "What hours, including setup and cleanup?",
            "type": "free",
            "placeholder": "e.g. noon to 6pm",
            "fills": ["hours"],
        },
        {
            "key": "attendance",
            "label": "Attendance",
            "prompt": "How many people do you expect?",
            "type": "choice",
            "number": True,
            "fills": ["attendance"],
            "options": [
                _opt("under 100", 80),
                _opt("100 to 500", 300),
                _opt("500 to 1,000", 750),
                _opt("1,000 or more", 1500),
            ],
        },
        {
            "key": "food",
            "label": "Food",
            "prompt": (
                "Any food? Neighbors bringing their own, a prepackaged vendor, "
                "or someone cooking on site?"
            ),
            "type": "choice",
            "fills": ["food"],
            "options": [
                _opt("none", "none", r"^no|none|nothing|potluck|bring|their own|neighbors"),
                _opt("prepackaged vendor", "vendor_low", r"prepack|packaged|chips|bottled"),
                _opt(
                    "cooking on site",
                    "vendor_high",
                    r"cook|taco|grill|bbq|truck|hot|vendor|cater",
                ),
            ],
        },
        {
            "key": "sound",
            "label": "Sound",
            "prompt": "Music or amplified sound?",
            "type": "choice",
            "fills": ["sound"],
            "options": [
                _opt("none", "none", r"^no|none|nothing|quiet"),
                _opt("acoustic only", "acoustic", r"acoustic|unplugged"),
                _opt(
                    "amplified, up to 6 hours",
                    "amp_short",
                    r"amp|speaker|dj|band|music|pa\b|yes",
                ),
                _opt(
                    "amplified, longer or after 10pm",
                    "amp_long",
                    r"all day|late|after 10|more than 6|long",
                ),
            ],
        },
        {
            "key": "alcohol",
            "label": "Alcohol",
            "prompt": "Will alcohol be served or sold?",
            "type": "choice",
            "fills": ["alcohol"],
            "options": [
                _opt("no", "none", r"^no|none|nothing|dry"),
                _opt("yes, hosted by a nonprofit", "nonprofit", r"nonprofit|non-profit|501"),
                _opt("yes, not a nonprofit", "private", r"yes|beer|wine|booze|drinks"),
            ],
        },
        {
            "key": "structures",
            "label": "Setup",
            "prompt": "Anything set up in the street or on the sidewalk?",
            "type": "choice",
            "fills": ["structures"],
            "options": [
                _opt("nothing", "none", r"^no|none|nothing"),
                _opt(
                    "tables, chairs, a bounce house",
                    "small",
                    r"table|chair|bounce|canopy|tent|cornhole|small",
                ),
                _opt(
                    "a large tent, stage, or generator",
                    "large",
                    r"stage|generator|large|big",
                ),
            ],
        },
        {
            "key": "sales",
            "label": "Sales",
            "prompt": "Will anything be sold?",
            "type": "choice",
            "fills": ["sales"],
            "options": [
                _opt("nothing sold", "no", r"^no|none|nothing|free"),
                _opt("yes, vendors or merchandise", "yes", r"yes|sell|vendor|merch|tickets"),
            ],
        },
    ]


def intake_schema(today: date_cls | None = None) -> dict:
    """The JSON-safe question list for GET /api/intake/schema."""
    out = []
    for q in questions(today):
        item = {
            "key": q["key"],
            "label": q["label"],
            "prompt": q["prompt"],
            "type": q["type"],
            "options": [{"label": o["label"], "value": o["value"]} for o in q.get("options", [])],
            "only_if": q.get("only_if"),
            "placeholder": q.get("placeholder"),
            "fills": q.get("fills", [q["key"]]),
        }
        if q.get("number"):
            item["number"] = True
        out.append(item)
    return {"questions": out}


def _known(facts: dict, key: str) -> bool:
    return facts.get(key) is not None


def _applies(q: dict, facts: dict) -> bool:
    only_if = q.get("only_if")
    if not only_if:
        return True
    return all(facts.get(k) == v for k, v in only_if.items())


def next_question(facts: dict) -> str | None:
    """The key of the next question to ask, or None when the fact set is complete."""
    for q in questions():
        if not _applies(q, facts):
            continue
        if not _known(facts, q["key"]):
            return q["key"]
    return None


def parse_free(key: str, text: str) -> dict:
    """The prototype's per-question `parse` for free-text answers."""
    if key == "organizer":
        email_m = _EMAIL_RE.search(text)
        phone_m = _PHONE_RE.search(text)
        email = email_m.group(0) if email_m else ""
        phone = phone_m.group(0) if phone_m else ""
        name = text.replace(email, "").replace(phone, "")
        name = re.sub(r"[,;]+\s*$", "", name)
        name = _FILLER_RE.sub("", name)
        name = name.replace(",", "").replace(";", "").strip()
        return {"organizer": name or "You", "email": email, "phone": phone}
    return {key: text.strip()}


def match_option(question: dict, text: str) -> dict | None:
    """Port of matchOption(): label substring first, then the option's regex."""
    t = text.lower().strip()
    if question.get("number"):
        n = re.search(r"\d[\d,]*", t)
        if n:
            v = int(n.group(0).replace(",", ""))
            return {"value": v, "label": f"About {v:,}"}
    options = question.get("options", [])
    for o in options:
        if o["label"].lower().split(",")[0] in t:
            return {"label": o["label"], "value": o["value"]}
    for o in options:
        if o.get("match") and o["match"].search(t):
            return {"label": o["label"], "value": o["value"]}
    return None


def parse_date(text: str, today: date_cls | None = None) -> str | None:
    """Month-name plus day, rolled to the next occurrence. Returns ISO."""
    today = today or date_cls.today()
    m = _MONTH_RE.search(text.lower())
    if not m:
        return None
    month = MONTHS.index(m.group(1)) + 1
    day = int(m.group(2))
    try:
        d = date_cls(today.year, month, day)
    except ValueError:
        return None
    if d < today:
        d = date_cls(today.year + 1, month, day)
    return d.isoformat()


def _fmt_short(iso: str) -> str:
    d = date_cls.fromisoformat(iso)
    return f"{d.strftime('%b')} {d.day}"


def extract_fallback(text: str, today: date_cls | None = None) -> tuple[dict, list[dict]]:
    """Pure-regex extraction. Port of extract() in the prototype.

    Returns (facts, found) where found entries are
    {"fact": key, "label": human string, "confidence": high|medium}.
    """
    t = text.lower()
    f: dict = {}
    found: list[dict] = []

    def note(fact: str, label: str, confidence: str = "high") -> None:
        found.append({"fact": fact, "label": label, "confidence": confidence})

    if re.search(r"block party|block\b", t):
        f["site"] = "street"
        f["scope"] = "one_block"
        note("site", "Street event, one block")
    if re.search(r"street fair|street festival|festival", t):
        f["site"] = "street"
        f["scope"] = "multi"
        f["sales"] = "yes"
        note("site", "Street fair, multiple blocks")
    if re.search(r"sidewalk", t):
        f["site"] = "sidewalk"
        note("site", "Sidewalk")
    if re.search(r"\bpark\b|dolores|golden gate park|precita", t):
        f["site"] = "park"
        note("site", "Park")
    if re.search(r"pier|embarcadero|waterfront|ferry building", t):
        f["site"] = "waterfront"
        note("site", "Port property")

    addr_m = _ADDRESS_RE.search(text)
    if addr_m:
        f["address"] = addr_m.group(0)
        note("address", "Address: " + addr_m.group(0))

    iso = parse_date(text, today)
    if iso:
        f["date"] = iso
        note("date", "Date: " + _fmt_short(iso))

    hrs = _HOURS_RE.search(text)
    if hrs:
        f["hours"] = re.sub(r"\s+", " ", hrs.group(0))
        note("hours", "Hours: " + f["hours"])

    n = _ATTENDANCE_RE.search(t)
    if n:
        f["attendance"] = int(n.group(2).replace(",", ""))
        note("attendance", f"About {f['attendance']} people", "medium")

    if re.search(r"taco|food truck|vendor|bbq|barbecue|grill|cook|caterer|catering", t):
        f["food"] = "vendor_high"
        note("food", "Food vendor cooking on site")
    elif re.search(r"prepackaged|packaged snacks", t):
        f["food"] = "vendor_low"
        note("food", "Prepackaged food vendor")
    elif re.search(r"potluck|snacks|pizza|neighbors bring", t):
        f["food"] = "none"
        note("food", "Neighbors bringing food")

    if re.search(r"\bdj\b|band|amplif|speaker|live music|pa system|sound system", t):
        f["sound"] = "amp_short"
        note("sound", "Amplified sound")
    elif re.search(r"acoustic", t):
        f["sound"] = "acoustic"
        note("sound", "Acoustic only")

    if re.search(r"no (booze|alcohol|beer|drinking)|dry event|alcohol[- ]free", t):
        f["alcohol"] = "none"
        note("alcohol", "No alcohol")
    elif re.search(r"beer|wine|booze|alcohol|cocktail|bar\b", t):
        f["alcohol"] = "nonprofit"
        note("alcohol", "Alcohol served", "medium")

    if re.search(r"stage|generator|big tent|large tent", t):
        f["structures"] = "large"
        note("structures", "Large tent, stage, or generator")
    elif re.search(r"bounce|tent|canopy|tables|chairs|cornhole", t):
        f["structures"] = "small"
        note("structures", "Small setup in the roadway", "medium")

    if re.search(r"sell|selling|for sale|merch|booths|market", t):
        f["sales"] = "yes"
        note("sales", "Things for sale")
    elif re.search(r"free for|free food|giving away|no charge|nothing sold|not selling", t):
        f["sales"] = "no"
        note("sales", "Nothing sold")

    email_m = _EMAIL_RE.search(text)
    if email_m:
        f["email"] = email_m.group(0)
        note("email", "Contact: " + email_m.group(0))

    kind = (
        "block party"
        if re.search(r"block party", t)
        else "street fair"
        if re.search(r"street fair|festival", t)
        else "event"
    )
    street = ""
    if addr_m:
        street = re.sub(r"^\d+\s+block\s+of\s+", "", addr_m.group(0))
        street = re.sub(r"^\d+\s+", "", street)
    f["event_name"] = f"{street} {kind}" if street else kind[0].upper() + kind[1:]
    return f, found
