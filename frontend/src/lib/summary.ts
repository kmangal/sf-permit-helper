// What the summary screen says about a terminal result. Pure, so each line is testable.

import type { Facts, TerminalTurn } from "../types/api.ts";
import { addDays, fromISO, isPast } from "./dates.ts";
import { fmtDate, fmtMoney, plural } from "./format.ts";
import { blockingRule, feeTotal, type OtherItem, type Permit } from "./rules.ts";

/** When to apply by: event date minus lead time. */
export function permitDue(p: Permit, facts: Facts): Date | null {
  const d = fromISO(facts.date);
  if (d && typeof p.lead_days === "number") return addDays(d, -p.lead_days);
  return null;
}

/** The due line on a permit card, and whether it is already late. */
export function dueLine(p: Permit, facts: Facts, now = Date.now()): { text: string; late: boolean } {
  const due = permitDue(p, facts);
  if (!due) return { text: p.lead_text || "No lead time listed", late: false };
  const late = isPast(due, now);
  return {
    text: late
      ? "Was due " + fmtDate(due) + ", " + p.lead_days + " days lead"
      : fmtDate(due) + ", " + p.lead_days + " days before the event",
    late,
  };
}

export function summaryHead(terminal: TerminalTurn, permits: Permit[]): string {
  if (terminal.status === "out_of_scope") return "This tool does not cover that event.";
  if (terminal.status === "blocked") return "This event cannot go ahead as described.";
  if (permits.length === 0) return "No permits needed.";
  return plural(permits.length, "permit") + " required for your event.";
}

export function summarySub(terminal: TerminalTurn, permits: Permit[], others: OtherItem[]): string {
  if (terminal.status !== "complete") return "See below for why, and where to go instead.";
  const driver = permits.find((p) => p.lead_days != null);
  if (!driver) return "";
  const lead = driver.lead_text.charAt(0).toLowerCase() + driver.lead_text.slice(1);
  return (
    "Start with the " +
    driver.name +
    ": apply " +
    lead +
    (others.length ? " " + others.length + " more things to line up are below." : "")
  );
}

export interface Blocker {
  title: string;
  text: string;
  source: string;
}

/** The rule that stops the event going ahead, if any. */
export function blocker(terminal: TerminalTurn): Blocker | null {
  const rule = blockingRule(terminal);
  if (!rule) return null;
  return {
    title: rule.title,
    text: rule.notes || "",
    source: rule.sources.map((s) => s.publisher).join(", "),
  };
}

export function feeSummary(terminal: TerminalTurn): { fixed: string; note: string } {
  const total = feeTotal(terminal.rules);
  return {
    fixed: fmtMoney(total.cents) + (total.varies ? "+" : ""),
    note: total.varies
      ? "Known fixed fees. Some grow with your event; see each permit."
      : "Known fixed fees. Waivers exist for some nonprofits.",
  };
}
