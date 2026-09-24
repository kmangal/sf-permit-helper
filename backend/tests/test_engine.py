"""YAML rules engine: loading, three-valued logic, the question walk, ordering."""

from datetime import date

import pytest

from app.engine import engine
from app.engine.logic import All, Any, Atom, Env, Not, leftmost, parse, simplify
from app.engine.model import RuleSet, load, loads

RS = load()
ASKED_KINDS = ("permit", "license", "plan")


def walk(facts_source: dict, as_of: date, rs: RuleSet = RS) -> tuple[list[str], dict]:
    """Answer every question from `facts_source`; return (asked facts, terminal)."""
    facts: dict = {}
    asked: list[str] = []
    while (s := engine.step(rs, facts, as_of))["kind"] == "question":
        fact = s["fact"]
        assert fact in facts_source, f"asked {fact!r} (for {s['because']}), not in scenario"
        assert fact not in asked, f"asked {fact!r} twice"
        asked.append(fact)
        facts = engine.answer(rs, facts, fact, facts_source[fact])
    return asked, s


def ids(terminal: dict) -> list[str]:
    return [r["id"] for r in terminal["rules"]]


# ------------------------------------------------------------------- loader

MINIMAL = """
schema_version: 1
jurisdiction: x
researched_on: 2026-01-01
scope: x
facts:
  a: {type: bool, question: "A?"}
  n: {type: int, question: "N?"}
  e: {type: enum, values: [x, y], question: "E?"}
macros:
  m: {fact: a, op: eq, value: true}
sections:
  "00": {title: Overview}
rules:
  - id: r1
    section: "00"
    kind: permit
    title: R1
    when: {macro: m}
    confidence: official
"""


def test_real_file_loads():
    assert len(RS.rules) == len(RS.by_id)
    assert RS.by_id["ec_one_time_outdoor"].section == ("03", "04", "06")


def test_minimal_file_loads():
    assert loads(MINIMAL).by_id["r1"].title == "R1"


@pytest.mark.parametrize(
    ("old", "new", "message"),
    [
        ("{macro: m}", "{fact: nope, op: eq, value: true}", "unknown fact"),
        ("{macro: m}", "{macro: nope}", "unknown macro"),
        ("{macro: m}", "{rule: nope}", "unknown rule"),
        ("{macro: m}", "{fact: e, op: eq, value: z}", "bad value"),
        ("{macro: m}", "{fact: a, op: gt, value: 1}", "non-numeric"),
        ("{macro: m}", "{fact: e, op: in, value: x}", "needs a list"),
        ("{macro: m}", "{rule: r1}", "cycle"),
        ('section: "00"', 'section: "09"', "unknown section"),
    ],
)
def test_bad_files_are_rejected(old, new, message):
    with pytest.raises(ValueError, match=message):
        loads(MINIMAL.replace(old, new))


FEE = MINIMAL.replace("sections:", "sources:\n  s: {title: S, publisher: P, url: u}\nsections:") + (
    "    sources: [s]\n"
    "    fee:\n"
    "      range_usd: [58, 250]\n"
    "      note: $122 if 60-89 days ahead\n"
    "      source: s\n"
    '      quote: "90 days or more $58.00 60-89 days $122.00 30-59 days $250.00"\n'
    "      fetched_on: 2026-09-23\n"
)


def test_fee_with_quoted_figures_loads():
    fee = loads(FEE).by_id["r1"].fee
    assert fee is not None and fee.range_usd == (58, 250)


@pytest.mark.parametrize(
    ("old", "new", "message"),
    [
        ("[58, 250]", "[58, 251]", "251 is in neither its quote"),
        ("$122 if", "$120 if", "120 is in neither its quote"),
        ("$58.00", "$580.00", "58 is in neither its quote"),
        ("      source: s", "      source: t", "not in the rule's sources"),
        ("[58, 250]", "[250, 58]", "low to high"),
        ("range_usd: [58, 250]", "range_usd: [58, 250]\n      amount_usd: 58", "one of"),
        ("      fetched_on: 2026-09-23\n", "", "fetched_on"),
    ],
)
def test_bad_fees_are_rejected(old, new, message):
    with pytest.raises(ValueError, match=message):
        loads(FEE.replace(old, new))


def test_derived_figures_load():
    text = FEE.replace("[58, 250]", "[58, 308]").replace(
        "      source: s", '      derived: "308 = 58 + 250"\n      source: s'
    )
    fee = loads(text).by_id["r1"].fee
    assert fee is not None and fee.range_usd == (58, 308)


def test_requires_cycle_is_rejected():
    text = MINIMAL + (
        "    requires: [r2]\n"
        "  - id: r2\n"
        '    section: "00"\n'
        "    kind: permit\n"
        "    title: R2\n"
        "    requires: [r1]\n"
        "    confidence: official\n"
    )
    with pytest.raises(ValueError, match="cycle in requires"):
        loads(text)


# -------------------------------------------------------------------- logic

A = Atom("a", "eq", True)
B = Atom("b", "eq", True)


@pytest.mark.parametrize(
    ("cond", "facts", "expected"),
    [
        (All((A, B)), {"a": False}, False),
        (All((A, B)), {"a": True}, B),
        (All((A, B)), {"a": True, "b": True}, True),
        (Any((A, B)), {"a": True}, True),
        (Any((A, B)), {"a": False}, B),
        (Any((A, B)), {}, Any((A, B))),
        (Not(A), {}, Not(A)),
        (Not(A), {"a": False}, True),
        (Not(All((A, B))), {"b": False}, True),
    ],
)
def test_three_valued_simplify(cond, facts, expected):
    assert simplify(cond, Env(facts)) == expected


def test_domains_fold_enum_tests():
    loc = parse({"fact": "loc", "op": "in", "value": ["p", "q"]})
    assert simplify(loc, Env({}, {"loc": {"p"}})) is True
    assert simplify(loc, Env({}, {"loc": {"r"}})) is False
    assert simplify(loc, Env({}, {"loc": {"p", "r"}})) == loc


def test_leftmost_follows_authored_order():
    assert leftmost(All((Not(Any((B, A))), A))) == B


# --------------------------------------------------------------------- walk


@pytest.mark.parametrize("scenario", RS.scenarios, ids=lambda s: s.id)
def test_scenario_evaluation(scenario):
    result = engine.evaluate_all(RS, scenario.facts, scenario.as_of)
    applying = {rid for rid, v in result.items() if v}
    permits = {rid for rid in applying if RS.by_id[rid].kind in ASKED_KINDS}
    assert permits == set(scenario.expected_permits)
    assert set(scenario.expected_other) <= applying


@pytest.mark.parametrize("scenario", RS.scenarios, ids=lambda s: s.id)
def test_scenario_walk(scenario):
    _, terminal = walk(scenario.facts, scenario.as_of)
    assert terminal["status"] == "complete"
    result = engine.evaluate_all(RS, scenario.facts, scenario.as_of)
    assert sorted(ids(terminal)) == sorted(rid for rid, v in result.items() if v)


def test_first_question_is_event_type():
    q = engine.step(RS, {})
    assert q["kind"] == "question"
    assert q["fact"] == "event_type"
    assert q["type"] == "enum"
    assert "parade" in q["values"]


def test_out_of_scope_stops_after_one_question():
    asked, terminal = walk({"event_type": "parade"}, date(2026, 9, 22))
    assert asked == ["event_type"]
    assert terminal["status"] == "out_of_scope"
    assert terminal["blocking_rule"] == "out_of_scope_event_type"


def test_ineligible_farmers_market_is_blocked():
    facts = {
        "event_type": "farmers_market",
        "location": "city_park",
        "farmers_market_operator": "other",
    }
    terminal = engine.step(RS, facts, date(2026, 9, 22))
    assert terminal["status"] == "blocked"
    assert terminal["blocking_rule"] == "farmers_market_operator_ineligible"


def test_street_event_does_not_ask_open_to_public_early():
    facts = {"event_type": "general", "location": "street_or_sidewalk"}
    q = engine.step(RS, facts)
    assert q["fact"] != "open_to_public"


def test_irrelevant_facts_are_never_asked():
    # A park picnic never touches street-closure facts.
    scenario = next(s for s in RS.scenarios if s.id == "dolores_park_birthday_picnic")
    asked, _ = walk(scenario.facts, scenario.as_of)
    assert not {"closes_street", "blocks_closed", "in_entertainment_zone", "indoors"} & set(asked)


def test_override_asked_only_once_rule_applies():
    fair = next(s for s in RS.scenarios if s.id == "two_block_street_fair_with_beer")
    no_music = {**fair.facts, "live_entertainment": False, "amplified_sound": False}
    no_music = {k: v for k, v in no_music.items() if k != "amplified_hours_per_day"}
    asked, terminal = walk(no_music, fair.as_of)
    assert "ec_one_time_outdoor" not in ids(terminal)
    assert "amplified_hours_per_day" not in asked


def test_lead_time_override_resolves():
    fair = next(s for s in RS.scenarios if s.id == "two_block_street_fair_with_beer")
    _, terminal = walk(fair.facts, fair.as_of)
    closure = next(r for r in terminal["rules"] if r["id"] == "sfmta_special_event_closure")
    assert closure["lead_time"]["min_days"] == 90
    assert "override_note" in closure["lead_time"]
    ec = next(r for r in terminal["rules"] if r["id"] == "ec_one_time_outdoor")
    assert ec["lead_time"]["min_days"] == 14


def test_requires_order():
    fair = next(s for s in RS.scenarios if s.id == "two_block_street_fair_with_beer")
    _, terminal = walk(fair.facts, fair.as_of)
    order = ids(terminal)
    assert order.index("security_plan") < order.index("sfpd_alcohol_approval")
    assert order.index("sfpd_alcohol_approval") < order.index("abc_daily_license")
    assert order.index("sfmta_special_event_closure") < order.index("ec_one_time_outdoor")


def test_effective_dates():
    fair = next(s for s in RS.scenarios if s.id == "two_block_street_fair_with_beer")
    before = engine.evaluate_all(RS, fair.facts, date(2026, 1, 1))
    assert "iscott_administrative_review" not in before
    assert before["iscott_public_hearing"] is True
    after = engine.evaluate_all(RS, fair.facts, fair.as_of)
    assert after["iscott_administrative_review"] is True
    assert after["iscott_public_hearing"] is False


def test_partial_facts_report_open_questions():
    facts = {"event_type": "general", "location": "city_park"}
    result = engine.evaluate_all(RS, facts)
    assert result["rpd_special_event_permit"] is None
    assert engine.open_facts(RS, facts, "rpd_special_event_permit")[0] == "peak_attendance"


# ------------------------------------------------------------------- answer


@pytest.mark.parametrize(
    ("fact", "raw", "expected"),
    [
        ("closes_street", "yes", True),
        ("closes_street", False, False),
        ("peak_attendance", "150", 150),
        ("duration_hours", "6.5", 6.5),
        ("location", "city_park", "city_park"),
    ],
)
def test_answer_coerces(fact, raw, expected):
    assert engine.answer(RS, {}, fact, raw) == {fact: expected}


@pytest.mark.parametrize(
    ("fact", "raw"),
    [("closes_street", "maybe"), ("peak_attendance", "lots"), ("location", "moon"), ("nope", 1)],
)
def test_answer_rejects(fact, raw):
    with pytest.raises(ValueError):
        engine.answer(RS, {}, fact, raw)


def test_answer_does_not_mutate():
    facts = {"event_type": "general"}
    engine.answer(RS, facts, "location", "city_park")
    assert facts == {"event_type": "general"}
