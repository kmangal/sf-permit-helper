import { type KeyboardEvent, useEffect, useState } from "react";
import type { Loadable } from "../../hooks/useRuleDiagrams.ts";
import type { RuleDiagram } from "../../types/api.ts";
import styles from "./RulesScreen.module.css";

const GROUPS: { kind: RuleDiagram["kind"]; label: string }[] = [
  { kind: "overview", label: "Start here" },
  { kind: "section", label: "Sections" },
  { kind: "macro", label: "Shared checks" },
];

const LEGEND: { kind: string; label: string }[] = [
  { kind: "permit", label: "Permit or license" },
  { kind: "plan", label: "Plan or document" },
  { kind: "requirement", label: "Requirement" },
  { kind: "exemption", label: "Exemption or check passed" },
  { kind: "advisory", label: "Advice" },
  { kind: "stop", label: "Stop: out of scope or blocked" },
  { kind: "section", label: "Section, drawn in its own tab" },
];

interface Props {
  diagrams: RuleDiagram[];
  selected: RuleDiagram;
  svg: Loadable<string>;
  onSelect: (id: string) => void;
}

const tabId = (id: string) => "rules-tab-" + id;

/** The rules engine as flowcharts: one tab per diagram, the chosen one drawn beside them. */
export function RulesScreen({ diagrams, selected, svg, onSelect }: Props) {
  // Big flowcharts shrink to the panel; "Actual size" shows them full size, scrolling.
  const [fit, setFit] = useState(true);

  // On narrow screens the tabs scroll sideways; keep the chosen one in view.
  useEffect(() => {
    document.getElementById(tabId(selected.id))?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }, [selected.id]);

  // Arrow keys move through the tabs, as in any tablist.
  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const i = diagrams.findIndex((d) => d.id === selected.id);
    const next = {
      ArrowDown: i + 1,
      ArrowRight: i + 1,
      ArrowUp: i - 1,
      ArrowLeft: i - 1,
      Home: 0,
      End: diagrams.length - 1,
    }[e.key];
    const target = next === undefined ? undefined : diagrams[(next + diagrams.length) % diagrams.length];
    if (!target) return;
    e.preventDefault();
    onSelect(target.id);
    document.getElementById(tabId(target.id))?.focus();
  }

  return (
    <div className={styles.screen}>
      <div className={styles.page}>
        <h1 className={styles.head}>How the rules engine decides</h1>
        <p className={styles.sub}>
          Every question the helper asks and every permit it lists comes from these flowcharts. They are drawn from the
          same rules file the helper runs on, so they are always current.
        </p>

        <div className={styles.layout}>
          <div role="tablist" aria-label="Diagrams" aria-orientation="vertical" className={styles.tabs} onKeyDown={onKeyDown}>
            {GROUPS.map(({ kind, label }) => {
              const group = diagrams.filter((d) => d.kind === kind);
              if (!group.length) return null;
              return (
                <div key={kind} role="presentation" className={styles.group}>
                  <div role="presentation" className={styles.groupLabel}>
                    {label}
                  </div>
                  {group.map((d) => {
                    const on = d.id === selected.id;
                    return (
                      <button
                        key={d.id}
                        id={tabId(d.id)}
                        type="button"
                        role="tab"
                        aria-selected={on}
                        aria-controls="rules-panel"
                        tabIndex={on ? 0 : -1}
                        className={styles.tab}
                        onClick={() => onSelect(d.id)}
                      >
                        {d.title}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>

          <section id="rules-panel" role="tabpanel" aria-labelledby={tabId(selected.id)} className={styles.panel}>
            <div className={styles.panelHead}>
              <h2 className={styles.title}>{selected.title}</h2>
              <button type="button" className={styles.zoom} aria-pressed={!fit} onClick={() => setFit((f) => !f)}>
                Actual size
              </button>
            </div>
            <div className={styles.canvas} aria-busy={svg.status === "loading"}>
              {svg.status === "loading" && <p className={styles.note}>Drawing…</p>}
              {svg.status === "error" && (
                <p className={styles.note} role="alert">
                  Could not draw this diagram: {svg.message}
                </p>
              )}
              {svg.status === "ready" && (
                <div
                  className={styles.svg}
                  data-fit={fit}
                  role="img"
                  aria-label={"Flowchart: " + selected.title}
                  // Mermaid's own output, sanitized under securityLevel "strict".
                  dangerouslySetInnerHTML={{ __html: svg.value }}
                />
              )}
            </div>
            <details className={styles.source}>
              <summary>Mermaid source</summary>
              <pre className={styles.code}>{selected.source}</pre>
            </details>
          </section>
        </div>

        <section className={styles.legend} aria-labelledby="rules-legend">
          <h2 id="rules-legend" className={styles.legendHead}>
            Reading the diagrams
          </h2>
          <p className={styles.legendText}>
            Diamonds are questions and hexagons are shared checks, each drawn in its own tab. Boxes are what the helper
            tells you, colored by kind. Dashed <code>before</code> edges mean one approval must come first;{" "}
            <code>then</code> edges hang rules that depend on another rule applying. A diamond with several{" "}
            <code>yes</code> edges means every branch is checked.
          </p>
          <ul className={styles.keys}>
            {LEGEND.map(({ kind, label }) => (
              <li key={kind} className={styles.key}>
                <span className={styles.swatch} data-kind={kind} />
                {label}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
