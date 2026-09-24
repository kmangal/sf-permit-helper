// Display formatting: text, money, dates.

export function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
}

/** "street_or_sidewalk" -> "Street or sidewalk". */
export function humanize(s: unknown): string {
  return capitalize(String(s ?? "").replace(/_/g, " "));
}

/** Whole dollars to "$1,433". */
export function usd(n: number): string {
  return "$" + Number(n).toLocaleString();
}

/** Integer cents to "$1,433". */
export function fmtMoney(cents: number | null | undefined): string {
  return usd(Math.round((cents || 0) / 100));
}

/** "Oct 24". */
export function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** "1 thing", "3 things". */
export function plural(n: number, word: string): string {
  return n + " " + word + (n === 1 ? "" : "s");
}
