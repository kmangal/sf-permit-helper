# API contract

What the frontend calls. Derived from the prototype in `design/canvas/Main.dc.html`, where `rules()` and `extras()` are the reference implementations. Every determination carries a citation; the LLM never decides whether a permit applies.

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
      "you_must_add": ["photos of the posted notice"],
      "citation": { }
    }
  ]
}
```

Money in integer cents. `not_needed` permits come back too, with `why`, for the "checked and not needed" list.

Rules live in code with a `citation` each, not in a prompt. When a source page's `last_published_at` changes, flag the rule for review rather than trusting it.

## 4. `POST /api/navigator` and `POST /api/navigator/{session_id}`

What the frontend's chat uses. Walks the rules file (`backend/app/rules/sf_event_permits.yaml`) one question at a time. For each question jev picks an answer from the description, or says "unknown", and then the question goes to the user. Sessions live in memory and are dropped once they end.

```jsonc
// start
{ "description": "Block party on our street, about 80 people, a DJ, a taco stand." }
// answer the pending question: an option label (a tapped chip) is taken as is,
// then the fact's own type ("yes", "42", "city_park"), then jev reads free text
{ "answer": "50 to 100" }

// question turn
{
  "session_id": "07a8...", "kind": "question",
  "fact": "recurring_closure", "prompt": "Will the street closure repeat weekly or monthly?",
  "type": "bool",                        // bool | enum | int | number
  "options": [ { "label": "yes", "value": true }, { "label": "no", "value": false } ],
  "because": ["sfmta_block_party_closure"],
  "attempts_left": 3,
  "rejected": "banana",                  // only when the last answer could not be used
  "known": [ { "fact": "location", "prompt": "...", "value": "street_or_sidewalk",
               "label": "street_or_sidewalk", "by": "jev" } ]   // jev | user, in answer order
}

// terminal turn
{
  "session_id": "07a8...", "kind": "terminal",
  "status": "complete",                  // complete | out_of_scope | blocked
  "blocking_rule": "...",                // only for out_of_scope and blocked
  "rules": [ { "id": "sfmta_special_event_closure", "kind": "permit", "title": "...", "agency": "...",
               "confidence": "official", "fee": { }, "lead_time": { "min_days": 30 },
               "notes": "...", "limits": "...", "verify": "...", "part_of": "...",
               "sources": [ { "id": "...", "title": "...", "publisher": "...", "url": "..." } ] } ],
  "by_kind": { "permit": ["..."] },
  "not_needed": [ { "id": "...", "kind": "permit", "title": "...", "agency": "..." } ],
  "facts": { }, "answered_by": { }, "known": [ ]
}

// after three unusable answers to one question
{ "session_id": "07a8...", "kind": "aborted", "message": "Sorry, we cannot help you.", "fact": "..." }
```

`rules` holds only what applies, in application order (`requires` first). `fee` and `lead_time` are the rules file's own shapes. `not_needed` lists the permits and licenses that were ruled out. An unknown or finished session returns 404 `unknown_session`.

## Errors

```jsonc
{ "error": { "code": "insufficient_facts", "message": "Need site and alcohol before determining.", "missing": ["site", "alcohol"] } }
```

Codes: `insufficient_facts`, `unknown_session`, `geocode_failed`, `upstream_unavailable`.

## Not in scope

Filling out or submitting permit applications. The app stops at the list of permits; each one links to where to apply. No city submission API exists for any of these permits.
