import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../../src/lib/api.ts";
import { spec } from "../fixtures.ts";
import { STEP_MS, useFormFiller } from "../../src/hooks/useFormFiller.ts";

vi.mock("../../src/lib/api.ts", async (orig) => ({
  ...(await orig<typeof import("../../src/lib/api.ts")>()),
  formSpec: vi.fn(),
}));

const formSpec = vi.mocked(api.formSpec);
const ID = "sfmta_closure";

function setup(active = true) {
  const opts = {
    active,
    facts: { organizer: "Maya Reyes" },
    describeDone: vi.fn(() => "$122"),
    onSharedFact: vi.fn(),
    onError: vi.fn(),
  };
  const hook = renderHook((props) => useFormFiller(props), { initialProps: opts });
  return { ...hook, opts };
}

async function tick(times = 1) {
  for (let i = 0; i < times; i++) await act(() => vi.advanceTimersByTimeAsync(STEP_MS));
}

describe("useFormFiller", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    formSpec.mockReset();
    formSpec.mockResolvedValue(spec);
  });

  it("loads the spec once and steps until it needs the user", async () => {
    const { result } = setup();
    await act(() => result.current.open(ID));
    await act(() => result.current.open(ID));
    expect(formSpec).toHaveBeenCalledTimes(1);
    expect(formSpec).toHaveBeenCalledWith(ID, { organizer: "Maya Reyes" }, {});

    await tick(1);
    expect(result.current.forms[ID]?.progress).toBe(1);
    await tick(5);
    expect(result.current.forms[ID]).toMatchObject({ progress: 2, waiting: true });
  });

  it("resumes after an answer, shares shared facts, and finishes", async () => {
    const { result, opts } = setup();
    await act(() => result.current.open(ID));
    await tick(3);

    act(() => result.current.edit(ID, "phone", "415 555 0100"));
    expect(opts.onSharedFact).toHaveBeenCalledWith("phone", "415 555 0100");

    act(() => result.current.answer(ID, "one 5-gallon"));
    expect(opts.onSharedFact).toHaveBeenCalledTimes(1); // lpg is not shared
    await tick(2);
    expect(result.current.forms[ID]?.done).toBe(true);
    expect(result.current.forms[ID]?.feed.at(-1)).toEqual({ kind: "done", text: "Form complete", sub: "$122" });
  });

  it("pauses while inactive and picks up again", async () => {
    const { result, rerender, opts } = setup(false);
    await act(() => result.current.open(ID));
    await tick(3);
    expect(result.current.forms[ID]?.progress).toBe(0);
    rerender({ ...opts, active: true });
    await tick(1);
    expect(result.current.forms[ID]?.progress).toBe(1);
  });

  it("drops a form whose spec failed, so it can be retried", async () => {
    formSpec.mockRejectedValueOnce(new Error("Down"));
    const { result, opts } = setup();
    await act(() => result.current.open(ID));
    expect(opts.onError).toHaveBeenCalled();
    expect(result.current.forms[ID]).toBeUndefined();
    await act(() => result.current.open(ID));
    expect(result.current.forms[ID]?.spec).toBe(spec);
  });
});
