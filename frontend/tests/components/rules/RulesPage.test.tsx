import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../../../src/App.tsx";
import * as api from "../../../src/lib/api.ts";
import { renderMermaid } from "../../../src/lib/mermaid.ts";
import type { RuleDiagram } from "../../../src/types/api.ts";

vi.mock("../../../src/lib/api.ts", async (orig) => ({
  ...(await orig<typeof import("../../../src/lib/api.ts")>()),
  ruleDiagrams: vi.fn(),
}));
// jsdom cannot lay out SVG; echo the source back instead.
vi.mock("../../../src/lib/mermaid.ts", () => ({
  renderMermaid: vi.fn(async (source: string) => `<svg><text>${source}</text></svg>`),
}));

const DIAGRAMS: RuleDiagram[] = [
  { id: "00_overview", kind: "overview", title: "Overview", source: "flowchart TD\n  a" },
  { id: "04_street_or_sidewalk", kind: "section", title: "Street or sidewalk", source: "flowchart TD\n  b" },
  { id: "macro_block_party_eligible", kind: "macro", title: "Block party", source: "flowchart TD\n  c" },
];

describe("RulesPage", () => {
  beforeEach(() => {
    window.history.pushState(null, "", "/rules");
    vi.mocked(api.ruleDiagrams).mockResolvedValue(DIAGRAMS);
  });
  afterEach(() => window.history.pushState(null, "", "/"));

  it("shows the overview first and switches tabs on click", async () => {
    const user = userEvent.setup();
    render(<App />);

    const overview = await screen.findByRole("tab", { name: "Overview" });
    expect(overview).toHaveAttribute("aria-selected", "true");
    expect(await screen.findByRole("img", { name: "Flowchart: Overview" })).toHaveTextContent("a");

    await user.click(screen.getByRole("tab", { name: "Street or sidewalk" }));
    expect(screen.getByRole("tab", { name: "Street or sidewalk" })).toHaveAttribute("aria-selected", "true");
    expect(await screen.findByRole("img", { name: "Flowchart: Street or sidewalk" })).toHaveTextContent("b");
    expect(window.location.pathname).toBe("/rules/04_street_or_sidewalk");
  });

  it("opens the tab named in the path, and arrow keys move between tabs", async () => {
    window.history.pushState(null, "", "/rules/04_street_or_sidewalk");
    const user = userEvent.setup();
    render(<App />);

    const street = await screen.findByRole("tab", { name: "Street or sidewalk" });
    expect(street).toHaveAttribute("aria-selected", "true");
    street.focus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("tab", { name: "Block party" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Block party" })).toHaveFocus();
  });

  it("sends old hash links to the diagram's path", async () => {
    window.history.pushState(null, "", "/rules#04_street_or_sidewalk");
    render(<App />);
    expect(await screen.findByRole("tab", { name: "Street or sidewalk" })).toHaveAttribute("aria-selected", "true");
    expect(window.location.pathname).toBe("/rules/04_street_or_sidewalk");
  });

  it("falls back to the overview for an unknown diagram", async () => {
    window.history.pushState(null, "", "/rules/nope");
    render(<App />);
    expect(await screen.findByRole("tab", { name: "Overview" })).toHaveAttribute("aria-selected", "true");
    expect(window.location.pathname).toBe("/rules");
  });

  it("links back to the helper", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("link", { name: "Find your permits" }));
    expect(window.location.pathname).toBe("/");
    expect(screen.getByRole("textbox", { name: "Message" })).toBeInTheDocument();
  });

  it("says when a diagram cannot be drawn", async () => {
    vi.mocked(renderMermaid).mockRejectedValueOnce(new Error("Parse error"));
    render(<App />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not draw this diagram: Parse error");
  });

  it("says when the rules cannot be loaded", async () => {
    vi.mocked(api.ruleDiagrams).mockRejectedValue(new Error("Backend is down."));
    render(<App />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load the rules: Backend is down.");
  });
});
