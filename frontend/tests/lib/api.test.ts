import { describe, expect, it, vi } from "vitest";
import { ApiError, errorMessage, navigatorReply } from "../../src/lib/api.ts";

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
      "/api/navigator/s",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ answer: "yes" }) }),
    );
  });

  it("raises the server's error body", async () => {
    mockFetch(404, { error: { code: "unknown_session", message: "Session expired." } });
    const err = await navigatorReply("s", "yes").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ code: "unknown_session", message: "Session expired." });
  });

  it("has a fallback message", () => {
    expect(errorMessage("nope")).toBe("Something went wrong.");
    expect(errorMessage(new Error("Down"))).toBe("Down");
  });
});
