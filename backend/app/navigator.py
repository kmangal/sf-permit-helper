"""Drive the rules engine from a free-text description, asking jev first.

    nav = Navigator(OpenRouterJevClient())
    session = Session(description="A block party on our street with a DJ")
    turn = await nav.advance(session)
    while turn["kind"] == "question":
        turn = await nav.reply(session, input(turn["prompt"]))

Each engine question becomes a jev choice question over the fact's options
plus "unknown". jev's most probable label is taken as the answer; when that
label is "unknown" (or jev fails), the question goes to the user. A reply is
accepted if it is an option label, parses as the fact's type, or jev can map
it to an option;
after MAX_ATTEMPTS unusable replies the session is aborted.

While a question waits, the user may ask about it instead of answering.
`clarify` streams an LLM's reply from the session so far and the rules
behind the question; the question stays pending and no fact changes.

Numeric facts are offered to jev as ranges cut at the thresholds the rules
compare against, so every value in a range decides the rules the same way.
"""

import json
import logging
from collections.abc import AsyncIterator
from dataclasses import dataclass, field
from datetime import date
from typing import Literal, Protocol

from typesafe_sdk import Choice, JSONContent

from .engine import engine as _engine
from .engine import load_ruleset
from .engine.logic import Atom, compare, tests_in
from .engine.model import Fact, RuleSet
from .prompts import PromptName, load

logger = logging.getLogger("permit-api")

MAX_ATTEMPTS = 3
UNKNOWN = "unknown"
UNKNOWN_CRITERION = (
    "The information given does not say, or does not say clearly enough to pick one "
    "of the other options with confidence."
)
ABORT_MESSAGE = "Sorry, we cannot help you."


class Jev(Protocol):
    async def choose(self, state: JSONContent, name: str, question: Choice) -> dict[str, float]:
        """Probability of each label of `question`."""
        ...


class Llm(Protocol):
    def stream(self, prompt: str, *, system: str | None = None) -> AsyncIterator[str]:
        """The response text as it arrives."""
        ...


@dataclass(frozen=True)
class Option:
    label: str
    value: object


@dataclass
class Session:
    description: str
    facts: dict = field(default_factory=dict)
    answered_by: dict[str, Literal["jev", "user"]] = field(default_factory=dict)
    # How each answer reads to a person: jev's option label, or the user's words.
    labels: dict[str, str] = field(default_factory=dict)
    # What the user typed, as {"question", "answer"}; jev sees it on later questions.
    transcript: list[dict] = field(default_factory=list)
    # The engine question waiting on the user, and how many replies it has rejected.
    pending: dict | None = None
    attempts: int = 0
    # Clarifying questions about pending questions, as {"about", "question", "answer"}.
    clarifications: list[dict] = field(default_factory=list)
    done: bool = False


class Navigator:
    def __init__(self, jev: Jev, rules: RuleSet | None = None, as_of: date | None = None):
        self.jev = jev
        self.rules = rules or load_ruleset()
        self.as_of = as_of
        self._options: dict[str, list[Option]] = {}

    def options(self, fact: str) -> list[Option]:
        if fact not in self._options:
            self._options[fact] = options_for(self.rules, fact)
        return self._options[fact]

    async def advance(self, session: Session) -> dict:
        """Let jev answer until a question needs the user or the walk ends."""
        while True:
            step = _engine.step(self.rules, session.facts, self.as_of)
            if step["kind"] == "terminal":
                session.done = True
                return self._terminal(session, step)
            fact = step["fact"]
            picked = await self._pick(fact, self._state(session), step["prompt"])
            if picked is None:
                session.pending, session.attempts = step, 0
                return self._question(session, step)
            self._set(session, fact, picked.value, "jev", picked.label)

    async def reply(self, session: Session, text: str) -> dict:
        """Take the user's answer to the pending question."""
        if session.done or session.pending is None:
            raise ValueError("no question is waiting for an answer")
        step = session.pending
        fact = step["fact"]
        # An option label (a tapped chip) is taken as is, then the fact's own type.
        wanted = text.strip().lower()
        picked = next((o for o in self.options(fact) if o.label.lower() == wanted), None)
        if picked is None and (value := parse(self.rules.facts[fact], text)) is not None:
            picked = Option(text.strip(), value)
        if picked is None:
            picked = await self._pick(
                fact,
                {"question": step["prompt"], "response": text},
                f"{step['prompt']} Answer from the response only.",
            )
        if picked is None:
            session.attempts += 1
            if session.attempts >= MAX_ATTEMPTS:
                session.done = True
                return {"kind": "aborted", "message": ABORT_MESSAGE, "fact": fact}
            return self._question(session, step, rejected=text, attempts=session.attempts)
        session.transcript.append({"question": step["prompt"], "answer": text})
        session.pending = None
        self._set(session, fact, picked.value, "user", picked.label)
        return await self.advance(session)

    async def clarify(self, llm: Llm, session: Session, question: str) -> AsyncIterator[str]:
        """Stream an answer to the user's question about the pending question."""
        if session.done or session.pending is None:
            raise ValueError("no question is waiting for an answer")
        step = session.pending
        prompt = load(PromptName.CLARIFY)
        context = json.dumps(self._clarify_context(session, step), indent=2, default=str)
        user = prompt.render(context=context, question=question)
        parts: list[str] = []
        async for text in llm.stream(user, system=prompt.system):
            parts.append(text)
            yield text
        session.clarifications.append(
            {"about": step["prompt"], "question": question, "answer": "".join(parts)}
        )

    def _clarify_context(self, session: Session, step: dict) -> dict:
        by_id = {r.id: r for r in self.rules.rules}
        rules = [by_id[i] for i in step["because"] if i in by_id]
        return {
            "event_description": session.description,
            "settled": [
                {"question": k["prompt"], "answer": k["label"], "by": k["by"]}
                for k in self._known(session)
            ],
            "pending_question": {
                "question": step["prompt"],
                "choices": [o.label for o in self.options(step["fact"])],
            },
            "bears_on": [
                {"title": r.title, "agency": r.agency, "notes": r.notes, "limits": r.limits}
                for r in rules
            ],
            "earlier_clarifications": session.clarifications,
        }

    async def _pick(self, fact: str, state: JSONContent, instructions: str) -> Option | None:
        """jev's most probable option, or None for unknown or failure."""
        options = self.options(fact)
        if not options:
            return None
        criteria: dict[str, JSONContent | None] = {o.label: None for o in options}
        criteria[UNKNOWN] = UNKNOWN_CRITERION
        try:
            probs = await self.jev.choose(
                state, fact, Choice(instructions=instructions, criteria=criteria)
            )
        except Exception as exc:  # no key, timeout, network, bad response
            logger.warning("jev failed on %s (%s: %s)", fact, type(exc).__name__, exc)
            return None
        label = max(criteria, key=lambda k: probs.get(k, 0.0))
        logger.info("jev %s -> %s (p=%.2f)", fact, label, probs.get(label, 0.0))
        if label == UNKNOWN:
            return None
        return next(o for o in options if o.label == label)

    def _state(self, session: Session) -> JSONContent:
        state: dict = {"event_description": session.description}
        if session.transcript:
            state["organizer_answers"] = session.transcript
        return state

    def _set(
        self, session: Session, fact: str, value: object, by: Literal["jev", "user"], label: str
    ):
        session.facts = _engine.answer(self.rules, session.facts, fact, value)
        session.answered_by[fact] = by
        session.labels[fact] = label

    def _known(self, session: Session) -> list[dict]:
        """What has been settled so far, in the order it was settled."""
        return [
            {
                "fact": f,
                "prompt": self.rules.facts[f].question,
                "value": session.facts[f],
                "label": session.labels.get(f, str(session.facts[f])),
                "by": by,
            }
            for f, by in session.answered_by.items()
        ]

    def _question(
        self, session: Session, step: dict, rejected: str | None = None, attempts: int = 0
    ) -> dict:
        out = {
            **step,
            "options": [{"label": o.label, "value": o.value} for o in self.options(step["fact"])],
            "attempts_left": MAX_ATTEMPTS - attempts,
            "known": self._known(session),
        }
        if rejected is not None:
            out["rejected"] = rejected
        return out

    def _terminal(self, session: Session, step: dict) -> dict:
        """The engine's result, with citations resolved and the permits ruled out."""
        cite = self.rules.sources
        rules = [
            {**r, "sources": [{"id": s, **cite[s].model_dump()} for s in r["sources"]]}
            for r in step["rules"]
        ]
        verdicts = _engine.evaluate_all(self.rules, session.facts, self.as_of)
        not_needed = [
            {"id": r.id, "kind": r.kind, "title": r.title, "agency": r.agency}
            for r in self.rules.rules
            if r.kind in ("permit", "license") and verdicts.get(r.id) is False
        ]
        return {
            **step,
            "rules": rules,
            "not_needed": not_needed,
            "facts": session.facts,
            "answered_by": session.answered_by,
            "known": self._known(session),
        }


def parse(spec: Fact, text: str) -> object | None:
    """The reply as the fact's type, or None if it doesn't read as one."""
    candidates = [text]
    if spec.type == "enum":
        candidates.append(text.strip().lower().replace(" ", "_"))
    for c in candidates:
        try:
            return _engine.coerce(spec, c)
        except ValueError:
            pass
    return None


def options_for(rules: RuleSet, fact: str) -> list[Option]:
    """What jev picks from for `fact` (the user may also type a value directly)."""
    spec = rules.facts[fact]
    match spec.type:
        case "bool":
            return [Option("yes", True), Option("no", False)]
        case "enum":
            return [Option(v, v) for v in spec.values or ()]
    return numeric_options(spec.type == "int", atoms_for(rules, fact))


def atoms_for(rules: RuleSet, fact: str) -> list[Atom]:
    """Every test of `fact` in the rules file."""
    conds = [*rules.macros.values()]
    for r in rules.rules:
        if r.when is not None:
            conds.append(r.when)
        conds.extend(ov.when for ov in (r.lead_time.overrides if r.lead_time else ()))
    return [t for c in conds for t in tests_in(c) if isinstance(t, Atom) and t.fact == fact]


def numeric_options(integer: bool, atoms: list[Atom]) -> list[Option]:
    """Ranges between the thresholds in `atoms`, each with a representative value.

    A cut (t, closed) splits values at t: closed puts t itself in the range
    below (from gt/lte), open puts it in the range above (from gte/lt). For
    integers every cut is made open by shifting gt/lte thresholds up by one.
    """
    cuts: set[tuple[float, bool]] = set()
    for a in atoms:
        for t in a.value if a.op in ("in", "not_in") else (a.value,):
            if a.op in ("gt", "lte"):
                cuts.add((t + 1, False) if integer else (t, True))
            elif a.op in ("gte", "lt"):
                cuts.add((t, False))
            else:  # eq, ne, in, not_in: t alone is a range
                cuts |= {(t, False), (t + 1, False)} if integer else {(t, False), (t, True)}
    ordered = sorted(cuts)
    if not ordered:
        return []
    bounds = [None, *ordered, None]
    make = _int_range if integer else _number_range
    return [make(lo, hi) for lo, hi in zip(bounds, bounds[1:], strict=False)]


def _fmt(x: float) -> str:
    return f"{x:g}"


def _int_range(lo, hi) -> Option:
    if lo is None:
        label = "0" if hi[0] == 1 else f"fewer than {_fmt(hi[0])}"
        return Option(label, hi[0] - 1)
    if hi is None:
        return Option(f"{_fmt(lo[0])} or more", lo[0])
    last = hi[0] - 1
    label = _fmt(lo[0]) if last == lo[0] else f"{_fmt(lo[0])} to {_fmt(last)}"
    return Option(label, lo[0])


def _number_range(lo, hi) -> Option:
    above = {True: "more than", False: "at least"}
    below = {True: "up to", False: "under"}
    if lo is None:
        t, closed = hi
        return Option(f"{below[closed]} {_fmt(t)}", t if closed else (t / 2 if t > 0 else t - 1))
    if hi is None:
        t, closed = lo
        return Option(f"{above[closed]} {_fmt(t)}", t + 1 if closed else t)
    if lo[0] == hi[0]:
        return Option(f"exactly {_fmt(lo[0])}", lo[0])
    return Option(
        f"{above[lo[1]]} {_fmt(lo[0])} and {below[hi[1]]} {_fmt(hi[0])}", (lo[0] + hi[0]) / 2
    )


def signature(atoms: list[Atom], value: object) -> tuple[bool, ...]:
    """How every atom evaluates for `value`; equal signatures decide rules alike."""
    return tuple(compare(a.op, value, a.value) for a in atoms)
