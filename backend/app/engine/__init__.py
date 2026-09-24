"""YAML-driven rules engine for San Francisco event permits.

    from app.engine import step, answer
    facts = {}
    while (s := step(facts))["kind"] == "question":
        facts = answer(facts, s["fact"], input(s["prompt"]))

Functions default to the bundled rules file; pass `rules=` to use another.
"""

from datetime import date
from functools import cache

from . import engine as _engine
from .model import DEFAULT_PATH, RuleSet, load

__all__ = ["RuleSet", "answer", "evaluate_all", "load", "load_ruleset", "step"]


@cache
def load_ruleset() -> RuleSet:
    return load(DEFAULT_PATH)


def step(facts: dict, as_of: date | None = None, rules: RuleSet | None = None) -> dict:
    return _engine.step(rules or load_ruleset(), facts, as_of)


def answer(facts: dict, fact: str, raw: object, rules: RuleSet | None = None) -> dict:
    return _engine.answer(rules or load_ruleset(), facts, fact, raw)


def evaluate_all(
    facts: dict, as_of: date | None = None, rules: RuleSet | None = None
) -> dict[str, bool | None]:
    return _engine.evaluate_all(rules or load_ruleset(), facts, as_of)
