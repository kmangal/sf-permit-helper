// Form filling as a pure reducer. The filler steps through fields in order,
// logging each one to the feed, and pauses on any `ask` field left empty.

import type { Ask, FormField, FormSection, FormSpec } from "../types/api.ts";

/** Facts written on one form land on every other loaded form. */
export const SHARED_KEYS = ["organizer", "email", "phone", "address"] as const;

export function isShared(key: string): boolean {
  return (SHARED_KEYS as readonly string[]).includes(key);
}

export interface FeedEntry {
  kind: "fill" | "ask" | "done" | "sent";
  text: string;
  sub?: string;
}

export interface FormFill {
  /** Index of the next field to fill, across all sections. */
  progress: number;
  answers: Record<string, string>;
  feed: FeedEntry[];
  /** Paused on the field at `progress` until the user answers. */
  waiting: boolean;
  done: boolean;
  spec: FormSpec | null;
  /** Null until the spec loads. Shared-fact edits rewrite these values. */
  sections: FormSection[] | null;
}

export type FillMap = Record<string, FormFill>;

export type FillAction =
  | { type: "start"; id: string }
  | { type: "loaded"; id: string; spec: FormSpec }
  | { type: "failed"; id: string }
  | { type: "step"; id: string; at: number; doneSub: string }
  | { type: "answer"; id: string; key: string; value: string }
  | { type: "edit"; id: string; key: string; value: string }
  | { type: "shared"; key: string; value: string }
  | { type: "log"; id: string; entry: FeedEntry };

export function flatten(sections: FormSection[] | null | undefined): FormField[] {
  return (sections ?? []).flatMap((sec) => sec.fields ?? []);
}

/** The question to put to the user for a field, if it can be asked. */
export function askOf(field: FormField | undefined): Ask | null {
  if (!field) return null;
  if (field.ask) return field.ask;
  if (field.source === "ask")
    return { prompt: "What goes in " + field.label + "?", hint: "", placeholder: "" };
  return null;
}

function valueOf(st: FormFill, field: FormField): string {
  return st.answers[field.key] ?? field.value ?? "";
}

/** The field the filler is paused on, if any. */
export function pendingField(st: FormFill | undefined): FormField | undefined {
  if (!st?.waiting) return undefined;
  return flatten(st.sections)[st.progress];
}

/** True while the step timer should keep running for this form. */
export function needsStep(st: FormFill): boolean {
  return !!st.sections && !st.waiting && !st.done;
}

export function isComplete(st: FormFill | undefined): boolean {
  return !!st?.sections && st.progress >= flatten(st.sections).length;
}

const EMPTY: FormFill = {
  progress: 0,
  answers: {},
  feed: [],
  waiting: false,
  done: false,
  spec: null,
  sections: null,
};

function patch(state: FillMap, id: string, fn: (st: FormFill) => FormFill): FillMap {
  const st = state[id];
  if (!st) return state;
  const next = fn(st);
  return next === st ? state : { ...state, [id]: next };
}

function step(st: FormFill, at: number, doneSub: string): FormFill {
  if (!needsStep(st) || st.progress !== at) return st;
  const flat = flatten(st.sections);
  const field = flat[st.progress];
  if (!field) {
    return { ...st, done: true, feed: [...st.feed, { kind: "done", text: "Form complete", sub: doneSub }] };
  }
  const value = valueOf(st, field);
  const label = field.label.toLowerCase();
  if (!value && askOf(field)) {
    return { ...st, waiting: true, feed: [...st.feed, { kind: "ask", text: "Need from you: " + label }] };
  }
  return {
    ...st,
    progress: st.progress + 1,
    feed: [
      ...st.feed,
      value
        ? { kind: "fill", text: "Filled " + label, sub: value }
        : { kind: "fill", text: "Left blank: " + label, sub: "nothing to fill from" },
    ],
  };
}

function withShared(st: FormFill, key: string, value: string): FormFill {
  if (!st.sections || st.answers[key] !== undefined) return st;
  return {
    ...st,
    sections: st.sections.map((sec) => ({
      ...sec,
      fields: sec.fields.map((f) => (f.key === key ? { ...f, value } : f)),
    })),
  };
}

export function fillReducer(state: FillMap, action: FillAction): FillMap {
  switch (action.type) {
    case "start":
      return state[action.id] ? state : { ...state, [action.id]: EMPTY };
    case "loaded":
      return patch(state, action.id, (st) => ({
        ...st,
        spec: action.spec,
        sections: action.spec.sections ?? [],
      }));
    case "failed": {
      const next = { ...state };
      delete next[action.id];
      return next;
    }
    case "step":
      return patch(state, action.id, (st) => step(st, action.at, action.doneSub));
    case "answer":
      return patch(state, action.id, (st) => ({
        ...st,
        waiting: false,
        answers: { ...st.answers, [action.key]: action.value },
      }));
    case "edit":
      return patch(state, action.id, (st) => ({
        ...st,
        answers: { ...st.answers, [action.key]: action.value },
      }));
    case "shared": {
      const next: FillMap = {};
      for (const [id, st] of Object.entries(state)) next[id] = withShared(st, action.key, action.value);
      return next;
    }
    case "log":
      return patch(state, action.id, (st) => ({ ...st, feed: [...st.feed, action.entry] }));
  }
}

// ---------- views ----------

export type FieldStatus = "empty" | "filled" | "waiting";

export interface FieldView {
  key: string;
  label: string;
  value: string;
  span: 1 | 2;
  status: FieldStatus;
  /** Whether the user may edit it once filled. */
  editable: boolean;
}

export interface SectionView {
  title: string;
  fields: FieldView[];
}

/** Each field's value and fill status, for the paper. */
export function fieldViews(st: FormFill | undefined): SectionView[] {
  if (!st?.sections) return [];
  let idx = 0;
  return st.sections.map((sec) => ({
    title: sec.title,
    fields: sec.fields.map((f) => {
      const i = idx++;
      const value = valueOf(st, f);
      const status: FieldStatus =
        st.waiting && i === st.progress ? "waiting" : i < st.progress && value !== "" ? "filled" : "empty";
      return {
        key: f.key,
        label: f.label,
        value,
        span: f.span ?? 1,
        status,
        editable: status === "filled" && f.editable !== false,
      };
    }),
  }));
}

export type PillTone = "sent" | "idle" | "waiting" | "filling" | "ready";

/** The status pill beside each form in the forms list. */
export function formPill(st: FormFill | undefined, sent: boolean): { label: string; tone: PillTone } {
  if (sent) return { label: "Sent", tone: "sent" };
  if (!st) return { label: "Not started", tone: "idle" };
  if (st.waiting) return { label: "Needs you", tone: "waiting" };
  if (!isComplete(st)) return { label: "Filling", tone: "filling" };
  return { label: "Ready", tone: "ready" };
}

/** "photos of the posted notice." or "nothing." */
export function youAddLine(list: string[]): string {
  if (!list.length) return "nothing.";
  const s = list.join(", ");
  return /[.!?]$/.test(s) ? s : s + ".";
}
