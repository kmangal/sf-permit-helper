// Date helpers. Facts carry dates as ISO YYYY-MM-DD; we hold them at local noon.

export function addDays(d: Date, n: number): Date {
  const x = new Date(d.getTime());
  x.setDate(x.getDate() + n);
  return x;
}

export function fromISO(s: unknown): Date | null {
  if (!s) return null;
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12);
}

/** True when the date is already behind us. */
export function isPast(d: Date | null, now: number = Date.now()): boolean {
  return !!d && d.getTime() < now;
}
