// Client for the permit API. Contract: docs/API_CONTRACT.md
// Every function here has a matching endpoint.

import type {
  ApiErrorBody,
  Facts,
  FormSpec,
  InkStroke,
  NavigatorTurn,
  SentRecord,
} from "../types/api.ts";

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

/** Thrown by renderPdf for web-form-only permits, with what to paste instead. */
export class NoPdfTemplateError extends ApiError {
  readonly pasteValues: Record<string, string>;
  readonly targetUrl: string | undefined;

  constructor(pasteValues: Record<string, string>, targetUrl?: string) {
    super({ code: "no_pdf_template", message: "This permit has no PDF form." });
    this.name = "NoPdfTemplateError";
    this.pasteValues = pasteValues;
    this.targetUrl = targetUrl;
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

/** A form's fields, filled from facts. */
export function formSpec(
  permitId: string,
  facts: Facts,
  answers: Record<string, string> = {},
): Promise<FormSpec> {
  return post(`/forms/${permitId}/spec`, { facts, answers });
}

/**
 * Render the filled PDF. `ink` is hand-drawn strokes in PDF user units at
 * 96 dpi, origin top-left. Throws NoPdfTemplateError for web-form-only permits.
 */
export async function renderPdf(
  permitId: string,
  facts: Facts,
  answers: Record<string, string>,
  ink: InkStroke[],
): Promise<Blob> {
  const res = await fetch(`${BASE}/forms/${permitId}/pdf`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ facts, answers, ink }),
  });
  if (res.status === 409) {
    const payload = (await res.json().catch(() => ({}))) as {
      paste_values?: Record<string, string>;
      target_url?: string;
    };
    throw new NoPdfTemplateError(payload.paste_values ?? {}, payload.target_url);
  }
  if (!res.ok) throw await errorFrom(res);
  return res.blob();
}

/** Record that the user submitted a form. No city API confirms this. */
export function markSent(
  permitId: string,
  { method = "portal", note = "" }: { method?: string; note?: string } = {},
): Promise<SentRecord> {
  return post(`/forms/${permitId}/sent`, { method, note });
}

/** A message fit for a toast, from anything a request can throw. */
export function errorMessage(err: unknown): string {
  return err instanceof Error && err.message ? err.message : "Something went wrong.";
}
