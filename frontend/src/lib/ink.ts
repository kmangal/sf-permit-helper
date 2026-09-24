// Hand-drawn ink: on-screen strokes to SVG paths and to PDF user units.

import type { InkStroke, Point } from "../types/api.ts";

/** The on-screen paper is US Letter at 72 dpi. */
export const PAPER_WIDTH = 612;

/** An on-screen stroke, in CSS px relative to the paper. */
export type Stroke = Point[];

export function strokePath(points: Stroke): string {
  return points.map((p, i) => (i === 0 ? "M" : "L") + p[0] + " " + p[1]).join(" ");
}

/**
 * Convert on-screen strokes to PDF user units. `renderedWidth` is the page
 * element's width in CSS px; `pageWidth` defaults to US Letter at 96 dpi.
 */
export function inkToPdfUnits(
  strokes: Stroke[],
  renderedWidth: number,
  page = 1,
  pageWidth = 816,
): InkStroke[] {
  const scale = pageWidth / renderedWidth;
  const round = (n: number) => Math.round(n * scale * 100) / 100;
  return strokes.map((points) => ({
    page,
    width: 2.2,
    color: "#16264d",
    points: points.map(([x, y]) => [round(x), round(y)]),
  }));
}
