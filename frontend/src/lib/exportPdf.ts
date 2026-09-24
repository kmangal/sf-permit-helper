// Download a filled form as PDF, or copy paste values for web-form-only permits.

import type { Facts } from "../types/api.ts";
import { NoPdfTemplateError, renderPdf } from "./api.ts";
import { inkToPdfUnits, PAPER_WIDTH, type Stroke } from "./ink.ts";

export function pdfFileName(title: string): string {
  return title.replace(/[^a-z0-9]+/gi, "-") + ".pdf";
}

export function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

interface ExportRequest {
  permitId: string;
  title: string;
  facts: Facts;
  answers: Record<string, string>;
  strokes: Stroke[];
}

/** Resolves to a line for the toast. Rethrows anything but a missing template. */
export async function exportPdf({ permitId, title, facts, answers, strokes }: ExportRequest): Promise<string> {
  const fileName = pdfFileName(title);
  try {
    const blob = await renderPdf(permitId, facts, answers, inkToPdfUnits(strokes, PAPER_WIDTH));
    saveBlob(blob, fileName);
    return "Saved " + fileName;
  } catch (err) {
    if (!(err instanceof NoPdfTemplateError)) throw err;
    const n = Object.keys(err.pasteValues).length;
    try {
      await navigator.clipboard.writeText(JSON.stringify(err.pasteValues, null, 2));
    } catch {
      // Clipboard blocked; the toast still tells them what happened.
    }
    return "No PDF for this one yet. Copied " + n + " values for the city form.";
  }
}
