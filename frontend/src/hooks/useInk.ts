import { useCallback, useState } from "react";
import type { Stroke } from "../lib/ink.ts";

const NONE: Stroke[] = [];

/** Hand-drawn strokes, kept per form. */
export function useInk() {
  const [ink, setInk] = useState<Record<string, Stroke[]>>({});

  const strokesFor = useCallback((id: string | null) => (id ? (ink[id] ?? NONE) : NONE), [ink]);

  const add = useCallback((id: string, stroke: Stroke) => {
    setInk((prev) => ({ ...prev, [id]: [...(prev[id] ?? []), stroke] }));
  }, []);

  const clear = useCallback((id: string) => {
    setInk((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  return { strokesFor, add, clear };
}
