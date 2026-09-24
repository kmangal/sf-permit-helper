# API contract

What the frontend calls. Every determination carries a citation; the LLM never decides whether a permit applies.

Base path `/api/v1`. JSON in, JSON out. No auth for now.

The version is in the path. A breaking change to a request or response shape goes under a new version (`/api/v2`), with the old one kept until the frontend has moved over. Adding an optional field is not breaking.

## `POST /api/v1/navigator` and `POST /api/v1/navigator/{session_id}`

Starting a session first asks jev whether the description is an event at all. If it is not, the session ends at once with an `off_topic` turn; if jev fails, the description is taken as an event. Then it walks the rules file (`backend/app/engine/rules.yaml`) one question at a time. For each question jev picks an answer from the description, or says "unknown", and then the question goes to the user. Sessions live in memory and are dropped once they end.

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

// start only: the description is not an event; send a new description to try again
{ "session_id": "07a8...", "kind": "off_topic", "message": "I'm sorry, I'm only able to help with events for now." }

// after three unusable answers to one question
{ "session_id": "07a8...", "kind": "aborted", "message": "Sorry, we cannot help you.", "fact": "..." }
```

`rules` holds only what applies, in application order (`requires` first). `fee` and `lead_time` are the rules file's own shapes. `not_needed` lists the permits and licenses that were ruled out. An unknown or finished session returns 404 `unknown_session`.

## `POST /api/v1/navigator/{session_id}/clarify`

Ask about the pending question instead of answering it. An LLM, briefed as an SF permitting expert, gets the description, what is settled, the pending question and its choices, the rules the question bears on, and earlier clarifications in the session. It explains and may suggest a choice, but records nothing: the question stays pending until the user taps an answer.

```jsonc
{ "question": "Does the band count toward attendance?" }
```

The response is `text/plain; charset=utf-8`, streamed as it is written. It can be empty if the model fails. An unknown or finished session, or one with no pending question, returns 404 `unknown_session`.

## Errors

```jsonc
{ "error": { "code": "unknown_session", "message": "No open navigator session '07a8...'.", "missing": [] } }
```

Codes: `unknown_session`.

## Not in scope

Filling out or submitting permit applications. The app stops at the list of permits; each one links to where to apply. No city submission API exists for any of these permits.
