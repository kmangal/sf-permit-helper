import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { fieldViews, type FieldView } from "../../../src/lib/forms.ts";
import { fill, permit } from "../../fixtures.ts";
import { AskBox } from "../../../src/components/filler/AskBox.tsx";
import { Feed, ReadyNote } from "../../../src/components/filler/Feed.tsx";
import { FillerScreen } from "../../../src/components/filler/FillerScreen.tsx";
import { FormsList } from "../../../src/components/filler/FormsList.tsx";
import { FormToolbar } from "../../../src/components/filler/FormToolbar.tsx";
import { Paper } from "../../../src/components/filler/Paper.tsx";
import { PaperField } from "../../../src/components/filler/PaperField.tsx";
import { PenOverlay } from "../../../src/components/filler/PenOverlay.tsx";

const ID = "sfmta_closure";

describe("FormsList", () => {
  it("shows each form's status and opens it", async () => {
    const onOpen = vi.fn();
    render(
      <FormsList
        permits={[permit(), permit({ id: "b", name: "Sound permit" })]}
        forms={{ [ID]: fill({ waiting: true }) }}
        sent={{}}
        openId={ID}
        onOpen={onOpen}
      />,
    );
    expect(screen.getByRole("button", { name: /Street closure/ })).toHaveAttribute("aria-current", "true");
    expect(screen.getByText("Needs you")).toHaveAttribute("data-tone", "waiting");
    expect(screen.getByText("Not started")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Sound permit/ }));
    expect(onOpen).toHaveBeenCalledWith("b");
  });
});

describe("FormToolbar", () => {
  function toolbar(overrides = {}) {
    const props = {
      title: "Street closure",
      sub: "SFMTA",
      pen: false,
      onTogglePen: vi.fn(),
      hasInk: false,
      onClearInk: vi.fn(),
      canDownload: false,
      onDownload: vi.fn(),
      sentOn: undefined,
      canMarkSent: false,
      onMarkSent: vi.fn(),
      ...overrides,
    };
    render(<FormToolbar {...props} />);
    return props;
  }

  it("disables export until the form is complete", () => {
    toolbar();
    expect(screen.getByRole("button", { name: "Download PDF" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Mark as sent" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Clear ink" })).not.toBeInTheDocument();
  });

  it("toggles the pen and shows the sent date", async () => {
    const props = toolbar({ pen: true, hasInk: true, sentOn: "Oct 2" });
    const pen = screen.getByRole("button", { name: "Pen on" });
    expect(pen).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(pen);
    expect(props.onTogglePen).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Sent Oct 2" })).toBeInTheDocument();
  });
});

describe("PaperField", () => {
  const field: FieldView = { key: "organizer", label: "Applicant name", value: "Maya", span: 1, status: "filled", editable: true };

  it("shows a filled value and edits it", async () => {
    const onStartEdit = vi.fn();
    const { rerender } = render(
      <PaperField field={field} canEdit editing={false} onStartEdit={onStartEdit} onChange={vi.fn()} onStopEdit={vi.fn()} />,
    );
    await userEvent.click(screen.getByText("Maya"));
    expect(onStartEdit).toHaveBeenCalled();

    const onChange = vi.fn();
    const onStopEdit = vi.fn();
    rerender(<PaperField field={field} canEdit editing onStartEdit={vi.fn()} onChange={onChange} onStopEdit={onStopEdit} />);
    const input = screen.getByLabelText("Applicant name");
    expect(input).toHaveFocus();
    await userEvent.type(input, "!{Enter}");
    expect(onChange).toHaveBeenCalledWith("Maya!");
    expect(onStopEdit).toHaveBeenCalled();
  });

  it("marks a field waiting on the user", () => {
    render(
      <PaperField field={{ ...field, status: "waiting", value: "" }} canEdit={false} editing={false} onStartEdit={vi.fn()} onChange={vi.fn()} onStopEdit={vi.fn()} />,
    );
    expect(screen.getByText("waiting on you")).toBeInTheDocument();
  });
});

describe("Paper", () => {
  it("renders the sections and lets filled fields be edited", async () => {
    const onEdit = vi.fn();
    render(
      <Paper agency="SFMTA" title="Block Party Application" reference="Rev. 2024" sections={fieldViews(fill({ progress: 1 }))} pen={false} strokes={[]} onStroke={vi.fn()} onEdit={onEdit} />,
    );
    expect(screen.getByRole("group", { name: "Applicant" })).toBeInTheDocument();
    expect(screen.getByText("Turn on the pen to sign this form.")).toBeInTheDocument();
    await userEvent.click(screen.getByText("Maya Reyes"));
    await userEvent.type(screen.getByLabelText("Applicant name"), "x");
    expect(onEdit).toHaveBeenCalledWith("organizer", "Maya Reyesx");
  });

  it("stops editing while the pen is on", async () => {
    render(<Paper agency="" title="" reference="" sections={fieldViews(fill({ progress: 1 }))} pen strokes={[]} onStroke={vi.fn()} onEdit={vi.fn()} />);
    await userEvent.click(screen.getByText("Maya Reyes"));
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.getByText("Draw your signature on the line above.")).toBeInTheDocument();
  });
});

describe("PenOverlay", () => {
  it("records a stroke only while enabled", () => {
    const onStroke = vi.fn();
    const { rerender } = render(<PenOverlay strokes={[]} enabled={false} onStroke={onStroke} />);
    const svg = screen.getByTestId("pen-overlay");
    const draw = () => {
      fireEvent.pointerDown(svg, { clientX: 10, clientY: 10 });
      fireEvent.pointerMove(svg, { clientX: 20, clientY: 15 });
      fireEvent.pointerMove(svg, { clientX: 21, clientY: 15 }); // under the minimum step
      fireEvent.pointerUp(svg);
    };
    draw();
    expect(onStroke).not.toHaveBeenCalled();

    rerender(<PenOverlay strokes={[]} enabled onStroke={onStroke} />);
    draw();
    expect(onStroke).toHaveBeenCalledWith([
      [10, 10],
      [20, 15],
    ]);
  });

  it("draws saved strokes", () => {
    const { container } = render(<PenOverlay strokes={[[[0, 0], [5, 5]]]} enabled={false} onStroke={vi.fn()} />);
    expect(container.querySelector("path")).toHaveAttribute("d", "M0 0 L5 5");
  });
});

describe("Feed / AskBox / ReadyNote", () => {
  it("logs entries and the working line", () => {
    render(<Feed entries={[{ kind: "fill", text: "Filled phone", sub: "415" }]} working />);
    expect(screen.getByText("Filled phone")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Filling from your details");
  });

  it("takes an answer", async () => {
    const onAnswer = vi.fn();
    render(<AskBox ask={{ prompt: "How many cylinders?", hint: "", placeholder: "one" }} onAnswer={onAnswer} />);
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(onAnswer).not.toHaveBeenCalled();
    await userEvent.type(screen.getByRole("textbox", { name: "How many cylinders?" }), " two {Enter}");
    expect(onAnswer).toHaveBeenCalledWith("two");
  });

  it("says what is left when ready", () => {
    render(<ReadyNote channel="Submit online." youAdd="nothing." />);
    expect(screen.getByText("Still yours to add: nothing.")).toBeInTheDocument();
  });
});

describe("FillerScreen", () => {
  function screenWith(st = fill(), sent: Record<string, string> = {}) {
    const props = {
      permits: [permit()],
      forms: { [ID]: st },
      sent,
      openId: ID,
      facts: { date: "2099-10-24" },
      strokes: [],
      onStroke: vi.fn(),
      onClearInk: vi.fn(),
      onOpen: vi.fn(),
      onAnswer: vi.fn(),
      onEdit: vi.fn(),
      onDownload: vi.fn(),
      onMarkSent: vi.fn(),
    };
    render(<FillerScreen {...props} />);
    return props;
  }

  it("asks for the field it is paused on", async () => {
    const props = screenWith(fill({ progress: 2, waiting: true }));
    expect(screen.getByText("How many propane cylinders?")).toBeInTheDocument();
    await userEvent.type(screen.getByRole("textbox", { name: "How many propane cylinders?" }), "one{Enter}");
    expect(props.onAnswer).toHaveBeenCalledWith("one");
  });

  it("enables export once complete", async () => {
    const props = screenWith(fill({ progress: 3, done: true }));
    expect(screen.getByText("Ready to send")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Street closure" })).toBeInTheDocument();
    expect(screen.getByText("SFMTA. Due Sep 24. $122.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Mark as sent" }));
    expect(props.onMarkSent).toHaveBeenCalled();
  });

  it("renders nothing for an unknown permit", () => {
    const { container } = render(
      <FillerScreen permits={[]} forms={{}} sent={{}} openId="x" facts={{}} strokes={[]} onStroke={vi.fn()} onClearInk={vi.fn()} onOpen={vi.fn()} onAnswer={vi.fn()} onEdit={vi.fn()} onDownload={vi.fn()} onMarkSent={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
