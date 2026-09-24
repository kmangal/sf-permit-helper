"""Condition trees and three-valued evaluation.

A condition simplifies against what is known to one of three things: True,
False, or a residual condition made only of the tests that are still open.
The residual keeps the authored order of the tests, so its leftmost test is
the one the rule's author wrote first.
"""

from collections.abc import Callable, Iterator
from dataclasses import dataclass
from typing import Any as AnyValue

OPS = ("eq", "ne", "gt", "gte", "lt", "lte", "in", "not_in")


@dataclass(frozen=True)
class Atom:
    fact: str
    op: str
    value: AnyValue


@dataclass(frozen=True)
class All:
    items: tuple["Cond", ...]


@dataclass(frozen=True)
class Any:
    items: tuple["Cond", ...]


@dataclass(frozen=True)
class Not:
    item: "Cond"


@dataclass(frozen=True)
class MacroRef:
    name: str


@dataclass(frozen=True)
class RuleRef:
    id: str


Cond = Atom | All | Any | Not | MacroRef | RuleRef
Result = Cond | bool


def _freeze(value: AnyValue) -> AnyValue:
    return tuple(value) if isinstance(value, list) else value


def parse(obj: AnyValue) -> Cond:
    """Build a condition from its YAML form (see the grammar in the rules file)."""
    if isinstance(obj, Atom | All | Any | Not | MacroRef | RuleRef):
        return obj
    if not isinstance(obj, dict):
        raise ValueError(f"condition must be a mapping, got {obj!r}")
    keys = set(obj)
    if keys == {"fact", "op", "value"}:
        if obj["op"] not in OPS:
            raise ValueError(f"unknown op {obj['op']!r}")
        return Atom(obj["fact"], obj["op"], _freeze(obj["value"]))
    if keys == {"all"}:
        return All(tuple(parse(c) for c in obj["all"]))
    if keys == {"any"}:
        return Any(tuple(parse(c) for c in obj["any"]))
    if keys == {"not"}:
        return Not(parse(obj["not"]))
    if keys == {"macro"}:
        return MacroRef(obj["macro"])
    if keys == {"rule"}:
        return RuleRef(obj["rule"])
    raise ValueError(f"unrecognized condition {obj!r}")


def compare(op: str, actual: AnyValue, expected: AnyValue) -> bool:
    match op:
        case "eq":
            return actual == expected
        case "ne":
            return actual != expected
        case "gt":
            return actual > expected
        case "gte":
            return actual >= expected
        case "lt":
            return actual < expected
        case "lte":
            return actual <= expected
        case "in":
            return actual in expected
        case "not_in":
            return actual not in expected
    raise ValueError(f"unknown op {op!r}")


class Env:
    """What simplification knows: fact values, value domains, and how to
    resolve macro and rule references. Subclasses override the resolvers."""

    def __init__(self, facts: dict | None = None, domains: dict[str, set] | None = None):
        self.facts = facts or {}
        self.domains = domains or {}

    def atom(self, a: Atom) -> Result:
        value = self.facts.get(a.fact)
        if value is not None:
            return compare(a.op, value, a.value)
        domain = self.domains.get(a.fact)
        if domain:
            outcomes = {compare(a.op, v, a.value) for v in domain}
            if len(outcomes) == 1:
                return outcomes.pop()
        return a

    def macro(self, ref: MacroRef) -> Result:
        raise NotImplementedError

    def rule(self, ref: RuleRef) -> Result:
        raise NotImplementedError


def simplify(cond: Cond, env: Env) -> Result:
    """Three-valued simplification. Unknown tests survive; decided ones fold away."""
    match cond:
        case Atom():
            return env.atom(cond)
        case All(items):
            kept: list[Cond] = []
            for item in items:
                r = simplify(item, env)
                if r is False:
                    return False
                if r is not True:
                    kept.append(r)
            return _join(All, kept, empty=True)
        case Any(items):
            kept = []
            for item in items:
                r = simplify(item, env)
                if r is True:
                    return True
                if r is not False:
                    kept.append(r)
            return _join(Any, kept, empty=False)
        case Not(item):
            r = simplify(item, env)
            return (not r) if isinstance(r, bool) else Not(r)
        case MacroRef():
            return env.macro(cond)
        case RuleRef():
            return env.rule(cond)
    raise TypeError(f"not a condition: {cond!r}")


def _join(kind: type[All] | type[Any], kept: list[Cond], empty: bool) -> Result:
    if not kept:
        return empty
    if len(kept) == 1:
        return kept[0]
    return kind(tuple(kept))


def leftmost(cond: Cond) -> Cond:
    """The first test in authored order: an Atom, MacroRef or RuleRef."""
    match cond:
        case All(items) | Any(items):
            return leftmost(items[0])
        case Not(item):
            return leftmost(item)
    return cond


def walk(cond: Cond) -> Iterator[Cond]:
    """Every node in the tree, depth first, in authored order."""
    yield cond
    match cond:
        case All(items) | Any(items):
            for item in items:
                yield from walk(item)
        case Not(item):
            yield from walk(item)


def tests_in(cond: Cond) -> list[Atom | MacroRef | RuleRef]:
    return [c for c in walk(cond) if isinstance(c, Atom | MacroRef | RuleRef)]


def describe(cond: Cond, name: Callable[[Cond], str] | None = None) -> str:
    """Compact one-line text for a condition, for diagram labels."""
    name = name or _test_text
    match cond:
        case All(items):
            return " AND ".join(_paren(i, name) for i in items)
        case Any(items):
            return " OR ".join(_paren(i, name) for i in items)
        case Not(item):
            return f"NOT {_paren(item, name)}"
    return name(cond)


def _paren(cond: Cond, name: Callable[[Cond], str]) -> str:
    text = describe(cond, name)
    return f"({text})" if isinstance(cond, All | Any) else text


_OP_TEXT = {
    "eq": "=",
    "ne": "≠",
    "gt": ">",
    "gte": "≥",
    "lt": "<",
    "lte": "≤",
    "in": "in",
    "not_in": "not in",
}


def _value_text(value: AnyValue) -> str:
    if isinstance(value, tuple):
        return "[" + ", ".join(_value_text(v) for v in value) + "]"
    if isinstance(value, bool):
        return "yes" if value else "no"
    return str(value)


def _test_text(cond: Cond) -> str:
    match cond:
        case Atom(fact, op, value):
            return f"{fact} {_OP_TEXT[op]} {_value_text(value)}"
        case MacroRef(name):
            return name
        case RuleRef(rid):
            return f"rule {rid}"
    raise TypeError(cond)
