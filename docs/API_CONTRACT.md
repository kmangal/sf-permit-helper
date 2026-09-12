# API contract

What the frontend calls. Derived from the prototype in `design/canvas/Main.dc.html`, where `rules()`, `extras()` and `paperSpec()` are the reference implementations. Every determination carries a citation; the LLM never decides whether a permit applies.

Base path `/api`. JSON in, JSON out. No auth for now.

## Shapes used everywhere

```jsonc
// Facts: what we know about the event. Every key optional until asked.
{
  "event_name": "Bocana St block party",
  "organizer": "Maya Reyes",
  "email": "maya@example.com",
  "phone": "(415) 555-0100",
  "site": "street",           // street | sidewalk | park | waterfront
  "address": "400 block of Bocana St",
  "scope": "one_block",       // one_block | multi   (street only)
  "date": "2026-10-24",
  "hours": "noon to 6pm",
  "attendance": 80,
  "food": "vendor_high",      // none | vendor_low | vendor_high
  "sound": "amp_short",       // none | acoustic | amp_short | amp_long
  "alcohol": "none",          // none | nonprofit | private
  "structures": "small",      // none | small | large
  "sales": "no"               // no | yes
}

// Citation: attached to every rule outcome and every limit.
{
  "url": "https://www.sf.gov/host-a-neighborhood-block-party",
  "title": "sf.gov: Host a neighborhood block party",
  "quote": "Single block only on residential streets with no transit service.",
  "fetched_at": "2026-09-12",
  "source_last_published": "2026-08-14"
}
```

## 1. `GET /api/intake/schema`

The question list, in ask order. The frontend renders whatever comes back; it does not hardcode questions.

```jsonc
{
  "questions": [
    { "key": "organizer", "label": "Organizer", "prompt": "Who is organizing? A name, email, and phone.",
      "type": "free", "placeholder": "e.g. Maya Reyes, maya@example.com, 415 555 0100",
      "fills": ["organizer", "email", "phone"] },
    { "key": "site", "label": "Location", "prompt": "Where does it happen?", "type": "choice",
      "options": [ { "label": "on a street", "value": "street" }, { "label": "in a park", "value": "park" } ] },
    { "key": "scope", "label": "Street type", "prompt": "One residential block with no Muni line?",
      "type": "choice", "only_if": { "site": "street" }, "options": [] }
  ]
}
```

`only_if` is a flat equality map. `fills` lets one answer set several facts.

## 2. `POST /api/extract`

Free text to facts. This is the one LLM call in the intake path. It extracts, it does not decide permits.

```jsonc
// request
{ "text": "Block party on the 400 block of Bocana St, Oct 24, about 80 people, a taco stand cooking, no alcohol." }

// response
{
  "facts": { "site": "street", "scope": "one_block", "address": "400 block of Bocana St",
             "date": "2026-10-24", "attendance": 80, "food": "vendor_high", "alcohol": "none" },
  "found": [
    { "fact": "site", "label": "Street event, one block", "confidence": "high" },
    { "fact": "attendance", "label": "About 80 people", "confidence": "medium" }
  ],
  "next_question": "organizer"   // null when the fact set is complete
}
```

`found` drives the animated action log. Anything below `high` confidence should still be confirmed in the ledger, which is editable.

## 3. `POST /api/determine`

The rules engine. Deterministic, no model in the path.

```jsonc
// request
{ "facts": { } }

// response
{
  "site_check": {
    "status": "ok",              // ok | caution | different_track
    "title": "400 block of Bocana St qualifies for a block party closure",
    "text": "Residential block with no Muni line on it. No other closure booked on Oct 24.",
    "checks": [
      { "layer": "muni_routes", "dataset": "DataSF", "result": "no route on segment" },
      { "layer": "street_classification", "result": "residential" },
      { "layer": "iscott_closures", "dataset": "8x25-yybr", "result": "no conflict on 2026-10-24" }
    ]
  },
  "fees": { "fixed_cents": 143300, "per_vendor_cents": 28600, "notes": "Waivers exist for nonprofits." },
  "first_deadline": { "date": "2026-09-24", "permit_id": "bp", "days_from_now": 12 },
  "permits": [
    {
      "id": "bp",
      "name": "Block party street closure",
      "agency": "SFMTA",
      "status": "required",          // required | likely | not_needed | pending
      "why": "One residential block, no Muni, nothing sold, no alcohol.",
      "missing_facts": [],           // non-empty only when status is pending
      "purpose": "Closes your block to traffic for the day.",
      "lead_days": 30,
      "due_date": "2026-09-24",
      "fee_cents": 12200,
      "fee_basis": "$122, 60 to 89 day tier. Drops to $58 at 90 days.",
      "limits": [
        { "text": "Under 8 hours between 7am and 10pm.", "citation": { } },
        { "text": "Nothing sold, no alcohol, no stages.", "citation": { } }
      ],
      "channel": "Submit through the SFMTA online form, then post the notice for 7 days.",
      "self_serve_url": "https://www.sf.gov/host-a-neighborhood-block-party",
      "can_autofill": true,
      "you_must_add": ["photos of the posted notice"],
      "citation": { }
    }
  ]
}
```

Money in integer cents. `not_needed` permits come back too, with `why`, for the "checked and not needed" list.

Rules live in code with a `citation` each, not in a prompt. When a source page's `last_published_at` changes, flag the rule for review rather than trusting it.

## 4. `POST /api/forms/{permit_id}/spec`

The form's fields, filled from facts. Field order is render order.

```jsonc
// request
{ "facts": { }, "answers": { "lpg": "one 5-gallon" } }

// response
{
  "permit_id": "fire",
  "form_title": "BFP Form 1010, Permit Application",
  "agency_full": "San Francisco Fire Department, Bureau of Fire Prevention",
  "reference": "Rev. 7/2024\nFee $436",
  "pdf_template": "bfp-1010-2024.pdf",
  "sections": [
    { "title": "Applicant", "fields": [
      { "key": "organizer", "label": "Applicant name", "value": "Maya Reyes",
        "source": "intake", "span": 1, "editable": true, "pdf_field": "applicant_name" },
      { "key": "lpg", "label": "LP gas on site", "value": "", "source": "ask", "span": 1,
        "ask": { "prompt": "How many propane cylinders, and what size?",
                 "hint": "Under 20 gallons total for a 10x10 booth.", "placeholder": "e.g. one 5-gallon" } }
    ]}
  ]
}
```

`source` is `intake` (autofilled from shared facts), `derived` (computed from facts), `ask` (needs the user), or `user` (they typed or edited it). The filler animates through fields in order, pausing on any `ask` with an empty value.

Shared fields (`organizer`, `email`, `phone`, `address`, `date`, `hours`, `attendance`, `event_name`) are asked once in intake and autofill on every form. Only form-specific fields get asked in the filler.

## 5. `POST /api/forms/{permit_id}/pdf`

Renders the filled PDF, including hand-drawn ink.

```jsonc
// request
{
  "facts": { },
  "answers": { "lpg": "one 5-gallon" },
  "ink": [ { "page": 1, "points": [[412, 690], [418, 684]], "width": 2.2, "color": "#16264d" } ]
}
```

Ink points are in PDF user units, origin top-left of the page, at 96 dpi. The client draws at render scale and converts before sending. Response is `application/pdf`.

Fill with `pypdf` for AcroForm templates. For web-form-only permits (SFMTA, Entertainment Commission) there is no template: return `{"paste_values": {...}, "target_url": "..."}` with 409 instead of a PDF.

## 6. `POST /api/forms/{permit_id}/sent`

Marks a form as submitted. Returns the updated case record. No city API exists to confirm; this is the user's own record.

```jsonc
{ "sent_at": "2026-09-12T14:02:00-07:00", "method": "portal", "note": "" }
```

## Errors

```jsonc
{ "error": { "code": "insufficient_facts", "message": "Need site and alcohol before determining.", "missing": ["site", "alcohol"] } }
```

Codes: `insufficient_facts`, `unknown_permit`, `no_pdf_template`, `geocode_failed`, `upstream_unavailable`.

## Not in scope

No status tracking. No city submission API exists for any of these permits. Anything after "sent" is the user's own record, or a Gmail integration reading confirmation mail.
