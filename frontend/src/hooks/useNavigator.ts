// The intake conversation over /api/v1/navigator: jev answers from the
// description, the rules engine picks the questions, the user fills the gaps.

import { useCallback, useRef, useState } from "react";
import { navigatorClarify, navigatorReply, navigatorStart } from "../lib/api.ts";
import { humanize, plural } from "../lib/format.ts";
import type { KnownFact, NavigatorTurn, QuestionTurn, TerminalTurn } from "../types/api.ts";
import { useAlive } from "./useAlive.ts";

export type ChatItem =
  | { kind: "agent"; text: string; lead?: boolean }
  | { kind: "user"; text: string }
  | { kind: "actions"; actions: string[] };

export const OPENING_CHAT: ChatItem[] = [
  { kind: "agent", lead: true, text: "Tell me about the event." },
  {
    kind: "agent",
    text: "Where, when, who is organizing, how many people, and anything happening: food, music, alcohol, tents, sales. One message is fine. I will pull out what I can and ask about the rest.",
  },
];

/** How long the action log gets to animate before the next question lands. */
export function actionLogMs(n: number): number {
  return 500 + n * 110;
}

/** A newly settled fact, as a line in the action log. */
export function knownLine(k: KnownFact): string {
  return humanize(k.fact) + ": " + humanize(k.label).toLowerCase();
}

function questionIntro(turn: QuestionTurn, first: boolean, fresh: number): string {
  if (turn.rejected) return "I could not use that. ";
  if (!first) return "";
  return fresh
    ? "Got " + plural(fresh, "thing") + ". A few more.\n\n"
    : "I could not pull much from that. Let me ask directly.\n\n";
}

/** Shown when a clarifying question comes back empty. */
export const NO_CLARIFICATION = "I could not come up with an answer to that. Pick the closest option above.";

/** Grow the last message by `text`: a streamed reply arriving. */
function appendToLast(chat: ChatItem[], text: string): ChatItem[] {
  const last = chat.at(-1);
  if (last?.kind !== "agent") return [...chat, { kind: "agent", text }];
  return [...chat.slice(0, -1), { ...last, text: last.text + text }];
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function useNavigator({ onError }: { onError: (err: unknown) => void }) {
  const alive = useAlive();
  const [chat, setChat] = useState<ChatItem[]>(OPENING_CHAT);
  const [known, setKnown] = useState<KnownFact[]>([]);
  const [question, setQuestion] = useState<QuestionTurn | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [thinking, setThinking] = useState<string | null>(null);
  // A clarifying question in flight: waiting for its first words, then streaming them.
  const [clarifying, setClarifying] = useState<"waiting" | "streaming" | null>(null);
  const [ended, setEnded] = useState(false);
  const [result, setResult] = useState<TerminalTurn | null>(null);
  const knownRef = useRef<KnownFact[]>([]);

  const push = useCallback((...items: ChatItem[]) => setChat((prev) => [...prev, ...items]), []);

  /** Show one turn: log what jev settled, then ask, finish, or stop. */
  const handleTurn = useCallback(
    async (turn: NavigatorTurn, first: boolean) => {
      const before = new Set(knownRef.current.map((k) => k.fact));
      const next = turn.known ?? knownRef.current;
      const fresh = next.filter((k) => k.by === "jev" && !before.has(k.fact));
      knownRef.current = next;
      setKnown(next);
      setThinking(null);
      if (fresh.length) {
        push({ kind: "actions", actions: fresh.map(knownLine) });
        await sleep(actionLogMs(fresh.length));
        if (!alive.current) return;
      }
      switch (turn.kind) {
        case "question":
          setQuestion(turn);
          push({ kind: "agent", text: questionIntro(turn, first, fresh.length) + turn.prompt });
          return;
        case "aborted":
          setQuestion(null);
          setSessionId(null);
          setEnded(true);
          push({ kind: "agent", text: turn.message + " Start over to try again." });
          return;
        case "terminal":
          setQuestion(null);
          setSessionId(null);
          setResult(turn);
          return;
      }
    },
    [alive, push],
  );

  const run = useCallback(
    async (label: string, request: () => Promise<NavigatorTurn>, first: boolean) => {
      setThinking(label);
      try {
        const turn = await request();
        if (!alive.current) return;
        if (first) setSessionId(turn.session_id);
        await handleTurn(turn, first);
      } catch (err) {
        if (!alive.current) return;
        setThinking(null);
        onError(err);
      }
    },
    [alive, handleTurn, onError],
  );

  /** `shown` is how a tapped option reads in the chat, if not the text itself. */
  const answer = useCallback(
    (text: string, shown?: string) => {
      if (!sessionId) return;
      push({ kind: "user", text: shown ?? text });
      setQuestion(null);
      void run("Checking the rules", () => navigatorReply(sessionId, text), false);
    },
    [sessionId, push, run],
  );

  const canSend = !thinking && !clarifying && !ended && !result && (!sessionId || !!question);

  /** Send whatever the user typed: the description first, then answers. False if not taken. */
  const send = useCallback(
    (raw: string): boolean => {
      const text = raw.trim();
      if (!text || !canSend) return false;
      if (sessionId) {
        answer(text);
      } else {
        push({ kind: "user", text });
        void run("Reading your description against the city rules", () => navigatorStart(text), true);
      }
      return true;
    },
    [canSend, sessionId, answer, push, run],
  );

  /** Ask about the pending question; the answer streams into the chat. False if not taken. */
  const clarify = useCallback(
    (raw: string): boolean => {
      const text = raw.trim();
      if (!text || !sessionId || !question || !canSend) return false;
      push({ kind: "user", text });
      setClarifying("waiting");
      void (async () => {
        let started = false;
        try {
          await navigatorClarify(sessionId, text, (piece) => {
            if (!alive.current) return;
            if (!started) {
              started = true;
              setClarifying("streaming");
              push({ kind: "agent", text: piece });
            } else {
              setChat((prev) => appendToLast(prev, piece));
            }
          });
          if (alive.current && !started) push({ kind: "agent", text: NO_CLARIFICATION });
        } catch (err) {
          if (alive.current) onError(err);
        } finally {
          if (alive.current) setClarifying(null);
        }
      })();
      return true;
    },
    [alive, canSend, onError, push, question, sessionId],
  );

  return {
    chat,
    known,
    question,
    thinking,
    clarifying,
    ended,
    result,
    /** Nothing sent yet: the opening prompt is still all there is. */
    fresh: !sessionId && !ended && !thinking && chat.length <= OPENING_CHAT.length,
    canSend,
    send,
    answer,
    clarify,
  };
}

export type Navigator = ReturnType<typeof useNavigator>;
