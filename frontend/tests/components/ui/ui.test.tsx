import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { Header } from "../../../src/components/layout/Header.tsx";
import { Staggered } from "../../../src/components/ui/Staggered.tsx";
import { Toast } from "../../../src/components/ui/Toast.tsx";
import { Working } from "../../../src/components/ui/Working.tsx";

describe("Staggered", () => {
  it("sets the stagger index as a CSS variable on the chosen element", () => {
    render(
      <Staggered as="li" index={3} className="x">
        hi
      </Staggered>,
    );
    const li = screen.getByRole("listitem");
    expect(li).toHaveClass("x");
    expect(li.style.getPropertyValue("--i")).toBe("3");
  });
});

describe("Toast / Working", () => {
  it("shows a message, or nothing", () => {
    const { rerender, container } = render(<Toast message="" />);
    expect(container).toBeEmptyDOMElement();
    rerender(<Toast message="Saved" />);
    expect(screen.getByRole("status")).toHaveTextContent("Saved");
  });

  it("says what is working", () => {
    render(<Working>Checking the rules</Working>);
    expect(screen.getByRole("status")).toHaveTextContent("Checking the rules");
  });
});

describe("Header", () => {
  it("offers the rules and a fresh start on the helper", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Header />
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: "How it works" })).toHaveAttribute("href", "/rules");
    expect(screen.getByRole("button", { name: "Start over" })).toBeInTheDocument();
  });

  it("links back to the helper from other pages", () => {
    render(
      <MemoryRouter initialEntries={["/rules"]}>
        <Header />
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: "Find your permits" })).toHaveAttribute("href", "/");
    expect(screen.queryByRole("button", { name: "Start over" })).not.toBeInTheDocument();
  });

  it("opens the phone menu, and closes it on a pick or Escape", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Header />
      </MemoryRouter>,
    );
    const menu = screen.getByRole("button", { name: "Menu" });
    expect(menu).toHaveAttribute("aria-expanded", "false");

    await user.click(menu);
    expect(menu).toHaveAttribute("aria-expanded", "true");
    await user.click(screen.getByRole("button", { name: "Start over" }));
    expect(menu).toHaveAttribute("aria-expanded", "false");

    await user.click(menu);
    await user.keyboard("{Escape}");
    expect(menu).toHaveAttribute("aria-expanded", "false");
  });
});
