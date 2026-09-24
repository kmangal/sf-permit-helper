import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../../src/lib/api.ts";
import { question, terminal } from "../fixtures.ts";
import { OPENING_CHAT, useNavigator } from "../../src/hooks/useNavigator.ts";

vi.mock("../../src/lib/api.ts", async (orig) => ({
  ...(await orig<typeof import("../../src/lib/api.ts")>()),
  navigatorStart: vi.fn(),
  navigatorReply: vi.fn(),
}));

const start = vi.mocked(api.navigatorStart);
const reply = vi.mocked(api.navigatorReply);

function setup() {
  const onError = vi.fn();
  const hook = renderHook(() => useNavigator({ onError }));
  return { ...hook, onError };
}

describe("useNavigator", () => {
  beforeEach(() => {
    start.mockReset();
    reply.mockReset();
  });

  it("opens with the prompt and takes a description", async () => {
    start.mockResolvedValue(question());
    const { result } = setup();
    expect(result.current.chat).toEqual(OPENING_CHAT);
    expect(result.current.fresh).toBe(true);

    act(() => {
      expect(result.current.send("  Block party  ")).toBe(true);
    });
    expect(start).toHaveBeenCalledWith("Block party");
    expect(result.current.thinking).toBe("Reading your description against the city rules");

    await waitFor(() => expect(result.current.question?.fact).toBe("attendance"));
    const [, , user, actions, agent] = result.current.chat;
    expect(user).toEqual({ kind: "user", text: "Block party" });
    expect(actions).toEqual({ kind: "actions", actions: ["Location: street or sidewalk"] });
    expect(agent).toEqual({ kind: "agent", text: "Got 1 thing. A few more.\n\nHow many people?" });
    expect(result.current.known).toHaveLength(1);
  });

  it("answers the pending question and lands on the result", async () => {
    start.mockResolvedValue(question({ known: [] }));
    reply.mockResolvedValue(terminal({ known: [] }));
    const { result } = setup();

    act(() => void result.current.send("Block party"));
    await waitFor(() => expect(result.current.question).not.toBeNull());
    expect(result.current.chat.at(-1)).toMatchObject({ text: expect.stringContaining("Let me ask directly") });

    act(() => result.current.answer("50_to_100", "50 to 100"));
    expect(reply).toHaveBeenCalledWith("s1", "50_to_100");
    expect(result.current.chat.at(-1)).toEqual({ kind: "user", text: "50 to 100" });

    await waitFor(() => expect(result.current.result?.status).toBe("complete"));
    expect(result.current.canSend).toBe(false);
  });

  it("refuses to send while thinking or when empty", () => {
    start.mockReturnValue(new Promise(() => {}));
    const { result } = setup();
    act(() => void result.current.send("first"));
    act(() => {
      expect(result.current.send("second")).toBe(false);
      expect(result.current.send("   ")).toBe(false);
    });
    expect(start).toHaveBeenCalledTimes(1);
  });

  it("ends the conversation on abort", async () => {
    start.mockResolvedValue({ session_id: "s1", kind: "aborted", message: "Sorry, we cannot help you.", fact: "x" });
    const { result } = setup();
    act(() => void result.current.send("?"));
    await waitFor(() => expect(result.current.ended).toBe(true));
    expect(result.current.chat.at(-1)).toEqual({
      kind: "agent",
      text: "Sorry, we cannot help you. Start over to try again.",
    });
  });

  it("reports request failures", async () => {
    start.mockRejectedValue(new Error("Down"));
    const { result, onError } = setup();
    act(() => void result.current.send("hi"));
    await waitFor(() => expect(onError).toHaveBeenCalled());
    expect(result.current.thinking).toBeNull();
  });
});
