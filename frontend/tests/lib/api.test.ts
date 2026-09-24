import { describe, expect, it, vi } from "vitest";
import { ApiError, errorMessage, navigatorClarify, navigatorReply } from "../../src/lib/api.ts";

function mockFetch(status: number, body: unknown) {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }),
  );
}

describe("api", () => {
  it("posts JSON and returns the parsed body", async () => {
    const fetch = mockFetch(200, { kind: "aborted", message: "no", fact: "x", session_id: "s" });
    const turn = await navigatorReply("s", "yes");
    expect(turn.kind).toBe("aborted");
    expect(fetch).toHaveBeenCalledWith(
      "/api/v1/navigator/s",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ answer: "yes" }) }),
    );
  });

  it("raises the server's error body", async () => {
    mockFetch(404, { error: { code: "unknown_session", message: "Session expired." } });
    const err = await navigatorReply("s", "yes").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ code: "unknown_session", message: "Session expired." });
  });

  it("streams a clarification piece by piece", async () => {
    const bytes = new TextEncoder().encode("Count é everyone");
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        // Split inside the two-byte "é" to check pieces are decoded as a stream.
        controller.enqueue(bytes.slice(0, 7));
        controller.enqueue(bytes.slice(7));
        controller.close();
      },
    });
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(body, { status: 200 }));
    const pieces: string[] = [];
    await navigatorClarify("s", "Do kids count?", (t) => pieces.push(t));
    expect(pieces.join("")).toBe("Count é everyone");
    expect(fetch).toHaveBeenCalledWith(
      "/api/v1/navigator/s/clarify",
      expect.objectContaining({ body: JSON.stringify({ question: "Do kids count?" }) }),
    );
  });

  it("has a fallback message", () => {
    expect(errorMessage("nope")).toBe("Something went wrong.");
    expect(errorMessage(new Error("Down"))).toBe("Down");
  });
});
