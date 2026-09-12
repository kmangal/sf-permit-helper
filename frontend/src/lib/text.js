// Client-side text parsing, ported from the prototype in
// design/canvas/Main.dc.html. Typed answers to intake questions are matched
// here; the schema comes from the API but carries no regexes.

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** "Oct 24" -> Date at local noon. Rolls to next year when already past. */
export function parseDate(text) {
  const iso = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso) return new Date(+iso[1], +iso[2] - 1, +iso[3], 12);
  const m = text
    .toLowerCase()
    .match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})\b/);
  if (!m) return null;
  const now = new Date();
  let d = new Date(now.getFullYear(), MONTHS.indexOf(m[1]), parseInt(m[2], 10), 12);
  if (d.getTime() < now.getTime())
    d = new Date(now.getFullYear() + 1, MONTHS.indexOf(m[1]), parseInt(m[2], 10), 12);
  return d;
}

/** "in 6 weeks", "2 months" -> Date. */
export function parseRelativeDate(text) {
  const rel = text.toLowerCase().match(/(\d+)\s*(week|month)/);
  if (!rel) return null;
  return addDays(new Date(), parseInt(rel[1], 10) * (rel[2] === "week" ? 7 : 30));
}

/** Either form. */
export function parseAnyDate(text) {
  return parseDate(text) || parseRelativeDate(text);
}

export function addDays(d, n) {
  const x = new Date(d.getTime());
  x.setDate(x.getDate() + n);
  return x;
}

/** Facts carry dates as ISO YYYY-MM-DD. */
export function toISO(d) {
  const p = (n) => String(n).padStart(2, "0");
  return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
}

export function fromISO(s) {
  if (!s) return null;
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return new Date(+m[1], +m[2] - 1, +m[3], 12);
}

export function fmtDate(d) {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function fmtLong(d) {
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

export function fmtFull(d) {
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function daysOut(d) {
  return d ? Math.round((d.getTime() - Date.now()) / 86400000) : null;
}

/** True when the date is already behind us. */
export function isPast(d) {
  return !!d && d.getTime() < Date.now();
}

/** Integer cents to "$1,433". */
export function fmtMoney(cents) {
  const n = Math.round((cents || 0) / 100);
  return "$" + n.toLocaleString();
}

/** "Maya Reyes, maya@example.com, 415 555 0100" -> name, email, phone. */
export function parseOrganizer(t) {
  const email = (t.match(/[\w.+-]+@[\w-]+\.[\w.]+/) || [""])[0];
  const phone = (t.match(/\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/) || [""])[0];
  const name = t
    .replace(email, "")
    .replace(phone, "")
    .replace(/[,;]+\s*$/, "")
    .replace(/\b(i am|i'm|it's|its|my name is|this is)\b/gi, "")
    .replace(/[,;]/g, "")
    .trim();
  return { organizer: name || "You", email, phone };
}

const NEGATIVE = /^(no|none|nothing|nope|nah)\b/;
const AFFIRMATIVE = /^(yes|yeah|yep|yup|sure)\b/;

function isNoneValue(v) {
  const s = String(v).toLowerCase();
  return s === "none" || s === "no" || s === "false";
}

/**
 * A typed answer to a choice question. Label substring first, then an
 * optional `match` regex from the schema, then simple synonyms, then a
 * number for numeric questions.
 */
export function matchOption(q, text) {
  const options = q.options || [];
  const t = text.toLowerCase().trim();
  const numeric = q.number || q.key === "attendance" || options.some((o) => typeof o.value === "number");

  const byLabel = options.find(
    (o) => o.label && t.indexOf(String(o.label).toLowerCase().split(",")[0]) !== -1,
  );
  if (byLabel) return byLabel;

  const byMatch = options.find((o) => {
    if (!o.match) return false;
    try {
      return new RegExp(o.match, "i").test(t);
    } catch {
      return false;
    }
  });
  if (byMatch) return byMatch;

  if (NEGATIVE.test(t)) {
    const none = options.find((o) => isNoneValue(o.value));
    if (none) return none;
  }
  if (AFFIRMATIVE.test(t)) {
    const yes = options.find((o) => !isNoneValue(o.value));
    if (yes) return yes;
  }

  if (numeric) {
    const n = t.match(/\d[\d,]*/);
    if (n) {
      const v = parseInt(n[0].replace(/,/g, ""), 10);
      return { value: v, label: "About " + v.toLocaleString() };
    }
  }
  return null;
}

/** `only_if` is a flat equality map on facts. */
export function onlyIfSatisfied(q, facts) {
  const cond = q.only_if;
  if (!cond) return true;
  return Object.keys(cond).every((k) => facts[k] === cond[k]);
}

/** True while any fact the condition depends on is still unknown. */
export function onlyIfUndecided(q, facts) {
  const cond = q.only_if;
  if (!cond) return false;
  return Object.keys(cond).some((k) => facts[k] === undefined);
}

export function capitalize(s) {
  return s ? String(s).charAt(0).toUpperCase() + String(s).slice(1) : "";
}
