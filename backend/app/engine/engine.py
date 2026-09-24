"""Walk an event from an empty fact set to a terminal result.

The state is a plain dict of fact values. `step(facts)` evaluates every rule
against it and returns either the next question or a terminal result;
`answer(facts, fact, raw)` returns a new dict with one more fact filled in.

How the next question is chosen: each rule's `when` is simplified against
the known facts. For every rule still undetermined, the leftmost open test
of its residual is a candidate (authors write gating tests first). Among
candidates, the fact declared earliest in the file's `facts:` section wins.
Lead-time overrides join in only once their rule is known to apply.
"""

import heapq
from datetime import date

from .logic import Atom, Cond, Env, MacroRef, Result, RuleRef, leftmost, simplify, tests_in
from .model import TERMINAL_KINDS, Fact, Rule, RuleSet

_TRUE_WORDS = {"true", "yes", "y", "1"}
_FALSE_WORDS = {"false", "no", "n", "0"}


class _FactEnv(Env):
    """Macros and rule references are inlined, so residuals hold only atoms."""

    def __init__(self, rs: RuleSet, facts: dict, as_of: date):
        super().__init__(facts)
        self.rs = rs
        self.as_of = as_of
        self._macros: dict[str, Result] = {}
        self._rules: dict[str, Result] = {}

    def macro(self, ref: MacroRef) -> Result:
        if ref.name not in self._macros:
            self._macros[ref.name] = simplify(self.rs.macros[ref.name], self)
        return self._macros[ref.name]

    def rule(self, ref: RuleRef) -> Result:
        return self.residual(self.rs.by_id[ref.id])

    def residual(self, rule: Rule) -> Result:
        if rule.id not in self._rules:
            if not rule.in_effect(self.as_of):
                self._rules[rule.id] = False
            elif rule.when is None:
                self._rules[rule.id] = True
            else:
                self._rules[rule.id] = simplify(rule.when, self)
        return self._rules[rule.id]


def evaluate_all(rs: RuleSet, facts: dict, as_of: date | None = None) -> dict[str, bool | None]:
    """Every rule in effect on `as_of`: True (applies), False, or None (undetermined).

    Works on partial facts; for an undetermined rule, `open_facts` says what
    to answer to resolve it.
    """
    env = _FactEnv(rs, facts, as_of or date.today())
    out: dict[str, bool | None] = {}
    for rule in rs.rules:
        if not rule.in_effect(env.as_of):
            continue
        r = env.residual(rule)
        out[rule.id] = r if isinstance(r, bool) else None
    return out


def open_facts(rs: RuleSet, facts: dict, rule_id: str, as_of: date | None = None) -> list[str]:
    """Facts still open in a rule's residual, in declaration order."""
    env = _FactEnv(rs, facts, as_of or date.today())
    r = env.residual(rs.by_id[rule_id])
    if isinstance(r, bool):
        return []
    names = {t.fact for t in tests_in(r) if isinstance(t, Atom)}
    return sorted(names, key=rs.fact_order.__getitem__)


def step(rs: RuleSet, facts: dict, as_of: date | None = None) -> dict:
    """The next question to ask, or the terminal result.

    Question: {kind: "question", fact, prompt, type, values?, because: [rule ids]}
    Terminal: {kind: "terminal", status: complete|out_of_scope|blocked,
               blocking_rule?, rules: [...], by_kind: {kind: [ids]}}
    """
    env = _FactEnv(rs, facts, as_of or date.today())
    applying: list[Rule] = []
    candidates: dict[str, list[str]] = {}

    def consider(residual: Cond, rule_id: str) -> None:
        test = leftmost(residual)
        assert isinstance(test, Atom), "residuals are fully inlined"
        candidates.setdefault(test.fact, []).append(rule_id)

    for rule in rs.rules:
        if not rule.in_effect(env.as_of):
            continue
        r = env.residual(rule)
        if r is True:
            if rule.kind in TERMINAL_KINDS:
                status = "out_of_scope" if rule.kind == "out_of_scope" else "blocked"
                return _terminal(rs, env, status, [rule], blocking=rule)
            applying.append(rule)
            for ov in rule.lead_time.overrides if rule.lead_time else ():
                ov_r = simplify(ov.when, env)
                if not isinstance(ov_r, bool):
                    consider(ov_r, rule.id)
        elif not isinstance(r, bool):
            consider(r, rule.id)

    if not candidates:
        return _terminal(rs, env, "complete", applying)

    fact = min(candidates, key=rs.fact_order.__getitem__)
    spec = rs.facts[fact]
    q: dict = {
        "kind": "question",
        "fact": fact,
        "prompt": spec.question,
        "type": spec.type,
        "because": candidates[fact],
    }
    if spec.values:
        q["values"] = list(spec.values)
    return q


def answer(rs: RuleSet, facts: dict, fact: str, raw: object) -> dict:
    """A new fact dict with `fact` set to `raw`, coerced to the fact's type.

    Raises ValueError for an unknown fact or a value that doesn't fit.
    """
    spec = rs.facts.get(fact)
    if spec is None:
        raise ValueError(f"unknown fact {fact!r}")
    return {**facts, fact: coerce(spec, raw)}


def coerce(spec: Fact, raw: object) -> object:
    text = raw.strip().lower() if isinstance(raw, str) else None
    match spec.type:
        case "bool":
            if isinstance(raw, bool):
                return raw
            if text in _TRUE_WORDS:
                return True
            if text in _FALSE_WORDS:
                return False
        case "int":
            if isinstance(raw, int) and not isinstance(raw, bool):
                return raw
            if isinstance(raw, float) and raw.is_integer():
                return int(raw)
            if text is not None and text.lstrip("-").isdigit():
                return int(text)
        case "number":
            if isinstance(raw, int | float) and not isinstance(raw, bool):
                return raw
            if text is not None:
                try:
                    return float(text)
                except ValueError:
                    pass
        case "enum":
            if isinstance(raw, str) and raw in (spec.values or ()):
                return raw
    raise ValueError(f"{raw!r} is not a valid {spec.type} answer")


def order_by_requires(rs: RuleSet, rule_ids: list[str]) -> list[str]:
    """Topological order: a rule comes after every listed rule it requires.

    Required rules outside `rule_ids` (they don't apply) are ignored. Ties
    keep file order.
    """
    wanted = set(rule_ids)
    position = {r.id: i for i, r in enumerate(rs.rules)}
    before: dict[str, set[str]] = {rid: set() for rid in rule_ids}
    after: dict[str, list[str]] = {rid: [] for rid in rule_ids}
    for rid in rule_ids:
        for dep in rs.expand_requires(rs.by_id[rid]):
            if dep in wanted:
                before[rid].add(dep)
                after[dep].append(rid)
    ready = [(position[r], r) for r in rule_ids if not before[r]]
    heapq.heapify(ready)
    out: list[str] = []
    while ready:
        _, rid = heapq.heappop(ready)
        out.append(rid)
        for nxt in after[rid]:
            before[nxt].discard(rid)
            if not before[nxt]:
                heapq.heappush(ready, (position[nxt], nxt))
    return out


def _terminal(
    rs: RuleSet, env: _FactEnv, status: str, rules: list[Rule], blocking: Rule | None = None
) -> dict:
    ordered = order_by_requires(rs, [r.id for r in rules])
    by_kind: dict[str, list[str]] = {}
    for rid in ordered:
        by_kind.setdefault(rs.by_id[rid].kind, []).append(rid)
    out: dict = {
        "kind": "terminal",
        "status": status,
        "rules": [_rule_result(rs.by_id[rid], env) for rid in ordered],
        "by_kind": by_kind,
    }
    if blocking:
        out["blocking_rule"] = blocking.id
    return out


def _rule_result(rule: Rule, env: _FactEnv) -> dict:
    out: dict = {
        "id": rule.id,
        "kind": rule.kind,
        "title": rule.title,
        "agency": rule.agency,
        "confidence": rule.confidence,
        "sources": list(rule.sources),
    }
    if rule.fee:
        out["fee"] = rule.fee.model_dump(mode="json", exclude_none=True)
    for key in ("limits", "notes", "verify", "part_of"):
        value = getattr(rule, key)
        if value is not None:
            out[key] = value
    if rule.lead_time:
        out["lead_time"] = resolve_lead_time(rule, env)
    return out


def resolve_lead_time(rule: Rule, env: Env) -> dict:
    """The base lead time with the longest applying override folded in."""
    assert rule.lead_time is not None
    lt = rule.lead_time.model_dump(exclude={"overrides"}, exclude_none=True)
    for ov in rule.lead_time.overrides:
        if simplify(ov.when, env) is True and (ov.min_days or 0) >= lt.get("min_days", 0):
            lt["min_days"] = ov.min_days
            if ov.note:
                lt["override_note"] = ov.note
    return lt
