import { describe, expect, it } from "vitest";
import { fee, rule, terminal } from "../fixtures.ts";
import { blockingRule, feeText, feeTotal, leadText, toOthers, toPermits } from "../../src/lib/rules.ts";

describe("leadText", () => {
  it("describes each lead-time shape", () => {
    expect(leadText({ min_days: 30 })).toBe("At least 30 days before the event.");
    expect(leadText({ min_days: 30, max_days: 90 })).toBe("30 to 90 days before the event.");
    expect(leadText({ min_business_days: 10 })).toBe("At least 10 business days before the event.");
    expect(leadText({ min_days: 30, hard_floor_days: 7, override_note: "Ask SFMTA" })).toBe(
      "At least 30 days before the event, and never later than 7 days. Ask SFMTA.",
    );
    expect(leadText({ override_note: "Varies" })).toBe("Varies");
    expect(leadText(null)).toBe("");
  });
});

describe("feeText", () => {
  it("formats amounts, floors, ranges and notes", () => {
    expect(feeText(fee({ amount_usd: 1433 }))).toBe("$1,433");
    expect(feeText(fee({ amount_usd_from: 50 }))).toBe("From $50");
    expect(feeText(fee({ range_usd: [10, 20], note: "Per vendor" }))).toBe("$10 to $20. Per vendor");
    expect(feeText(fee({ note: "Free for nonprofits" }))).toBe("Free for nonprofits");
    expect(feeText(null)).toBe("No fee listed");
  });
});

describe("feeTotal", () => {
  it("sums fixed fees and flags variable ones", () => {
    expect(feeTotal([rule({ fee: fee({ amount_usd: 100 }) }), rule({ fee: null })])).toEqual({
      cents: 10000,
      varies: false,
    });
    expect(feeTotal([rule({ fee: fee({ amount_usd: 100 }) }), rule({ fee: fee({ range_usd: [5, 9] }) })])).toEqual({
      cents: 10500,
      varies: true,
    });
  });
});

describe("toPermits", () => {
  it("keeps permits and licenses, longest lead first, folding sub-steps into purpose", () => {
    const t = terminal({
      rules: [
        rule({ id: "a", lead_time: { min_days: 10 } }),
        rule({ id: "b", kind: "license", lead_time: { min_days: 60 } }),
        rule({ id: "c", kind: "plan" }),
        rule({ id: "a1", kind: "process_step", title: "Post the notice", part_of: "a" }),
      ],
    });
    const permits = toPermits(t);
    expect(permits.map((p) => p.id)).toEqual(["b", "a"]);
    expect(permits[1]?.purpose).toBe("Closes your block to traffic. Post the notice.");
    expect(permits[0]?.self_serve_url).toBe("https://www.sf.gov/host-a-neighborhood-block-party");
  });

  it("is empty without a result", () => {
    expect(toPermits(null)).toEqual([]);
  });
});

describe("toOthers", () => {
  it("keeps non-permit rules and drops sub-steps", () => {
    const t = terminal({
      rules: [
        rule({ id: "a" }),
        rule({ id: "plan", kind: "safety_plan", title: "Safety plan", fee: null, lead_time: null }),
        rule({ id: "a1", kind: "process_step", part_of: "a" }),
      ],
    });
    expect(toOthers(t)).toEqual([
      {
        id: "plan",
        kind: "Safety plan",
        title: "Safety plan",
        agency: "SFMTA",
        text: "Closes your block to traffic.",
        url: "https://www.sf.gov/host-a-neighborhood-block-party",
        source: "sf.gov",
      },
    ]);
  });
});

describe("blockingRule", () => {
  it("finds the rule that ended the walk", () => {
    const t = terminal({ status: "blocked", blocking_rule: "sfmta_closure" });
    expect(blockingRule(t)?.id).toBe("sfmta_closure");
    expect(blockingRule(terminal())).toBeNull();
  });
});
