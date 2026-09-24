"""Typed, validated view of a rules YAML file.

Loading checks every cross-reference (facts, macros, rules, groups, sections,
sources), that atom values fit their fact's type, and that macros, rule
references and `requires` have no cycles. A bad file fails at load, not
halfway through someone's intake.
"""

import re
from datetime import date
from functools import cached_property
from graphlib import CycleError, TopologicalSorter
from pathlib import Path
from typing import Annotated, Literal

import yaml
from pydantic import BaseModel, BeforeValidator, ConfigDict, Field, model_validator

from .logic import Atom, Cond, MacroRef, RuleRef, parse, tests_in

DEFAULT_PATH = Path(__file__).resolve().parent / "rules.yaml"

Condition = Annotated[Cond, BeforeValidator(parse)]

Kind = Literal[
    "out_of_scope",
    "advisory",
    "exemption",
    "requirement",
    "document",
    "permit",
    "license",
    "plan",
    "process_step",
    "blocker",
]

# Kinds that end the walk as soon as they apply.
TERMINAL_KINDS = ("out_of_scope", "blocker")


class _Model(BaseModel):
    model_config = ConfigDict(arbitrary_types_allowed=True, frozen=True)


class Fact(_Model):
    type: Literal["enum", "bool", "int", "number"]
    question: str
    values: tuple[str, ...] | None = None


class Section(_Model):
    title: str
    entry: Condition | None = None


class Source(_Model):
    title: str
    publisher: str
    url: str


Money = int | float


class Fee(_Model):
    """A fee as its source states it, with the verbatim quote that backs it.

    One shape at most: `amount_usd` when the fee is a single number,
    `range_usd` when it depends on something not known yet (lead time, hazard
    level, nonprofit status), `amount_usd_from` only when the source gives no
    upper bound. With none of them the fee is note-only.
    """

    amount_usd: Money | None = None
    amount_usd_from: Money | None = None
    range_usd: tuple[Money, Money] | None = None
    amendment_usd: Money | None = None
    note: str | None = None
    source: str
    quote: str
    derived: str | None = None
    fetched_on: date
    effective_from: date | None = None
    effective_to: date | None = None

    @model_validator(mode="after")
    def _check_shape(self) -> "Fee":
        shapes = (self.amount_usd, self.amount_usd_from, self.range_usd)
        if sum(s is not None for s in shapes) > 1:
            raise ValueError("fee takes one of amount_usd, amount_usd_from, range_usd")
        if self.range_usd and self.range_usd[0] >= self.range_usd[1]:
            raise ValueError("fee range_usd must run low to high")
        return self

    def figures(self) -> list[Money]:
        """Every dollar figure the fee states, in its fields and its note."""
        out = [
            n for n in (self.amount_usd, self.amount_usd_from, self.amendment_usd) if n is not None
        ]
        out.extend(self.range_usd or ())
        for m in _DOLLARS.findall(self.note or ""):
            n = float(m.replace(",", ""))
            out.append(int(n) if n.is_integer() else n)
        return [n for n in out if n]


_DOLLARS = re.compile(r"\$(\d[\d,]*(?:\.\d\d)?)")


def _quoted(n: Money, quote: str) -> bool:
    """True if `quote` states `n` as a figure ("586", "$1,331.00", "5,494.07")."""
    text = f"{n:,.2f}".removesuffix(".00")
    pattern = rf"(?<![\d,.]){re.escape(text)}(?:\.00)?(?![\d,]|\.\d)"
    return re.search(pattern, quote) is not None


class Override(_Model):
    model_config = ConfigDict(extra="allow", arbitrary_types_allowed=True, frozen=True)
    when: Condition
    min_days: int | None = None
    note: str | None = None


class LeadTime(_Model):
    model_config = ConfigDict(extra="allow", arbitrary_types_allowed=True, frozen=True)
    overrides: tuple[Override, ...] = ()


def _as_list(v: object) -> object:
    return [v] if isinstance(v, str) else v


class Rule(_Model):
    id: str
    section: Annotated[tuple[str, ...], BeforeValidator(_as_list)]
    kind: Kind
    title: str
    agency: str | None = None
    when: Condition | None = None
    requires: tuple[str, ...] = ()
    part_of: str | None = None
    fee: Fee | None = None
    lead_time: LeadTime | None = None
    limits: str | None = None
    notes: str | None = None
    verify: str | None = None
    sources: tuple[str, ...] = ()
    confidence: Literal["official", "official_scope", "secondary", "editorial"]
    effective_from: date | None = None
    effective_to: date | None = None

    def in_effect(self, as_of: date) -> bool:
        if self.effective_from and as_of < self.effective_from:
            return False
        return not (self.effective_to and as_of > self.effective_to)


class Scenario(_Model):
    id: str
    description: str
    as_of: date
    facts: dict
    expected_permits: tuple[str, ...] = ()
    expected_other: tuple[str, ...] = ()


class RuleSet(_Model):
    schema_version: int
    jurisdiction: str
    researched_on: date
    scope: str
    facts: dict[str, Fact]
    macros: dict[str, Condition] = Field(default_factory=dict)
    groups: dict[str, tuple[str, ...]] = Field(default_factory=dict)
    sections: dict[str, Section]
    sources: dict[str, Source] = Field(default_factory=dict)
    rules: tuple[Rule, ...]
    scenarios: tuple[Scenario, ...] = ()

    @cached_property
    def by_id(self) -> dict[str, Rule]:
        return {r.id: r for r in self.rules}

    @cached_property
    def fact_order(self) -> dict[str, int]:
        return {name: i for i, name in enumerate(self.facts)}

    def expand_requires(self, rule: Rule) -> list[str]:
        """`requires` with `group:` entries expanded, the rule itself excluded."""
        out: list[str] = []
        for ref in rule.requires:
            ids = self.groups[ref.removeprefix("group:")] if ref.startswith("group:") else [ref]
            out.extend(i for i in ids if i != rule.id and i not in out)
        return out

    @model_validator(mode="after")
    def _check(self) -> "RuleSet":
        errors: list[str] = []
        ids = [r.id for r in self.rules]
        dupes = {i for i in ids if ids.count(i) > 1}
        if dupes:
            errors.append(f"duplicate rule ids: {sorted(dupes)}")
        rule_ids = set(ids)

        def check_cond(cond: Cond, where: str) -> None:
            for t in tests_in(cond):
                match t:
                    case Atom():
                        errors.extend(f"{where}: {e}" for e in self._check_atom(t))
                    case MacroRef(name) if name not in self.macros:
                        errors.append(f"{where}: unknown macro {name!r}")
                    case RuleRef(rid) if rid not in rule_ids:
                        errors.append(f"{where}: unknown rule {rid!r}")

        for name, cond in self.macros.items():
            check_cond(cond, f"macro {name}")
        for sid, section in self.sections.items():
            if section.entry is not None:
                check_cond(section.entry, f"section {sid}")
        for gname, members in self.groups.items():
            errors.extend(
                f"group {gname}: unknown rule {m!r}" for m in members if m not in rule_ids
            )
        for r in self.rules:
            where = f"rule {r.id}"
            if r.when is not None:
                check_cond(r.when, where)
            if r.lead_time:
                for ov in r.lead_time.overrides:
                    check_cond(ov.when, f"{where} override")
            errors.extend(
                f"{where}: unknown section {s!r}" for s in r.section if s not in self.sections
            )
            errors.extend(
                f"{where}: unknown source {s!r}" for s in r.sources if s not in self.sources
            )
            if r.fee:
                errors.extend(f"{where}: {e}" for e in self._check_fee(r, r.fee))
            if r.part_of and r.part_of not in rule_ids:
                errors.append(f"{where}: unknown part_of {r.part_of!r}")
            for ref in r.requires:
                if ref.startswith("group:"):
                    if ref.removeprefix("group:") not in self.groups:
                        errors.append(f"{where}: unknown group {ref!r}")
                elif ref not in rule_ids:
                    errors.append(f"{where}: requires unknown rule {ref!r}")
        for s in self.scenarios:
            for fact, value in s.facts.items():
                if fact not in self.facts:
                    errors.append(f"scenario {s.id}: unknown fact {fact!r}")
                elif not self._fits(self.facts[fact], value):
                    errors.append(f"scenario {s.id}: bad value {value!r} for {fact}")
            errors.extend(
                f"scenario {s.id}: unknown rule {rid!r}"
                for rid in (*s.expected_permits, *s.expected_other)
                if rid not in rule_ids
            )
        if errors:
            raise ValueError("invalid rules file:\n  " + "\n  ".join(errors))
        self._check_cycles()
        return self

    @staticmethod
    def _fits(fact: Fact, value: object) -> bool:
        match fact.type:
            case "bool":
                return isinstance(value, bool)
            case "int":
                return isinstance(value, int) and not isinstance(value, bool)
            case "number":
                return isinstance(value, int | float) and not isinstance(value, bool)
            case "enum":
                return value in (fact.values or ())
        return False

    def _check_atom(self, a: Atom) -> list[str]:
        fact = self.facts.get(a.fact)
        if fact is None:
            return [f"unknown fact {a.fact!r}"]
        values = a.value if a.op in ("in", "not_in") else (a.value,)
        if a.op in ("in", "not_in") and not isinstance(a.value, tuple):
            return [f"{a.fact} {a.op} needs a list"]
        if a.op in ("gt", "gte", "lt", "lte") and fact.type not in ("int", "number"):
            return [f"{a.fact} {a.op} on non-numeric fact"]
        return [f"bad value {v!r} for {a.fact}" for v in values if not self._fits(fact, v)]

    def _check_fee(self, rule: Rule, fee: Fee) -> list[str]:
        if fee.source not in rule.sources:
            return [f"fee source {fee.source!r} is not in the rule's sources"]
        return [
            f"fee figure {n:,} is in neither its quote nor `derived`"
            for n in fee.figures()
            if not (_quoted(n, fee.quote) or _quoted(n, fee.derived or ""))
        ]

    def _check_cycles(self) -> None:
        # Macros and rule references share one graph: a rule's `when` may name
        # a macro that names a rule.
        graph: dict[str, set[str]] = {}
        for name, cond in self.macros.items():
            graph[f"macro:{name}"] = _refs(cond)
        for r in self.rules:
            deps = _refs(r.when) if r.when is not None else set()
            graph[f"rule:{r.id}"] = deps
        requires = {r.id: set(self.expand_requires(r)) for r in self.rules}
        for label, g in (("condition references", graph), ("requires", requires)):
            try:
                tuple(TopologicalSorter(g).static_order())
            except CycleError as e:
                raise ValueError(f"cycle in {label}: {e.args[1]}") from None


def _refs(cond: Cond) -> set[str]:
    out: set[str] = set()
    for t in tests_in(cond):
        if isinstance(t, MacroRef):
            out.add(f"macro:{t.name}")
        elif isinstance(t, RuleRef):
            out.add(f"rule:{t.id}")
    return out


def load(path: Path | str = DEFAULT_PATH) -> RuleSet:
    with open(path) as f:
        return RuleSet.model_validate(yaml.safe_load(f))


def loads(text: str) -> RuleSet:
    return RuleSet.model_validate(yaml.safe_load(text))
