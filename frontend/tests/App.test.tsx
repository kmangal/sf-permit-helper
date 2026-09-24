import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import App from "../src/App.tsx";
import * as api from "../src/lib/api.ts";
import { question, terminal } from "./fixtures.ts";

vi.mock("../src/lib/api.ts", async (orig) => ({
  ...(await orig<typeof import("../src/lib/api.ts")>()),
  navigatorStart: vi.fn(),
  navigatorReply: vi.fn(),
}));

describe("App", () => {
  it("runs intake to summary, and starts over", async () => {
    vi.mocked(api.navigatorStart).mockResolvedValue(question({ known: [] }));
    vi.mocked(api.navigatorReply).mockResolvedValue(terminal());
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByRole("textbox", { name: "Message" }), "Block party on Bocana{Enter}");
    await user.click(await screen.findByRole("button", { name: "50 to 100" }));

    expect(await screen.findByRole("heading", { level: 1 }, { timeout: 2000 })).toHaveTextContent(
      "1 permit required for your event.",
    );
    expect(screen.getByRole("article", { name: "Street closure" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Start over" }));
    expect(screen.getByText("Find out what permits you need to host events in the city.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "See an example" })).toBeInTheDocument();
  });

  it("toasts a failed request", async () => {
    vi.mocked(api.navigatorStart).mockRejectedValue(new Error("Navigator is down."));
    const user = userEvent.setup();
    render(<App />);
    await user.type(screen.getByRole("textbox", { name: "Message" }), "hi{Enter}");
    expect(await screen.findByText("Navigator is down.")).toBeInTheDocument();
  });
});
