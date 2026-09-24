// Client for the permit API. Contract: docs/API_CONTRACT.md
// Every function here has a matching endpoint.

import type { ApiErrorBody, NavigatorTurn } from "../types/api.ts";

const BASE = "/api";

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

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(BASE + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw await errorFrom(res);
  return (await res.json()) as T;
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

/** A message fit for a toast, from anything a request can throw. */
export function errorMessage(err: unknown): string {
  return err instanceof Error && err.message ? err.message : "Something went wrong.";
}
