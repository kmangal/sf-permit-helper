import { describe, expect, it } from "vitest";
import { inkToPdfUnits, strokePath } from "../../src/lib/ink.ts";

describe("strokePath", () => {
  it("draws a polyline", () => {
    expect(strokePath([[1, 2], [3, 4], [5, 6]])).toBe("M1 2 L3 4 L5 6");
  });
});

describe("inkToPdfUnits", () => {
  it("scales from rendered px to the PDF page width", () => {
    expect(inkToPdfUnits([[[612, 306]]], 612)).toEqual([
      { page: 1, width: 2.2, color: "#16264d", points: [[816, 408]] },
    ]);
    expect(inkToPdfUnits([[[1, 1]]], 3, 2, 1)[0]).toMatchObject({ page: 2, points: [[0.33, 0.33]] });
  });
});
