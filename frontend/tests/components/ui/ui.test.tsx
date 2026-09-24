import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
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
  it("starts over", async () => {
    const onStartOver = vi.fn();
    render(<Header onStartOver={onStartOver} />);
    await userEvent.click(screen.getByRole("button", { name: "Start over" }));
    expect(onStartOver).toHaveBeenCalled();
  });
});
