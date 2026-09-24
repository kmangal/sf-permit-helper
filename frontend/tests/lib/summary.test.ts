import { describe, expect, it } from "vitest";
import { fee, permit, rule, terminal } from "../fixtures.ts";
import { blocker, dueLine, feeSummary, permitDue, summaryHead, summarySub } from "../../src/lib/summary.ts";

const NOW = new Date(2026, 8, 1).getTime();

describe("permitDue / dueLine", () => {
  it("subtracts the lead time from the event date", () => {
    const due = permitDue(permit(), { date: "2026-10-24" });
    expect(due?.toDateString()).toBe(new Date(2026, 8, 24).toDateString());
    expect(dueLine(permit(), { date: "2026-10-24" }, NOW)).toEqual({
      text: "Sep 24, 30 days before the event",
      late: false,
    });
  });

  it("flags a deadline already behind us", () => {
    expect(dueLine(permit(), { date: "2026-09-10" }, NOW)).toEqual({
      text: "Was due Aug 11, 30 days lead",
      late: true,
    });
  });

  it("falls back to the lead text without a date", () => {
    expect(dueLine(permit(), {}, NOW).text).toBe("At least 30 days before the event.");
    expect(dueLine(permit({ lead_text: "" }), {}, NOW).text).toBe("No lead time listed");
  });
});

describe("summaryHead / summarySub", () => {
  it("counts permits for a complete result", () => {
    expect(summaryHead(terminal(), [permit()])).toBe("1 permit required for your event.");
    expect(summaryHead(terminal(), [permit(), permit({ id: "b" })])).toBe("2 permits required for your event.");
    expect(summaryHead(terminal(), [])).toBe("No permits needed.");
  });

  it("explains early stops", () => {
    expect(summaryHead(terminal({ status: "blocked" }), [])).toBe("This event cannot go ahead as described.");
    expect(summaryHead(terminal({ status: "out_of_scope" }), [])).toBe("This tool does not cover that event.");
    expect(summarySub(terminal({ status: "blocked" }), [], [])).toBe("See below for why, and where to go instead.");
  });

  it("points at the permit with the longest lead", () => {
    expect(summarySub(terminal(), [permit()], [])).toBe(
      "Start with the Street closure: apply at least 30 days before the event.",
    );
  });
});

describe("blocker", () => {
  it("is null when nothing blocks the event", () => {
    expect(blocker(terminal())).toBeNull();
  });

  it("shows the blocking rule when there is one", () => {
    const t = terminal({
      status: "blocked",
      blocking_rule: "x",
      rules: [rule({ id: "x", title: "Muni line on block", notes: "Pick another street." })],
    });
    expect(blocker(t)).toEqual({ title: "Muni line on block", text: "Pick another street.", source: "sf.gov" });
  });
});

describe("feeSummary", () => {
  it("marks variable totals with a plus", () => {
    expect(feeSummary(terminal()).fixed).toBe("$122");
    expect(feeSummary(terminal({ rules: [rule({ fee: fee({ amount_usd_from: 50 }) })] })).fixed).toBe("$50+");
  });
});
