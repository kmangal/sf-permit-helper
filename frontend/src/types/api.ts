// Wire shapes for the permit API. Contract: docs/API_CONTRACT.md

export type FactValue = string | number | boolean | null;

/** What we know about the event. Every key optional until asked. */
export type Facts = Record<string, FactValue>;

export interface ApiErrorBody {
  code: string;
  message: string;
  missing?: string[];
}

// ---------- navigator ----------

export interface Option {
  label: string;
  value: FactValue;
}

export interface KnownFact {
  fact: string;
  prompt: string;
  value: FactValue;
  label: string;
  by: "jev" | "user";
}

export interface Source {
  id: string;
  title: string;
  publisher: string;
  url: string;
}

/** The rules file's own fee shape. */
export interface Fee {
  amount_usd?: number;
  amount_usd_from?: number;
  range_usd?: [number, number];
  amendment_usd?: number;
  note?: string;
  /** Provenance: a source id, the verbatim quote, and when it was taken. */
  source: string;
  quote: string;
  derived?: string;
  fetched_on: string;
  effective_from?: string;
  effective_to?: string;
}

/** The rules file's own lead-time shape. */
export interface LeadTime {
  min_days?: number;
  max_days?: number;
  min_business_days?: number;
  hard_floor_days?: number;
  override_note?: string;
}

export interface Rule {
  id: string;
  kind: string;
  title: string;
  agency?: string | null;
  confidence?: string;
  fee?: Fee | null;
  lead_time?: LeadTime | null;
  notes?: string | null;
  limits?: string | null;
  verify?: string | null;
  part_of?: string | null;
  sources: Source[];
}

export interface RuleRef {
  id: string;
  kind: string;
  title: string;
  agency?: string | null;
}

export interface QuestionTurn {
  session_id: string;
  kind: "question";
  fact: string;
  prompt: string;
  type: "bool" | "enum" | "int" | "number";
  options: Option[];
  because: string[];
  attempts_left: number;
  rejected?: string;
  known: KnownFact[];
}

export type TerminalStatus = "complete" | "out_of_scope" | "blocked";

export interface TerminalTurn {
  session_id: string;
  kind: "terminal";
  status: TerminalStatus;
  blocking_rule?: string;
  rules: Rule[];
  by_kind: Record<string, string[]>;
  not_needed: RuleRef[];
  facts: Facts;
  answered_by: Record<string, "jev" | "user">;
  known: KnownFact[];
}

export interface AbortedTurn {
  session_id: string;
  kind: "aborted";
  message: string;
  fact: string;
  known?: KnownFact[];
}

/** The description was not an event; the session is gone and a new description may be sent. */
export interface OffTopicTurn {
  session_id: string;
  kind: "off_topic";
  message: string;
  known?: KnownFact[];
}

export type NavigatorTurn = QuestionTurn | TerminalTurn | AbortedTurn | OffTopicTurn;
