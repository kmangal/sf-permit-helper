import { useRef, useState, type PointerEvent } from "react";
import { strokePath, type Stroke } from "../../lib/ink.ts";
import type { Point } from "../../types/api.ts";
import styles from "./PenOverlay.module.css";

interface Props {
  strokes: Stroke[];
  enabled: boolean;
  /** A finished stroke, in CSS px relative to the overlay. */
  onStroke: (stroke: Stroke) => void;
}

/** Points closer than this (Manhattan, px) to the last one are dropped. */
const MIN_STEP = 2;

function pointOf(e: PointerEvent<SVGSVGElement>): Point {
  const r = e.currentTarget.getBoundingClientRect();
  return [Math.round(e.clientX - r.left), Math.round(e.clientY - r.top)];
}

/** A transparent SVG over the paper that takes hand-drawn ink while enabled. */
export function PenOverlay({ strokes, enabled, onStroke }: Props) {
  const drawing = useRef<Stroke | null>(null);
  const [current, setCurrent] = useState<Stroke>([]);

  const down = (e: PointerEvent<SVGSVGElement>) => {
    if (!enabled) return;
    drawing.current = [pointOf(e)];
    setCurrent(drawing.current.slice());
  };

  const move = (e: PointerEvent<SVGSVGElement>) => {
    const stroke = drawing.current;
    const last = stroke?.at(-1);
    if (!stroke || !last) return;
    const p = pointOf(e);
    if (Math.abs(p[0] - last[0]) + Math.abs(p[1] - last[1]) < MIN_STEP) return;
    stroke.push(p);
    setCurrent(stroke.slice());
  };

  const up = () => {
    const stroke = drawing.current;
    if (!stroke) return;
    drawing.current = null;
    if (stroke.length > 1) onStroke(stroke);
    setCurrent([]);
  };

  const shown = current.length > 1 ? [...strokes, current] : strokes;
  return (
    <svg
      className={styles.overlay}
      data-enabled={enabled ? "" : undefined}
      data-testid="pen-overlay"
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerLeave={up}
    >
      {shown.map((points, i) => (
        <path key={i} className={styles.stroke} d={strokePath(points)} />
      ))}
    </svg>
  );
}
