import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { toPermits } from "../../../src/lib/rules.ts";
import { known, permit, terminal } from "../../fixtures.ts";
import { NotNeededList } from "../../../src/components/summary/NotNeededList.tsx";
import { OtherList } from "../../../src/components/summary/OtherList.tsx";
import { PermitCard } from "../../../src/components/summary/PermitCard.tsx";
import { SiteCheckCard } from "../../../src/components/summary/SiteCheckCard.tsx";
import { SummaryScreen } from "../../../src/components/summary/SummaryScreen.tsx";

describe("PermitCard", () => {
  it("shows the permit and where to apply", () => {
    render(
      <PermitCard
        permit={permit({ verify: "Check with SFMTA", limits: ["Under 8 hours."] })}
        index={0}
        due={{ text: "Was due Aug 11", late: true }}
      />,
    );
    const card = screen.getByRole("article", { name: "Street closure" });
    expect(within(card).getByText("Was due Aug 11")).toHaveAttribute("data-late");
    expect(within(card).getByText("Under 8 hours.")).toBeInTheDocument();
    expect(within(card).getByText("Check with SFMTA")).toBeInTheDocument();
    expect(within(card).getByRole("link", { name: "sf.gov: Host a neighborhood block party" })).toBeInTheDocument();
    expect(within(card).getByRole("link", { name: "Apply on the city site" })).toHaveAttribute(
      "href",
      "https://www.sf.gov/host-a-neighborhood-block-party",
    );
  });
});

describe("SiteCheckCard", () => {
  it("shows the check and fees", () => {
    render(<SiteCheckCard check={{ title: "Checked", text: "All good", source: "" }} fees={{ fixed: "$122", note: "Known" }} />);
    expect(screen.getByText("$122")).toBeInTheDocument();
    expect(screen.getByText("All good")).toBeInTheDocument();
  });
});

describe("OtherList / NotNeededList", () => {
  it("renders nothing when there are no others", () => {
    const { container } = render(<OtherList items={[]} after={0} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("lists others and ruled-out permits", () => {
    render(
      <>
        <OtherList
          items={[{ id: "p", kind: "Plan", title: "Safety plan", agency: "SFFD", text: "", url: "https://x", source: "sf.gov" }]}
          after={1}
        />
        <NotNeededList items={terminal().not_needed} />
      </>,
    );
    expect(screen.getByRole("heading", { name: "Also on your list" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "sf.gov" })).toHaveAttribute("href", "https://x");
    expect(screen.getByText("Alcohol license")).toBeInTheDocument();
  });
});

describe("SummaryScreen", () => {
  it("summarises the result and toggles the not-needed list", async () => {
    const result = terminal();
    const permits = toPermits(result);
    render(
      <SummaryScreen
        result={result}
        facts={result.facts}
        known={known}
        permits={permits}
        others={[]}
      />,
    );
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("1 permit for your event.");
    expect(screen.getByText("Bocana St block party")).toBeInTheDocument();
    expect(screen.queryByText("Alcohol license")).not.toBeInTheDocument();

    const toggle = screen.getByRole("button", { name: /1 other permits checked and not needed/ });
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Alcohol license")).toBeInTheDocument();
  });
});
