import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../../../src/App.tsx";

// Formspree answers {next} on success and {errors} on failure; stub fetch so the real SDK runs.
const reply = (body: unknown) =>
  vi.fn(async (_url: string, _init: RequestInit) => new Response(JSON.stringify(body)));

async function fillAndSend() {
  const user = userEvent.setup();
  await user.type(screen.getByRole("textbox", { name: "Email" }), "a@example.com");
  await user.type(screen.getByRole("textbox", { name: "Message" }), "The block party answer looks wrong.");
  await user.click(screen.getByRole("button", { name: "Send message" }));
}

describe("ContactPage", () => {
  beforeEach(() => window.history.pushState(null, "", "/contact"));
  afterEach(() => {
    vi.unstubAllGlobals();
    window.history.pushState(null, "", "/");
  });

  it("posts the form to Formspree and thanks the sender", async () => {
    const fetch = reply({ next: "https://formspree.io/thanks" });
    vi.stubGlobal("fetch", fetch);
    render(<App />);

    await fillAndSend();

    expect(await screen.findByRole("status")).toHaveTextContent("Thanks, your message was sent.");
    expect(fetch).toHaveBeenCalledWith("https://formspree.io/f/xoevrdoe", expect.objectContaining({ method: "POST" }));
    const body = fetch.mock.calls[0]![1]!.body as FormData;
    expect(body.get("email")).toBe("a@example.com");
    expect(body.get("message")).toBe("The block party answer looks wrong.");
  });

  it("shows Formspree's errors and keeps the form", async () => {
    vi.stubGlobal(
      "fetch",
      reply({
        errors: [
          { field: "email", code: "TYPE_EMAIL", message: "should be an email" },
          { code: "INACTIVE", message: "Form is not active" },
        ],
      }),
    );
    render(<App />);

    await fillAndSend();

    expect(await screen.findByText("Email should be an email")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Form is not active");
    expect(screen.getByRole("button", { name: "Send message" })).toBeEnabled();
  });

  it("is linked from the header on every page", async () => {
    const user = userEvent.setup();
    window.history.pushState(null, "", "/");
    render(<App />);

    await user.click(screen.getByRole("link", { name: "Contact" }));
    expect(screen.getByRole("heading", { name: "Contact" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Find your permits" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Contact" })).toBeInTheDocument();
  });
});
