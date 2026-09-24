// Turns the navigator's terminal result into what the summary shows.
// Rule shapes come from backend/app/engine/rules.yaml.

import type { Fee, LeadTime, Rule, Source, TerminalTurn } from "../types/api.ts";
import { humanize, usd } from "./format.ts";

/** Kinds shown as their own card on the summary; everything else is a to-do. */
const PERMIT_KINDS = ["permit", "license"];

/** A permit or license, as a summary row shows it. */
export interface Permit {
  id: string;
  kind: string;
  name: string;
  agency: string;
  purpose: string;
  lead_days: number | null;
  lead_text: string;
  fee_basis: string;
  limits: string[];
  verify: string;
  self_serve_url: string;
  sources: Source[];
}

/** A requirement, plan, document or advisory: the "Also on your list" rows. */
export interface OtherItem {
  id: string;
  kind: string;
  title: string;
  agency: string;
  text: string;
  url: string;
  source: string;
}

/** Days to apply ahead, for ordering; business days count as calendar days. */
export function leadDays(lt: LeadTime | null | undefined): number | null {
  if (!lt) return null;
  return lt.min_days ?? lt.min_business_days ?? null;
}

export function leadText(lt: LeadTime | null | undefined): string {
  if (!lt) return "";
  let s: string;
  if (lt.min_days != null && lt.max_days != null) {
    s = lt.min_days + " to " + lt.max_days + " days before the event";
  } else if (lt.min_days != null) {
    s = "At least " + lt.min_days + " days before the event";
  } else if (lt.min_business_days != null) {
    s = "At least " + lt.min_business_days + " business days before the event";
  } else {
    return lt.override_note || "";
  }
  if (lt.hard_floor_days != null) s += ", and never later than " + lt.hard_floor_days + " days";
  return s + "." + (lt.override_note ? " " + lt.override_note + "." : "");
}

export function feeText(fee: Fee | null | undefined): string {
  if (!fee) return "No fee listed";
  let s = "";
  if (fee.amount_usd != null) s = usd(fee.amount_usd);
  else if (fee.amount_usd_from != null) s = "From " + usd(fee.amount_usd_from);
  else if (fee.range_usd) s = usd(fee.range_usd[0]) + " to " + usd(fee.range_usd[1]);
  if (fee.note) s = s ? s + ". " + fee.note : fee.note;
  return s || "No fee listed";
}

/** The fixed part of every fee in cents, and whether some fees vary on top of it. */
export function feeTotal(rules: Rule[]): { cents: number; varies: boolean } {
  let cents = 0;
  let varies = false;
  for (const { fee } of rules) {
    if (!fee) continue;
    if (fee.amount_usd != null) cents += fee.amount_usd * 100;
    else if (fee.amount_usd_from != null) {
      cents += fee.amount_usd_from * 100;
      varies = true;
    } else if (fee.range_usd) {
      cents += fee.range_usd[0] * 100;
      varies = true;
    } else varies = true;
  }
  return { cents, varies };
}

function isSubStep(r: Rule): boolean {
  return r.kind === "process_step" && !!r.part_of;
}

/** Permits and licenses, longest lead time first. */
export function toPermits(terminal: TerminalTurn | null): Permit[] {
  const rules = terminal?.rules ?? [];
  const steps = rules.filter(isSubStep);
  return rules
    .filter((r) => PERMIT_KINDS.includes(r.kind))
    .map((r) => {
      const sub = steps.filter((s) => s.part_of === r.id).map((s) => s.title + ".");
      return {
        id: r.id,
        kind: r.kind,
        name: r.title,
        agency: r.agency || "",
        purpose: [r.notes, ...sub].filter(Boolean).join(" "),
        lead_days: leadDays(r.lead_time),
        lead_text: leadText(r.lead_time),
        fee_basis: feeText(r.fee),
        limits: r.limits ? [r.limits] : [],
        verify: r.verify || "",
        self_serve_url: r.sources[0]?.url ?? "",
        sources: r.sources,
      };
    })
    .sort((a, b) => (b.lead_days ?? -1) - (a.lead_days ?? -1));
}

/** Requirements, plans, documents and advisories that apply, in file order. */
export function toOthers(terminal: TerminalTurn | null): OtherItem[] {
  const rules = terminal?.rules ?? [];
  return rules
    .filter((r) => !PERMIT_KINDS.includes(r.kind) && !isSubStep(r))
    .map((r) => ({
      id: r.id,
      kind: humanize(r.kind),
      title: r.title,
      agency: r.agency || "",
      text: [r.notes, leadText(r.lead_time), r.fee ? "Fee: " + feeText(r.fee) + "." : ""]
        .filter(Boolean)
        .join(" "),
      url: r.sources[0]?.url ?? "",
      source: r.sources[0]?.publisher ?? "",
    }));
}

/** The rule that ended the walk early, for out_of_scope and blocked results. */
export function blockingRule(terminal: TerminalTurn | null): Rule | null {
  if (!terminal?.blocking_rule) return null;
  return terminal.rules.find((r) => r.id === terminal.blocking_rule) ?? null;
}
