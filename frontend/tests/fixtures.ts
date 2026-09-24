// Small, realistic API payloads for tests.

import type { Permit } from "../src/lib/rules.ts";
import type { KnownFact, QuestionTurn, Rule, TerminalTurn } from "../src/types/api.ts";

export const source = {
  id: "sfmta_block_party",
  title: "Host a neighborhood block party",
  publisher: "sf.gov",
  url: "https://www.sf.gov/host-a-neighborhood-block-party",
};

export function rule(overrides: Partial<Rule> = {}): Rule {
  return {
    id: "sfmta_closure",
    kind: "permit",
    title: "Street closure",
    agency: "SFMTA",
    fee: { amount_usd: 122 },
    lead_time: { min_days: 30 },
    notes: "Closes your block to traffic.",
    limits: null,
    verify: null,
    part_of: null,
    sources: [source],
    ...overrides,
  };
}

export const known: KnownFact[] = [
  { fact: "location", prompt: "Where?", value: "street", label: "street_or_sidewalk", by: "jev" },
  { fact: "attendance", prompt: "How many?", value: 80, label: "50 to 100", by: "user" },
];

export function terminal(overrides: Partial<TerminalTurn> = {}): TerminalTurn {
  return {
    session_id: "s1",
    kind: "terminal",
    status: "complete",
    rules: [rule()],
    by_kind: { permit: ["sfmta_closure"] },
    not_needed: [{ id: "abc_license", kind: "license", title: "Alcohol license", agency: "ABC" }],
    facts: { date: "2099-10-24", event_name: "Bocana St block party" },
    answered_by: { location: "jev", attendance: "user" },
    known,
    ...overrides,
  };
}

export function question(overrides: Partial<QuestionTurn> = {}): QuestionTurn {
  return {
    session_id: "s1",
    kind: "question",
    fact: "attendance",
    prompt: "How many people?",
    type: "int",
    options: [
      { label: "under_50", value: 25 },
      { label: "50_to_100", value: 75 },
    ],
    because: ["sfmta_closure"],
    attempts_left: 3,
    known: known.slice(0, 1),
    ...overrides,
  };
}

export function permit(overrides: Partial<Permit> = {}): Permit {
  return {
    id: "sfmta_closure",
    kind: "permit",
    name: "Street closure",
    agency: "SFMTA",
    purpose: "Closes your block to traffic.",
    lead_days: 30,
    lead_text: "At least 30 days before the event.",
    fee_basis: "$122",
    limits: [],
    verify: "",
    self_serve_url: source.url,
    sources: [source],
    ...overrides,
  };
}
