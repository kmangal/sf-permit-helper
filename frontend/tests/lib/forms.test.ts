import { describe, expect, it } from "vitest";
import { fill, spec } from "../fixtures.ts";
import { fieldViews, fillReducer, formPill, isComplete, pendingField, youAddLine, type FillMap } from "../../src/lib/forms.ts";

const ID = "sfmta_closure";

function stepAll(state: FillMap, n: number): FillMap {
  for (let i = 0; i < n; i++) {
    const st = state[ID];
    if (!st) break;
    state = fillReducer(state, { type: "step", id: ID, at: st.progress, doneSub: "$122" });
  }
  return state;
}

describe("fillReducer", () => {
  it("starts empty and loads the spec", () => {
    let s = fillReducer({}, { type: "start", id: ID });
    expect(s[ID]?.sections).toBeNull();
    s = fillReducer(s, { type: "loaded", id: ID, spec });
    expect(s[ID]?.sections).toBe(spec.sections);
  });

  it("fills, leaves blanks, then pauses on an ask field", () => {
    const s = stepAll({ [ID]: fill() }, 5);
    const st = s[ID]!;
    expect(st.progress).toBe(2);
    expect(st.waiting).toBe(true);
    expect(st.feed).toEqual([
      { kind: "fill", text: "Filled applicant name", sub: "Maya Reyes" },
      { kind: "fill", text: "Left blank: phone", sub: "nothing to fill from" },
      { kind: "ask", text: "Need from you: lp gas" },
    ]);
    expect(pendingField(st)?.key).toBe("lpg");
  });

  it("resumes after an answer and finishes", () => {
    let s = stepAll({ [ID]: fill() }, 3);
    s = fillReducer(s, { type: "answer", id: ID, key: "lpg", value: "one 5-gallon" });
    s = stepAll(s, 2);
    const st = s[ID]!;
    expect(st.done).toBe(true);
    expect(isComplete(st)).toBe(true);
    expect(st.feed.at(-1)).toEqual({ kind: "done", text: "Form complete", sub: "$122" });
  });

  it("ignores a stale step", () => {
    const s = { [ID]: fill({ progress: 1 }) };
    expect(fillReducer(s, { type: "step", id: ID, at: 0, doneSub: "" })).toBe(s);
  });

  it("drops a form whose spec failed to load", () => {
    expect(fillReducer({ [ID]: fill() }, { type: "failed", id: ID })).toEqual({});
  });

  it("writes shared facts onto every form not already answered by hand", () => {
    const s = fillReducer(
      { a: fill(), b: fill({ answers: { phone: "typed" } }) },
      { type: "shared", key: "phone", value: "415 555 0100" },
    );
    expect(s.a?.sections?.[0]?.fields[1]?.value).toBe("415 555 0100");
    expect(s.b?.sections?.[0]?.fields[1]?.value).toBe("");
  });
});

describe("fieldViews", () => {
  it("marks each field filled, empty or waiting", () => {
    const views = fieldViews(fill({ progress: 2, waiting: true }));
    expect(views[0]?.fields.map((f) => [f.key, f.status, f.editable])).toEqual([
      ["organizer", "filled", true],
      ["phone", "empty", false],
      ["lpg", "waiting", false],
    ]);
  });

  it("prefers the user's answer over the spec value", () => {
    const views = fieldViews(fill({ progress: 1, answers: { organizer: "Sam" } }));
    expect(views[0]?.fields[0]?.value).toBe("Sam");
  });
});

describe("formPill", () => {
  it("reflects where a form stands", () => {
    expect(formPill(undefined, false)).toEqual({ label: "Not started", tone: "idle" });
    expect(formPill(fill(), false).tone).toBe("filling");
    expect(formPill(fill({ waiting: true }), false).tone).toBe("waiting");
    expect(formPill(fill({ progress: 3 }), false).tone).toBe("ready");
    expect(formPill(fill(), true).tone).toBe("sent");
  });
});

describe("youAddLine", () => {
  it("ends with punctuation", () => {
    expect(youAddLine([])).toBe("nothing.");
    expect(youAddLine(["photos", "a map"])).toBe("photos, a map.");
    expect(youAddLine(["photos!"])).toBe("photos!");
  });
});
