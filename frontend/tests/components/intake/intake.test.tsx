import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { OPENING_CHAT, type Navigator } from "../../../src/hooks/useNavigator.ts";
import { known, question } from "../../fixtures.ts";
import { ChatMessage } from "../../../src/components/intake/ChatMessage.tsx";
import { Chips } from "../../../src/components/intake/Chips.tsx";
import { Composer } from "../../../src/components/intake/Composer.tsx";
import { EXAMPLE, placeholderFor } from "../../../src/components/intake/copy.ts";
import { IntakeScreen } from "../../../src/components/intake/IntakeScreen.tsx";
import { Ledger } from "../../../src/components/intake/Ledger.tsx";

describe("ChatMessage", () => {
  it("renders agent, user and action items", () => {
    const { rerender } = render(<ChatMessage item={{ kind: "agent", text: "Hello", lead: true }} />);
    expect(screen.getByText("Hello")).toBeInTheDocument();
    rerender(<ChatMessage item={{ kind: "user", text: "A party" }} />);
    expect(screen.getByText("A party")).toBeInTheDocument();
    rerender(<ChatMessage item={{ kind: "actions", actions: ["Location: street", "Food: none"] }} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });
});

describe("Chips", () => {
  it("sends the raw label and shows it humanized", async () => {
    const onPick = vi.fn();
    render(<Chips options={question().options} onPick={onPick} />);
    await userEvent.click(screen.getByRole("button", { name: "50 to 100" }));
    expect(onPick).toHaveBeenCalledWith("50_to_100", "50 to 100");
  });

  it("renders nothing without options", () => {
    const { container } = render(<Chips options={[]} onPick={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("Composer", () => {
  it("sends on Enter and clears when taken", async () => {
    const onSend = vi.fn(() => true);
    render(<Composer placeholder="Say" onSend={onSend} />);
    const box = screen.getByRole("textbox", { name: "Message" });
    await userEvent.type(box, "Block party{Enter}");
    expect(onSend).toHaveBeenCalledWith("Block party");
    expect(box).toHaveValue("");
  });

  it("keeps the text when the send is refused", async () => {
    render(<Composer placeholder="Say" onSend={() => false} />);
    const box = screen.getByRole("textbox", { name: "Message" });
    await userEvent.type(box, "wait");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(box).toHaveValue("wait");
  });

  it("offers an example", async () => {
    const onSend = vi.fn(() => true);
    render(<Composer placeholder="Say" onSend={onSend} example="An example" />);
    await userEvent.click(screen.getByRole("button", { name: "Use an example" }));
    expect(onSend).toHaveBeenCalledWith("An example");
  });
});

describe("Ledger", () => {
  it("lists known facts and the one being asked", () => {
    render(<Ledger known={known} pending="food_vendors" />);
    expect(screen.getByText("2 known")).toBeInTheDocument();
    expect(screen.getByText("Street or sidewalk")).toBeInTheDocument();
    expect(screen.getByText("Food vendors")).toBeInTheDocument();
  });
});

describe("placeholderFor", () => {
  it("fits the question type", () => {
    expect(placeholderFor({ question: question(), ended: false })).toBe("Type a number, or pick a range");
    expect(placeholderFor({ question: question({ type: "bool" }), ended: false })).toBe("Type your answer");
    expect(placeholderFor({ question: null, ended: true })).toBe("Start over to try again");
  });
});

describe("IntakeScreen", () => {
  function nav(overrides: Partial<Navigator> = {}) {
    return {
      chat: OPENING_CHAT,
      known: [],
      question: null,
      thinking: null,
      ended: false,
      fresh: true,
      send: vi.fn(() => true),
      answer: vi.fn(),
      ...overrides,
    };
  }

  it("shows the opening prompt and example", async () => {
    const props = nav();
    render(<IntakeScreen {...props} />);
    expect(screen.getByText("Tell me about the event.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Use an example" }));
    expect(props.send).toHaveBeenCalledWith(EXAMPLE);
  });

  it("shows chips for a question, and hides them while thinking", () => {
    const { rerender } = render(<IntakeScreen {...nav({ question: question(), fresh: false })} />);
    expect(screen.getByRole("button", { name: "Under 50" })).toBeInTheDocument();
    rerender(<IntakeScreen {...nav({ question: question(), thinking: "Checking the rules" })} />);
    expect(screen.queryByRole("button", { name: "Under 50" })).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Checking the rules");
  });
});
