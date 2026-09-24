import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { OPENING_CHAT, type Navigator } from "../../../src/hooks/useNavigator.ts";
import { known, question } from "../../fixtures.ts";
import { ChatMessage } from "../../../src/components/intake/ChatMessage.tsx";
import { Choices } from "../../../src/components/intake/Choices.tsx";
import { Composer } from "../../../src/components/intake/Composer.tsx";
import { CLARIFY_PLACEHOLDER, EXAMPLE, placeholderFor } from "../../../src/components/intake/copy.ts";
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

describe("Choices", () => {
  it("sends the raw label and shows it humanized", async () => {
    const onPick = vi.fn();
    render(<Choices prompt="How many people?" options={question().options} onPick={onPick} />);
    expect(screen.getByRole("group", { name: "How many people?" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "50 to 100" }));
    expect(onPick).toHaveBeenCalledWith("50_to_100", "50 to 100");
  });

  it("can be disabled", async () => {
    const onPick = vi.fn();
    render(<Choices prompt="?" options={question().options} onPick={onPick} disabled />);
    await userEvent.click(screen.getByRole("button", { name: "50 to 100" }));
    expect(onPick).not.toHaveBeenCalled();
  });

  it("renders nothing without options", () => {
    const { container } = render(<Choices prompt="?" options={[]} onPick={vi.fn()} />);
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

  it("starts a new line on Shift+Enter instead of sending", async () => {
    const onSend = vi.fn(() => true);
    render(<Composer placeholder="Say" onSend={onSend} />);
    const box = screen.getByRole("textbox", { name: "Message" });
    await userEvent.type(box, "Block party{Shift>}{Enter}{/Shift}Saturday");
    expect(onSend).not.toHaveBeenCalled();
    expect(box).toHaveValue("Block party\nSaturday");
  });

  it("keeps the text when the send is refused", async () => {
    render(<Composer placeholder="Say" onSend={() => false} />);
    const box = screen.getByRole("textbox", { name: "Message" });
    await userEvent.type(box, "wait");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(box).toHaveValue("wait");
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
    expect(placeholderFor({ question: question(), ended: false })).toBe(CLARIFY_PLACEHOLDER);
    expect(placeholderFor({ question: question({ options: [] }), ended: false })).toBe("Type your answer");
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
      clarifying: null,
      ended: false,
      fresh: true,
      send: vi.fn(() => true),
      answer: vi.fn(),
      clarify: vi.fn(() => true),
      ...overrides,
    };
  }

  it("shows the opening prompt and example", async () => {
    const props = nav();
    render(<IntakeScreen {...props} />);
    expect(screen.getByText("Find out what permits you need to host events in the city.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "See an example" }));
    expect(props.send).toHaveBeenCalledWith(EXAMPLE);
  });

  it("hides the ledger until the first message is sent", () => {
    const { rerender } = render(<IntakeScreen {...nav()} />);
    expect(screen.queryByRole("complementary", { name: "Event details" })).not.toBeInTheDocument();
    rerender(<IntakeScreen {...nav({ fresh: false, thinking: "Reading your description" })} />);
    expect(screen.getByRole("complementary", { name: "Event details" })).toBeInTheDocument();
  });

  it("routes typed text to a clarifying question while choices are up", async () => {
    const props = nav({ question: question(), fresh: false });
    render(<IntakeScreen {...props} />);
    await userEvent.type(screen.getByRole("textbox", { name: "Clarifying question" }), "Do kids count?{Enter}");
    expect(props.clarify).toHaveBeenCalledWith("Do kids count?");
    expect(props.send).not.toHaveBeenCalled();
  });

  it("disables the choices while a clarification is in flight", () => {
    render(<IntakeScreen {...nav({ question: question(), fresh: false, clarifying: "waiting" })} />);
    expect(screen.getByRole("button", { name: "Under 50" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Looking into that");
  });

  it("shows choices for a question, and hides them while thinking", () => {
    const { rerender } = render(<IntakeScreen {...nav({ question: question(), fresh: false })} />);
    expect(screen.getByRole("button", { name: "Under 50" })).toBeInTheDocument();
    rerender(<IntakeScreen {...nav({ question: question(), thinking: "Checking the rules" })} />);
    expect(screen.queryByRole("button", { name: "Under 50" })).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Checking the rules");
  });
});
