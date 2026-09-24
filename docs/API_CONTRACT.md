# API contract

What the frontend calls. Every determination carries a citation; the LLM never decides whether a permit applies.

Base path `/api`. JSON in, JSON out. No auth for now.

## `POST /api/navigator` and `POST /api/navigator/{session_id}`

Walks the rules file (`backend/app/engine/rules.yaml`) one question at a time. For each question jev picks an answer from the description, or says "unknown", and then the question goes to the user. Sessions live in memory and are dropped once they end.

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
{ "error": { "code": "unknown_session", "message": "No open navigator session '07a8...'.", "missing": [] } }
```

Codes: `unknown_session`.

## Not in scope

Filling out or submitting permit applications. The app stops at the list of permits; each one links to where to apply. No city submission API exists for any of these permits.
