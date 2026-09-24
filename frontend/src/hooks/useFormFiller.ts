// Drives fillReducer: loads each form's spec, then steps through its fields
// on a timer so the user can watch the form fill.

import { useCallback, useEffect, useLayoutEffect, useReducer, useRef } from "react";
import { formSpec } from "../lib/api.ts";
import { fillReducer, isShared, needsStep, pendingField, type FeedEntry, type FillMap } from "../lib/forms.ts";
import type { Facts } from "../types/api.ts";
import { useAlive } from "./useAlive.ts";

export const STEP_MS = 380;

interface Options {
  /** Steps only run while the filler is on screen. */
  active: boolean;
  facts: Facts;
  /** The sub-line for a form's "Form complete" feed entry. */
  describeDone: (id: string) => string;
  /** A shared fact (organizer, email, ...) was typed on some form. */
  onSharedFact: (key: string, value: string) => void;
  onError: (err: unknown) => void;
}

export function useFormFiller({ active, facts, describeDone, onSharedFact, onError }: Options) {
  const alive = useAlive();
  const [forms, dispatch] = useReducer(fillReducer, {} as FillMap);

  const latest = useRef({ forms, facts, describeDone, onSharedFact, onError });
  useLayoutEffect(() => {
    latest.current = { forms, facts, describeDone, onSharedFact, onError };
  });

  // One pending timer per form. A step moves `progress`, which schedules the next.
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  useEffect(() => {
    if (!active) return;
    const map = timers.current;
    return () => {
      map.forEach(clearTimeout);
      map.clear();
    };
  }, [active]);
  useEffect(() => {
    if (!active) return;
    for (const [id, st] of Object.entries(forms)) {
      if (!needsStep(st) || timers.current.has(id)) continue;
      const at = st.progress;
      const t = setTimeout(() => {
        timers.current.delete(id);
        dispatch({ type: "step", id, at, doneSub: latest.current.describeDone(id) });
      }, STEP_MS);
      timers.current.set(id, t);
    }
  }, [active, forms]);

  /** Start filling a form, loading its spec the first time. */
  const opened = useRef(new Set<string>());
  const open = useCallback(
    async (id: string) => {
      if (opened.current.has(id)) return;
      opened.current.add(id);
      dispatch({ type: "start", id });
      try {
        const spec = await formSpec(id, latest.current.facts, {});
        if (!alive.current) return;
        dispatch({ type: "loaded", id, spec });
      } catch (err) {
        if (!alive.current) return;
        opened.current.delete(id);
        dispatch({ type: "failed", id });
        latest.current.onError(err);
      }
    },
    [alive],
  );

  const share = useCallback((key: string, value: string) => {
    if (!isShared(key)) return;
    dispatch({ type: "shared", key, value });
    latest.current.onSharedFact(key, value);
  }, []);

  /** Answer the field a form is paused on. */
  const answer = useCallback(
    (id: string, text: string) => {
      const field = pendingField(latest.current.forms[id]);
      if (!field) return;
      dispatch({ type: "answer", id, key: field.key, value: text });
      share(field.key, text);
    },
    [share],
  );

  /** Overwrite a filled field by hand. */
  const edit = useCallback(
    (id: string, key: string, value: string) => {
      dispatch({ type: "edit", id, key, value });
      share(key, value);
    },
    [share],
  );

  const log = useCallback((id: string, entry: FeedEntry) => dispatch({ type: "log", id, entry }), []);

  return { forms, open, answer, edit, log };
}

export type FormFiller = ReturnType<typeof useFormFiller>;
