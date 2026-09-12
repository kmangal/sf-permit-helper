// Client for the permit API. Contract: docs/API_CONTRACT.md
// Every function here has a matching endpoint. Swap MOCK to false once the
// backend is up; nothing else in the UI changes.

const MOCK = true;
const BASE = "/api";

async function post(path, body) {
  const res = await fetch(BASE + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    throw new ApiError(payload.error || { code: "http_" + res.status, message: res.statusText });
  }
  return res.json();
}

async function get(path) {
  const res = await fetch(BASE + path);
  if (!res.ok) throw new ApiError({ code: "http_" + res.status, message: res.statusText });
  return res.json();
}

export class ApiError extends Error {
  constructor(error) {
    super(error.message || "Request failed");
    this.code = error.code;
    this.missing = error.missing || [];
  }
}

/** The intake question list, in ask order. */
export function intakeSchema() {
  if (MOCK) return mock.intakeSchema();
  return get("/intake/schema");
}

/** Free text to facts. The one LLM call in the intake path. */
export function extract(text) {
  if (MOCK) return mock.extract(text);
  return post("/extract", { text });
}

/** Facts to permits. Deterministic rules engine, every outcome cited. */
export function determine(facts) {
  if (MOCK) return mock.determine(facts);
  return post("/determine", { facts });
}

/** A form's fields, filled from facts. */
export function formSpec(permitId, facts, answers = {}) {
  if (MOCK) return mock.formSpec(permitId, facts, answers);
  return post(`/forms/${permitId}/spec`, { facts, answers });
}

/**
 * Render the filled PDF. `ink` is hand-drawn strokes in PDF user units at
 * 96 dpi, origin top-left. Resolves to a Blob.
 * Throws ApiError with code "no_pdf_template" for web-form-only permits;
 * read err.pasteValues and err.targetUrl in that case.
 */
export async function renderPdf(permitId, facts, answers, ink) {
  if (MOCK) return mock.renderPdf(permitId);
  const res = await fetch(`${BASE}/forms/${permitId}/pdf`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ facts, answers, ink }),
  });
  if (res.status === 409) {
    const payload = await res.json();
    const err = new ApiError({ code: "no_pdf_template", message: "This permit has no PDF form." });
    err.pasteValues = payload.paste_values;
    err.targetUrl = payload.target_url;
    throw err;
  }
  if (!res.ok) throw new ApiError({ code: "http_" + res.status, message: res.statusText });
  return res.blob();
}

/** Record that the user submitted a form. No city API confirms this. */
export function markSent(permitId, { method = "portal", note = "" } = {}) {
  if (MOCK) return Promise.resolve({ sent_at: new Date().toISOString(), method, note });
  return post(`/forms/${permitId}/sent`, { method, note });
}

/**
 * Convert on-screen ink strokes to PDF user units.
 * strokes: [[[x, y], ...], ...] in CSS px relative to the rendered page.
 * renderedWidth: the page element's width in CSS px. pageWidth defaults to
 * US Letter at 96 dpi.
 */
export function inkToPdfUnits(strokes, renderedWidth, page = 1, pageWidth = 816) {
  const scale = pageWidth / renderedWidth;
  return strokes.map((points) => ({
    page,
    width: 2.2,
    color: "#16264d",
    points: points.map(([x, y]) => [
      Math.round(x * scale * 100) / 100,
      Math.round(y * scale * 100) / 100,
    ]),
  }));
}

// --- Mock layer -------------------------------------------------------------
// Mirrors the prototype in design/canvas/Main.dc.html so the UI can be built
// and demoed before the backend lands. Delete once MOCK is false.

const mock = {
  intakeSchema: () => Promise.resolve({ questions: [] }),
  extract: (text) => Promise.resolve({ facts: {}, found: [], next_question: "organizer", _text: text }),
  determine: () => Promise.resolve({ site_check: null, fees: {}, first_deadline: null, permits: [] }),
  formSpec: (permitId) => Promise.resolve({ permit_id: permitId, sections: [] }),
  renderPdf: () => Promise.reject(new ApiError({ code: "no_pdf_template", message: "Mock mode." })),
};
