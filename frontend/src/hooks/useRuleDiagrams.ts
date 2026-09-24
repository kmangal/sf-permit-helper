// The /rules page: the diagram list, and the selected one rendered to SVG.

import { useEffect, useState } from "react";
import { errorMessage, ruleDiagrams } from "../lib/api.ts";
import { renderMermaid } from "../lib/mermaid.ts";
import type { RuleDiagram } from "../types/api.ts";

export type Loadable<T> = { status: "loading" } | { status: "ready"; value: T } | { status: "error"; message: string };

/** Every diagram, fetched once. */
export function useRuleDiagrams(): Loadable<RuleDiagram[]> {
  const [state, setState] = useState<Loadable<RuleDiagram[]>>({ status: "loading" });
  useEffect(() => {
    let live = true;
    ruleDiagrams().then(
      (value) => live && setState({ status: "ready", value }),
      (err: unknown) => live && setState({ status: "error", message: errorMessage(err) }),
    );
    return () => {
      live = false;
    };
  }, []);
  return state;
}

/** One flowchart as SVG markup; re-renders when the source changes. */
export function useMermaidSvg(source: string | undefined): Loadable<string> {
  // Keyed by source, so a result for the previous diagram reads as loading.
  const [done, setDone] = useState<{ source: string; result: Loadable<string> }>();
  useEffect(() => {
    if (source === undefined) return;
    let live = true;
    renderMermaid(source).then(
      (value) => live && setDone({ source, result: { status: "ready", value } }),
      (err: unknown) => live && setDone({ source, result: { status: "error", message: errorMessage(err) } }),
    );
    return () => {
      live = false;
    };
  }, [source]);
  return done && done.source === source ? done.result : { status: "loading" };
}
