// Mermaid source -> SVG markup. Mermaid is large, so it loads on first use and
// only the /rules page pays for it.

type Mermaid = typeof import("mermaid").default;

let loading: Promise<Mermaid> | undefined;
let seq = 0;

function load(): Promise<Mermaid> {
  loading ??= import("mermaid").then(({ default: mermaid }) => {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      theme: "base",
      fontFamily: '"Public Sans", system-ui, sans-serif',
      // Natural size in the markup; the page fits it to the panel with CSS.
      flowchart: { useMaxWidth: false },
    });
    return mermaid;
  });
  return loading;
}

/** Render a flowchart. The markup comes from mermaid, sanitized under its strict level. */
export async function renderMermaid(source: string): Promise<string> {
  const mermaid = await load();
  // Ids must be unique per render and start with a letter.
  const { svg } = await mermaid.render(`mermaid-${++seq}`, source);
  return svg;
}
