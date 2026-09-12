import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  determine,
  extract,
  formSpec,
  inkToPdfUnits,
  intakeSchema,
  markSent,
  renderPdf,
} from "./lib/api.js";
import {
  addDays,
  capitalize,
  daysOut,
  fmtDate,
  fmtLong,
  fmtMoney,
  fromISO,
  isPast,
  matchOption,
  onlyIfSatisfied,
  onlyIfUndecided,
  parseAnyDate,
  parseOrganizer,
  toISO,
} from "./lib/text.js";
import Filler from "./components/Filler.jsx";
import Intake from "./components/Intake.jsx";
import Ledger from "./components/Ledger.jsx";
import Summary from "./components/Summary.jsx";
import "./styles.css";

const SHARED_KEYS = ["organizer", "email", "phone", "address"];
const PAPER_WIDTH = 612;
const STEP_MS = 380;

const OPENING_CHAT = [
  { kind: "agent", lead: true, text: "Tell me about the event." },
  {
    kind: "agent",
    text: "Where, when, who is organizing, how many people, and anything happening: food, music, alcohol, tents, sales. One message is fine. I will pull out what I can and ask about the rest.",
  },
];

const EXAMPLE =
  "Block party on the 400 block of Bocana St, Saturday Oct 24, noon to 6pm, about 80 people. A neighbor band plays for an hour, a taco stand cooking on site, a bounce house in the street, no alcohol, nothing sold.";

const LAYER_NAMES = {
  muni_routes: "Muni routes",
  street_classification: "street classification",
  iscott_closures: "current ISCOTT closures",
  park_boundaries: "park boundaries",
  port_boundaries: "Port boundaries",
};

function flatten(sections) {
  return (sections || []).reduce((a, sec) => a.concat(sec.fields || []), []);
}

function askOf(field) {
  if (!field) return null;
  if (field.ask) return field.ask;
  if (field.source === "ask")
    return { prompt: "What goes in " + field.label + "?", hint: "", placeholder: "" };
  return null;
}

function sourceLine(check) {
  const checks = (check && check.checks) || [];
  if (check && check.source) return check.source;
  if (!checks.length) return "";
  const names = checks.map((c) => LAYER_NAMES[c.layer] || String(c.layer || "").replace(/_/g, " "));
  const list =
    names.length > 1 ? names.slice(0, -1).join(", ") + ", and " + names[names.length - 1] : names[0];
  return "Checked against " + list + " on DataSF.";
}

function permitDue(p, facts) {
  if (p.due_date) return fromISO(p.due_date);
  const d = fromISO(facts.date);
  if (d && typeof p.lead_days === "number") return addDays(d, -p.lead_days);
  return null;
}

function shortFee(p) {
  return p.fee_cents ? fmtMoney(p.fee_cents) : "no fee";
}

function youAddLine(p) {
  const list = p.you_must_add || [];
  if (!list.length) return "nothing.";
  const s = list.join(", ");
  return /[.!?]$/.test(s) ? s : s + ".";
}

export default function App() {
  const [questions, setQuestions] = useState([]);
  const [stage, setStage] = useState("chat");
  const [facts, setFacts] = useState({});
  const [currentQ, setCurrentQ] = useState(null);
  const [thinking, setThinking] = useState(false);
  const [thinkingText, setThinkingText] = useState("");
  const [chat, setChat] = useState(OPENING_CHAT);
  const [input, setInput] = useState("");
  const [determination, setDetermination] = useState(null);
  const [openForm, setOpenForm] = useState(null);
  const [fill, setFill] = useState({});
  const [sent, setSent] = useState({});
  const [toast, setToast] = useState({ msg: "", n: 0 });
  const [showNotNeeded, setShowNotNeeded] = useState(false);
  const [pen, setPen] = useState(false);
  const [ink, setInk] = useState({});
  const [curStroke, setCurStroke] = useState([]);
  const [editing, setEditing] = useState(null);

  const runRef = useRef(0);
  const timersRef = useRef(new Set());
  const drawingRef = useRef(false);
  const curRef = useRef([]);
  const stateRef = useRef({});

  useEffect(() => {
    stateRef.current = { stage, facts, fill, openForm, questions, sent, determination };
  });

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((t) => clearTimeout(t));
    timersRef.current.clear();
  }, []);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const later = useCallback((fn, ms) => {
    const token = runRef.current;
    const t = setTimeout(() => {
      timersRef.current.delete(t);
      if (token === runRef.current) fn();
    }, ms);
    timersRef.current.add(t);
    return t;
  }, []);

  const wait = useCallback(
    (ms) =>
      new Promise((resolve) => {
        later(resolve, ms);
      }),
    [later],
  );

  const toastMsg = useCallback((msg) => {
    setToast((prev) => ({ msg, n: prev.n + 1 }));
  }, []);

  useEffect(() => {
    if (!toast.msg) return undefined;
    const t = setTimeout(() => {
      setToast((prev) => (prev.n === toast.n ? { msg: "", n: prev.n } : prev));
    }, 2400);
    return () => clearTimeout(t);
  }, [toast]);

  const fail = useCallback(
    (err) => {
      toastMsg(err && err.message ? err.message : "Something went wrong.");
    },
    [toastMsg],
  );

  // ---------- schema ----------
  useEffect(() => {
    let live = true;
    intakeSchema()
      .then((res) => {
        if (live) setQuestions(res.questions || []);
      })
      .catch((err) => {
        if (live) fail(err);
      });
    return () => {
      live = false;
    };
  }, [fail]);

  // ---------- intake helpers ----------
  const isKnown = useCallback((f, q) => {
    if (q.key === "date") return !!f.date;
    const v = f[q.key];
    return v !== undefined && v !== "";
  }, []);

  const nextQuestion = useCallback(
    (f) => {
      for (const q of stateRef.current.questions || questions) {
        if (!onlyIfSatisfied(q, f)) continue;
        if (!isKnown(f, q)) return q;
      }
      return null;
    },
    [questions, isKnown],
  );

  const pushChat = useCallback((items) => {
    if (items.length) setChat((prev) => prev.concat(items));
  }, []);

  const askNext = useCallback(
    async (nextFacts) => {
      setFacts(nextFacts);
      const q = nextQuestion(nextFacts);
      if (q) {
        setCurrentQ(q.key);
        setThinking(false);
        setInput("");
        pushChat([{ kind: "agent", text: q.prompt }]);
        return;
      }
      setCurrentQ(null);
      setThinking(true);
      setThinkingText("Checking 13 city rules against your event");
      const token = runRef.current;
      try {
        const det = await determine(nextFacts);
        if (token !== runRef.current) return;
        setDetermination(det);
        setStage("summary");
        setThinking(false);
        setInput("");
      } catch (err) {
        if (token !== runRef.current) return;
        setThinking(false);
        fail(err);
      }
    },
    [nextQuestion, pushChat, fail],
  );

  const askKey = useCallback(
    (key, nextFacts) => {
      const q = (stateRef.current.questions || []).find((x) => x.key === key);
      if (!q) return askNext(nextFacts);
      setFacts(nextFacts);
      setCurrentQ(q.key);
      setThinking(false);
      setInput("");
      pushChat([{ kind: "agent", text: q.prompt }]);
      return undefined;
    },
    [askNext, pushChat],
  );

  // ---------- fill animation ----------
  const stepFill = useCallback(
    function step(id) {
      later(() => {
        const s = stateRef.current;
        if (s.stage !== "work") return;
        const st = s.fill[id];
        if (!st || !st.sections) return;
        const flat = flatten(st.sections);
        if (st.progress >= flat.length) {
          if (st.done) return;
          const p = (s.determination && s.determination.permits ? s.determination.permits : []).find(
            (x) => x.id === id,
          );
          const due = p ? permitDue(p, s.facts) : null;
          const sub = p ? shortFee(p) + (due ? ", due " + fmtDate(due) : "") : "";
          setFill((prev) => ({
            ...prev,
            [id]: {
              ...prev[id],
              done: true,
              feed: (prev[id].feed || []).concat([
                { kind: "done", text: "Form complete", sub },
              ]),
            },
          }));
          return;
        }
        const fld = flat[st.progress];
        const val = st.answers[fld.key] !== undefined ? st.answers[fld.key] : fld.value;
        if ((val === "" || val === undefined || val === null) && askOf(fld)) {
          setFill((prev) => ({
            ...prev,
            [id]: {
              ...prev[id],
              waiting: true,
              feed: (prev[id].feed || []).concat([
                { kind: "ask", text: "Need from you: " + String(fld.label).toLowerCase() },
              ]),
            },
          }));
          return;
        }
        const blank = val === "" || val === undefined || val === null;
        setFill((prev) => ({
          ...prev,
          [id]: {
            ...prev[id],
            progress: prev[id].progress + 1,
            feed: (prev[id].feed || []).concat([
              {
                kind: "fill",
                text: (blank ? "Left blank: " : "Filled ") + String(fld.label).toLowerCase(),
                sub: blank ? "nothing to fill from" : String(val),
              },
            ]),
          },
        }));
        step(id);
      }, STEP_MS);
    },
    [later],
  );

  const startFill = useCallback(
    async (id) => {
      if (stateRef.current.fill[id]) return;
      setFill((prev) =>
        prev[id]
          ? prev
          : {
              ...prev,
              [id]: {
                progress: 0,
                answers: {},
                feed: [],
                waiting: false,
                done: false,
                sections: null,
                spec: null,
              },
            },
      );
      const token = runRef.current;
      try {
        const spec = await formSpec(id, stateRef.current.facts, {});
        if (token !== runRef.current) return;
        setFill((prev) => ({
          ...prev,
          [id]: { ...prev[id], spec, sections: spec.sections || [] },
        }));
        stepFill(id);
      } catch (err) {
        if (token !== runRef.current) return;
        setFill((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
        fail(err);
      }
    },
    [stepFill, fail],
  );

  const openFill = useCallback(
    (id) => {
      setStage("work");
      setOpenForm(id);
      setInput("");
      setEditing(null);
      startFill(id);
    },
    [startFill],
  );

  /** A shared fact written on one form lands on every other loaded form. */
  const propagateShared = useCallback((key, value) => {
    if (SHARED_KEYS.indexOf(key) === -1) return;
    setFacts((prev) => ({ ...prev, [key]: value }));
    setFill((prev) => {
      const next = {};
      for (const id of Object.keys(prev)) {
        const st = prev[id];
        if (!st.sections) {
          next[id] = st;
          continue;
        }
        next[id] = {
          ...st,
          sections: st.sections.map((sec) => ({
            ...sec,
            fields: (sec.fields || []).map((f) =>
              f.key === key && st.answers[key] === undefined ? { ...f, value } : f,
            ),
          })),
        };
      }
      return next;
    });
  }, []);

  const answerAsk = useCallback(
    (id, text) => {
      const st = stateRef.current.fill[id];
      if (!st || !st.sections) return;
      const flat = flatten(st.sections);
      const fld = flat[st.progress];
      if (!fld) return;
      setFill((prev) => ({
        ...prev,
        [id]: {
          ...prev[id],
          waiting: false,
          answers: { ...prev[id].answers, [fld.key]: text },
        },
      }));
      propagateShared(fld.key, text);
      setInput("");
      stepFill(id);
    },
    [propagateShared, stepFill],
  );

  const editField = useCallback(
    (key, value) => {
      const id = stateRef.current.openForm;
      if (!id) return;
      setFill((prev) => ({
        ...prev,
        [id]: { ...prev[id], answers: { ...prev[id].answers, [key]: value } },
      }));
      propagateShared(key, value);
    },
    [propagateShared],
  );

  // ---------- chat ----------
  const firstMessage = useCallback(
    async (text) => {
      pushChat([{ kind: "user", text }]);
      setInput("");
      setThinking(true);
      setThinkingText("Reading your description");
      const token = runRef.current;
      let res;
      try {
        res = await extract(text);
      } catch (err) {
        if (token !== runRef.current) return;
        setThinking(false);
        fail(err);
        return;
      }
      if (token !== runRef.current) return;
      const found = (res.found || []).map((x, i) => ({
        text: typeof x === "string" ? x : x.label,
        delay: i * 110 + "ms",
        bg: "#1e4b9a",
      }));
      const merged = { ...stateRef.current.facts, ...(res.facts || {}) };
      setFacts(merged);
      setThinking(false);
      if (found.length) pushChat([{ kind: "actions", actions: found }]);
      await wait(500 + found.length * 110);
      if (token !== runRef.current) return;
      const intro =
        found.length === 0
          ? "I could not pull much from that. Let me ask directly."
          : found.length >= 6
            ? "Got most of it. A few more things."
            : "Got " + found.length + " things. A few more.";
      if (res.next_question) {
        pushChat([{ kind: "agent", text: intro }]);
        askKey(res.next_question, merged);
      } else {
        askNext(merged);
      }
    },
    [pushChat, wait, askKey, askNext, fail],
  );

  const answerQuestion = useCallback(
    (text) => {
      const q = (stateRef.current.questions || []).find((x) => x.key === currentQ);
      if (!q) return;
      const next = { ...stateRef.current.facts };
      if (q.key === "date") {
        const d = parseAnyDate(text);
        if (!d) {
          pushChat([
            { kind: "user", text },
            {
              kind: "agent",
              text: 'I could not read that as a date. Try "Oct 24" or "in 6 weeks".',
            },
          ]);
          setInput("");
          return;
        }
        next.date = toISO(d);
      } else if (q.type === "free" || q.free) {
        const fills = q.fills || [];
        if (q.key === "organizer" || fills.indexOf("email") !== -1) {
          Object.assign(next, parseOrganizer(text));
        } else {
          next[fills.length === 1 ? fills[0] : q.key] = text.trim();
        }
      } else {
        const hit = matchOption(q, text);
        if (!hit) {
          pushChat([
            { kind: "user", text },
            { kind: "agent", text: "I did not catch that. " + q.prompt },
          ]);
          setInput("");
          return;
        }
        next[q.key] = hit.value;
      }
      pushChat([{ kind: "user", text }]);
      setInput("");
      askNext(next);
    },
    [currentQ, pushChat, askNext],
  );

  const send = useCallback(
    (override) => {
      const s = stateRef.current;
      const text = (override !== undefined ? override : input).trim();
      if (s.stage === "work") {
        if (!text || !s.openForm) return;
        const st = s.fill[s.openForm];
        if (st && st.waiting) answerAsk(s.openForm, text);
        return;
      }
      if (s.stage !== "chat" || !text || thinking) return;
      if (!currentQ) firstMessage(text);
      else answerQuestion(text);
    },
    [input, thinking, currentQ, answerAsk, firstMessage, answerQuestion],
  );

  const pickChip = useCallback(
    (q, o) => {
      const next = { ...stateRef.current.facts };
      if (q.key === "date") {
        if (typeof o.value === "number") next.date = toISO(addDays(new Date(), o.value));
        else {
          const d = fromISO(o.value) || parseAnyDate(String(o.value));
          if (d) next.date = toISO(d);
        }
      } else {
        next[q.key] = o.value;
      }
      pushChat([{ kind: "user", text: capitalize(o.label) }]);
      askNext(next);
    },
    [pushChat, askNext],
  );

  const reask = useCallback(
    (key) => {
      if (stage !== "chat" || thinking) return;
      const q = (stateRef.current.questions || []).find((x) => x.key === key);
      if (!q) return;
      const next = { ...stateRef.current.facts };
      delete next[key];
      setFacts(next);
      setCurrentQ(key);
      pushChat([
        { kind: "agent", text: "Changing " + String(q.label).toLowerCase() + ". " + q.prompt },
      ]);
    },
    [stage, thinking, pushChat],
  );

  // ---------- pen ----------
  const penXY = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    return [Math.round(e.clientX - r.left), Math.round(e.clientY - r.top)];
  };

  const penDown = useCallback(
    (e) => {
      if (!pen) return;
      curRef.current = [penXY(e)];
      drawingRef.current = true;
      setCurStroke(curRef.current.slice());
    },
    [pen],
  );

  const penMove = useCallback((e) => {
    if (!drawingRef.current) return;
    const p = penXY(e);
    const last = curRef.current[curRef.current.length - 1];
    if (Math.abs(p[0] - last[0]) + Math.abs(p[1] - last[1]) < 2) return;
    curRef.current.push(p);
    setCurStroke(curRef.current.slice());
  }, []);

  const penUp = useCallback(() => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    const id = stateRef.current.openForm;
    if (curRef.current.length > 1 && id) {
      const stroke = curRef.current.slice();
      setInk((prev) => ({ ...prev, [id]: (prev[id] || []).concat([stroke]) }));
    }
    setCurStroke([]);
    curRef.current = [];
  }, []);

  const clearInk = useCallback(() => {
    const id = stateRef.current.openForm;
    if (!id) return;
    setInk((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setCurStroke([]);
  }, []);

  const reset = useCallback(() => {
    runRef.current += 1;
    clearTimers();
    setStage("chat");
    setFacts({});
    setCurrentQ(null);
    setThinking(false);
    setThinkingText("");
    setChat(OPENING_CHAT);
    setInput("");
    setDetermination(null);
    setOpenForm(null);
    setFill({});
    setSent({});
    setToast({ msg: "", n: 0 });
    setShowNotNeeded(false);
    setPen(false);
    setInk({});
    setCurStroke([]);
    setEditing(null);
  }, [clearTimers]);

  // ---------- derived ----------
  const inChat = stage === "chat";
  const inSummary = stage === "summary";
  const inWork = stage === "work";
  const eventDate = useMemo(() => fromISO(facts.date), [facts.date]);
  const current = useMemo(
    () => (currentQ ? questions.find((q) => q.key === currentQ) : null),
    [currentQ, questions],
  );

  const ledger = useMemo(
    () =>
      questions
        .filter((q) => onlyIfSatisfied(q, facts) || onlyIfUndecided(q, facts))
        .map((q) => {
          let value = "";
          if (q.key === "date") {
            value = eventDate ? fmtDate(eventDate) + " (" + daysOut(eventDate) + " days)" : "";
          } else if (q.key === "organizer") {
            value = facts.organizer
              ? facts.organizer + (facts.email ? ", " + facts.email : "")
              : "";
          } else if (q.key === "attendance" && facts.attendance !== undefined) {
            value = "About " + Number(facts.attendance).toLocaleString();
          } else if (q.type === "free" || q.free) {
            value = facts[q.key] || "";
          } else if (facts[q.key] !== undefined) {
            const o = (q.options || []).find((x) => x.value === facts[q.key]);
            value = o ? capitalize(o.label) : String(facts[q.key]);
          }
          const known = value !== "";
          const active = currentQ === q.key && inChat;
          return {
            key: q.key,
            label: q.label,
            value,
            known,
            active,
            labelFg: active ? "#1e4b9a" : known ? "#667085" : "#c0c6d0",
            onPick: () => reask(q.key),
          };
        }),
    [questions, facts, eventDate, currentQ, inChat, reask],
  );

  const knownCount = ledger.filter((l) => l.known).length;

  const chips = useMemo(
    () =>
      current && current.options && current.options.length && !thinking
        ? current.options.map((o) => ({ label: o.label, pick: () => pickChip(current, o) }))
        : [],
    [current, thinking, pickChip],
  );

  const chatView = useMemo(
    () =>
      chat.map((m) => ({
        isAgent: m.kind === "agent",
        isUser: m.kind === "user",
        isActions: m.kind === "actions",
        text: m.text || "",
        actions: m.actions || [],
        align: m.kind === "user" ? "flex-end" : "flex-start",
        size: m.lead ? "34px" : "17px",
        weight: m.lead ? 700 : 400,
        tracking: m.lead ? "-0.7px" : "0",
        lh: m.lead ? "1.15" : "1.55",
        fg: m.lead ? "#101828" : "#344054",
      })),
    [chat],
  );

  const permits = useMemo(
    () => (determination && determination.permits) || [],
    [determination],
  );
  const req = useMemo(
    () => permits.filter((p) => p.status === "required" || p.status === "likely"),
    [permits],
  );
  const notNeededPermits = useMemo(
    () => permits.filter((p) => p.status === "not_needed" || p.status === "no"),
    [permits],
  );

  const summaryRows = useMemo(
    () =>
      req.map((p, i) => {
        const due = permitDue(p, facts);
        const late = isPast(due);
        return {
          id: p.id,
          name: p.name,
          agency: p.agency,
          purpose:
            (p.purpose || "") +
            (p.status === "likely" ? " Likely, not certain, for your event." : ""),
          due: due
            ? late
              ? "Was due " + fmtDate(due) + ", " + p.lead_days + " days lead"
              : fmtDate(due) + ", " + p.lead_days + " days before the event"
            : "",
          dueFg: late ? "#b42318" : "#101828",
          fee: p.fee_basis || shortFee(p),
          limits: (p.limits || []).map((l) => (typeof l === "string" ? l : l.text)).join(" "),
          url: p.self_serve_url,
          fillLabel: sent[p.id] ? "Sent" : fill[p.id] ? "Open" : "Fill for me",
          linkLabel: "Do it myself on the city site",
          delay: 320 + i * 110 + "ms",
          onFill: () => openFill(p.id),
        };
      }),
    [req, facts, sent, fill, openFill],
  );

  const fees = (determination && determination.fees) || {};
  const feeFixed = fmtMoney(fees.fixed_cents || 0);
  const feeVariable = fees.per_vendor_cents
    ? "Includes " +
      fmtMoney(fees.per_vendor_cents) +
      " per food vendor, one assumed. Fee waivers exist for nonprofits."
    : "Fee waivers exist for nonprofits and free public events.";

  const rawSiteCheck = (determination && determination.site_check) || null;
  const siteCheck = {
    title: rawSiteCheck ? rawSiteCheck.title : "",
    text: rawSiteCheck ? rawSiteCheck.text : "",
    source: sourceLine(rawSiteCheck),
  };

  const firstDeadline = (determination && determination.first_deadline) || null;
  const driver = firstDeadline ? permits.find((p) => p.id === firstDeadline.permit_id) : null;
  const firstDate = firstDeadline ? fromISO(firstDeadline.date) : null;
  const firstLeft = firstDeadline
    ? typeof firstDeadline.days_from_now === "number"
      ? firstDeadline.days_from_now
      : daysOut(firstDate)
    : null;

  const summaryHead =
    req.length === 0
      ? "No permits needed."
      : req.length +
        " permit" +
        (req.length === 1 ? "" : "s") +
        " for " +
        fmtLong(eventDate || new Date()) +
        ".";

  const summarySub =
    firstDate && driver
      ? firstLeft < 0
        ? "The first deadline has already passed: " +
          String(driver.name).toLowerCase() +
          " needs " +
          driver.lead_days +
          " days. Move the date and check again."
        : "First deadline is " +
          fmtDate(firstDate) +
          ", " +
          firstLeft +
          " days from now, for the " +
          String(driver.name).toLowerCase() +
          ". Fill each one here, or take it to the city site yourself."
      : "";

  const notNeeded = useMemo(
    () =>
      notNeededPermits.map((p, i) => ({
        id: p.id,
        name: p.name,
        why: p.why,
        delay: i * 40 + "ms",
      })),
    [notNeededPermits],
  );

  const needed = useMemo(
    () =>
      req.map((p) => {
        const st = fill[p.id];
        const total = st && st.sections ? flatten(st.sections).length : 0;
        let pill, pillBg, pillFg;
        let pillClass = "";
        if (sent[p.id]) {
          pill = "Sent";
          pillBg = "#101828";
          pillFg = "#ffffff";
        } else if (!st) {
          pill = "Not started";
          pillBg = "#f2f4f7";
          pillFg = "#667085";
        } else if (st.waiting) {
          pill = "Needs you";
          pillBg = "#fdf1d6";
          pillFg = "#9a6b0a";
        } else if (!st.sections || st.progress < total) {
          pill = "Filling";
          pillBg = "#eaf0f9";
          pillFg = "#1e4b9a";
          pillClass = "filling";
        } else {
          pill = "Ready";
          pillBg = "#e2f0e6";
          pillFg = "#1f6b3f";
        }
        return {
          id: p.id,
          name: p.name,
          agency: p.agency,
          pill,
          pillBg,
          pillFg,
          pillClass,
          bg: openForm === p.id ? "#eef2f8" : "transparent",
          onOpen: () => {
            setOpenForm(p.id);
            setInput("");
            setEditing(null);
            startFill(p.id);
          },
        };
      }),
    [req, fill, sent, openForm, startFill],
  );

  const openPermit = openForm ? permits.find((p) => p.id === openForm) : null;
  const openState = openForm ? fill[openForm] : null;

  const download = useCallback(async () => {
    const id = openForm;
    const p = openPermit;
    const st = openState;
    if (!id || !p || !st) return;
    const title = (st.spec && st.spec.form_title) || p.name;
    const fname = title.replace(/[^a-z0-9]+/gi, "-") + ".pdf";
    const strokes = ink[id] || [];
    try {
      const blob = await renderPdf(id, facts, st.answers, inkToPdfUnits(strokes, PAPER_WIDTH));
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fname;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toastMsg("Saved " + fname);
    } catch (err) {
      if (err && err.code === "no_pdf_template") {
        const values = err.pasteValues || {};
        const n = Object.keys(values).length;
        try {
          await navigator.clipboard.writeText(JSON.stringify(values, null, 2));
        } catch {
          /* clipboard blocked; the toast still tells them what happened */
        }
        toastMsg("No PDF for this one yet. Copied " + n + " values for the city form.");
      } else {
        fail(err);
      }
    }
  }, [openForm, openPermit, openState, facts, ink, toastMsg, fail]);

  const doMarkSent = useCallback(async () => {
    const id = openForm;
    const p = openPermit;
    if (!id || !p) return;
    try {
      const res = await markSent(id);
      const when = fmtDate(res && res.sent_at ? new Date(res.sent_at) : new Date());
      setSent((prev) => ({ ...prev, [id]: when }));
      setFill((prev) => ({
        ...prev,
        [id]: {
          ...prev[id],
          feed: (prev[id].feed || []).concat([
            { kind: "sent", text: "Sent to " + p.agency, sub: p.channel },
          ]),
        },
      }));
      toastMsg(p.name + " marked as sent");
    } catch (err) {
      fail(err);
    }
  }, [openForm, openPermit, toastMsg, fail]);

  const form = useMemo(() => {
    const empty = {
      title: "",
      sub: "",
      sections: [],
      paperAgency: "",
      paperTitle: "",
      paperRef: "",
      channel: "",
      youAdd: "",
      onDownload: () => {},
      onMarkSent: () => {},
      downloadDisabled: true,
      sentDisabled: true,
      sentLabel: "Mark as sent",
    };
    if (!openPermit) return empty;
    const st = openState;
    const spec = st && st.spec;
    let idx = 0;
    const sections = ((st && st.sections) || []).map((sec) => ({
      title: sec.title,
      fields: (sec.fields || []).map((fl) => {
        const i = idx++;
        const answered = st && st.answers[fl.key] !== undefined;
        const value = answered ? st.answers[fl.key] : (fl.value ?? "");
        const filled = !!st && i < st.progress && value !== "";
        const waiting = !!st && st.waiting && i === st.progress;
        const isEditing = editing === fl.key && filled;
        const editable = filled && !pen && fl.editable !== false;
        return {
          key: fl.key,
          label: fl.label,
          value,
          span: fl.span || 1,
          waiting,
          editing: isEditing,
          showValue: filled && !isEditing,
          cls: editable ? "fld" : "",
          cursor: editable ? "text" : "default",
          line: waiting ? "#e0c072" : isEditing ? "#1e4b9a" : filled ? "#101828" : "#d0d5dd",
          bg: waiting ? "#fdf8ea" : isEditing ? "#eaf0f9" : filled ? "#f3f6fb" : "transparent",
          onStartEdit: () => {
            if (editable && !pen) setEditing(fl.key);
          },
          onEdit: (e) => editField(fl.key, e.target.value),
          onEditKey: (e) => {
            if (e.key === "Enter" || e.key === "Escape") setEditing(null);
          },
        };
      }),
    }));
    const total = sections.reduce((a, sec) => a + sec.fields.length, 0);
    const done = !!st && !!st.sections && st.progress >= total;
    const due = permitDue(openPermit, facts);
    return {
      title: openPermit.name,
      sub:
        openPermit.agency +
        ". Due " +
        (due ? fmtDate(due) : "") +
        ". " +
        shortFee(openPermit) +
        ".",
      sections,
      paperAgency: (spec && spec.agency_full) || openPermit.agency,
      paperTitle: (spec && spec.form_title) || openPermit.name,
      paperRef: (spec && spec.reference) || "",
      channel: openPermit.channel || "",
      youAdd: youAddLine(openPermit),
      downloadDisabled: !done,
      onDownload: download,
      sentDisabled: !done || !!sent[openPermit.id],
      sentLabel: sent[openPermit.id] ? "Sent " + sent[openPermit.id] : "Mark as sent",
      onMarkSent: doMarkSent,
    };
  }, [openPermit, openState, editing, pen, facts, sent, editField, download, doMarkSent]);

  const feed = useMemo(
    () =>
      ((openState && openState.feed) || []).map((e) => ({
        text: e.text,
        sub: e.sub || "",
        hasSub: !!e.sub,
        check: e.kind !== "ask",
        bg:
          e.kind === "ask"
            ? "#c9a54a"
            : e.kind === "done"
              ? "#1f6b3f"
              : e.kind === "sent"
                ? "#101828"
                : "#1e4b9a",
        fg: e.kind === "ask" ? "#9a6b0a" : "#101828",
        weight: e.kind === "ask" || e.kind === "done" || e.kind === "sent" ? 600 : 400,
      })),
    [openState],
  );

  const formTotal = form.sections.reduce((a, sec) => a + sec.fields.length, 0);
  const formDone = !!openState && !!openState.sections && openState.progress >= formTotal;
  const hasAsk = !!openState && !!openState.waiting;
  const ask = hasAsk
    ? askOf(flatten(openState.sections)[openState.progress]) || {
        prompt: "",
        hint: "",
        placeholder: "",
      }
    : { prompt: "", hint: "", placeholder: "" };
  const feedWorking = !!openState && !openState.waiting && !formDone;

  const inkStrokes = useMemo(() => {
    const saved = openForm ? ink[openForm] || [] : [];
    const all = curStroke.length > 1 ? saved.concat([curStroke]) : saved;
    return all.map((pts) => pts.map((p, i) => (i === 0 ? "M" : "L") + p[0] + " " + p[1]).join(" "));
  }, [openForm, ink, curStroke]);

  const signed = openForm ? (ink[openForm] || []).length > 0 : false;

  const placeholder = current
    ? current.placeholder || "Type your answer"
    : "Block party on the 400 block of Bocana St, Oct 24, noon to 6, about 80 people, a band, a taco stand";

  const onInput = (e) => setInput(e.target.value);
  const onKey = (e) => {
    if (e.key === "Enter") send();
  };

  return (
    <div
      style={{
        width: "100%",
        maxWidth: "none",
        minHeight: "100dvh",
        height: "100dvh",
        position: "relative",
        background: "#f5f7fa",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          height: 52,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 40px",
          background: "#12305e",
          color: "#ffffff",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 14, letterSpacing: ".02em" }}>
            CITY AND COUNTY OF SAN FRANCISCO
          </div>
          <div style={{ width: 1, height: 16, background: "rgba(255,255,255,.28)" }} />
          <div style={{ fontSize: 14, color: "rgba(255,255,255,.85)" }}>Permit Navigator</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 22, fontSize: 14 }}>
          {inWork && (
            <button
              className="btn link"
              onClick={() => {
                setStage("summary");
                setOpenForm(null);
              }}
              style={{
                fontSize: 14,
                color: "rgba(255,255,255,.85)",
                background: "transparent",
                border: 0,
                padding: 0,
              }}
            >
              Back to summary
            </button>
          )}
          <button
            className="btn link"
            onClick={reset}
            style={{
              fontSize: 14,
              color: "rgba(255,255,255,.6)",
              background: "transparent",
              border: 0,
              padding: 0,
            }}
          >
            Start over
          </button>
        </div>
      </div>
      <div style={{ height: 3, flexShrink: 0, background: "#c9a54a" }} />

      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        {inChat && (
          <div style={{ flex: 1, display: "flex", minWidth: 0 }}>
            <Intake
              chat={chatView}
              thinking={thinking}
              thinkingText={thinkingText}
              chips={chips}
              input={input}
              onInput={onInput}
              onKey={onKey}
              onSend={() => send()}
              placeholder={placeholder}
              showExample={inChat && !currentQ && chat.length <= 2}
              onExample={() => {
                setInput(EXAMPLE);
                send(EXAMPLE);
              }}
            />
            <Ledger rows={ledger} meta={knownCount + " of " + ledger.length} />
          </div>
        )}

        {inSummary && (
          <Summary
            eventTitle={facts.event_name || facts.eventName || ""}
            head={summaryHead}
            sub={summarySub}
            siteCheck={siteCheck}
            feeFixed={feeFixed}
            feeVariable={feeVariable}
            rows={summaryRows}
            tailDelay={320 + req.length * 110 + 80 + "ms"}
            notNeededLine={
              notNeeded.length +
              " other permits checked and not needed" +
              (showNotNeeded ? ". Hide" : ". Show")
            }
            showNotNeeded={showNotNeeded}
            onToggleNotNeeded={() => setShowNotNeeded((v) => !v)}
            notNeeded={notNeeded}
            onFillAll={() => {
              if (req[0]) openFill(req[0].id);
            }}
          />
        )}

        {inWork && (
          <Filler
            needed={needed}
            form={form}
            pen={pen}
            onTogglePen={() => {
              setPen((v) => !v);
              setEditing(null);
            }}
            penLabel={pen ? "Pen on" : "Sign and mark up"}
            penBg={pen ? "#12305e" : "#ffffff"}
            penFg={pen ? "#ffffff" : "#344054"}
            penBorder={pen ? "#12305e" : "#d0d5dd"}
            hasInk={inkStrokes.length > 0}
            onClearInk={clearInk}
            strokes={inkStrokes}
            penHandlers={{ down: penDown, move: penMove, up: penUp }}
            signHint={
              signed
                ? "Signed by hand."
                : pen
                  ? "Draw your signature on the line above."
                  : "Turn on the pen to sign this form."
            }
            signHintFg={signed ? "#1f6b3f" : "#98a2b3"}
            onStopEdit={() => setEditing(null)}
            feedTitle={openPermit ? "Filling this form" : ""}
            feedSub={
              openPermit ? "From your event details. Anything missing gets asked here." : ""
            }
            feed={feed}
            feedWorking={feedWorking}
            feedDone={formDone}
            hasAsk={hasAsk}
            ask={ask}
            input={input}
            onInput={onInput}
            onKey={onKey}
            onSend={() => send()}
          />
        )}
      </div>

      {!!toast.msg && (
        <div
          className="a-toast"
          style={{
            position: "absolute",
            left: "50%",
            bottom: 28,
            transform: "translateX(-50%)",
            background: "#101828",
            color: "#ffffff",
            fontSize: 14,
            fontWeight: 500,
            padding: "11px 16px",
            borderRadius: 10,
            boxShadow: "0 8px 24px rgba(16,24,40,.18)",
          }}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}
