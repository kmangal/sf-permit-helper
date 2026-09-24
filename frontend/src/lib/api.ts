// Client for the permit API. Contract: docs/API_CONTRACT.md
// Every function here has a matching endpoint.

import type { ApiErrorBody, NavigatorTurn, RuleDiagram, RuleDiagramsResponse } from "../types/api.ts";

const BASE = "/api/v1";

export class ApiError extends Error {
  readonly code: string;
  readonly missing: string[];

  constructor(error: Partial<ApiErrorBody>) {
    super(error.message || "Request failed");
    this.name = "ApiError";
    this.code = error.code ?? "unknown";
    this.missing = error.missing ?? [];
  }
}

async function errorFrom(res: Response): Promise<ApiError> {
  const payload = (await res.json().catch(() => ({}))) as { error?: ApiErrorBody };
  return new ApiError(payload.error ?? { code: "http_" + res.status, message: res.statusText });
}

async function request(path: string, body: unknown): Promise<Response> {
  const res = await fetch(BASE + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw await errorFrom(res);
  return res;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  return (await (await request(path, body)).json()) as T;
}

/**
 * Start the navigator from a free-text description. jev answers what it can;
 * the turn is the next question for the user, the terminal result, or an abort.
 */
export function navigatorStart(description: string): Promise<NavigatorTurn> {
  return post("/navigator", { description });
}

/** Answer the navigator's pending question: an option label or free text. */
export function navigatorReply(sessionId: string, answer: string): Promise<NavigatorTurn> {
  return post(`/navigator/${sessionId}`, { answer });
}

/**
 * Ask about the pending question without answering it. The reply streams in
 * as plain text; `onText` gets each piece as it arrives.
 */
export async function navigatorClarify(
  sessionId: string,
  question: string,
  onText: (text: string) => void,
): Promise<void> {
  const res = await request(`/navigator/${sessionId}/clarify`, { question });
  if (!res.body) {
    onText(await res.text());
    return;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  for (;;) {
    const { done, value } = await reader.read();
    const text = decoder.decode(value, { stream: !done });
    if (text) onText(text);
    if (done) return;
  }
}

/** The rules engine's decision flow, one Mermaid flowchart per section. */
export async function ruleDiagrams(): Promise<RuleDiagram[]> {
  const res = await fetch(BASE + "/rules/diagrams");
  if (!res.ok) throw await errorFrom(res);
  return ((await res.json()) as RuleDiagramsResponse).diagrams;
}

/** A message fit for a toast, from anything a request can throw. */
export function errorMessage(err: unknown): string {
  return err instanceof Error && err.message ? err.message : "Something went wrong.";
}
