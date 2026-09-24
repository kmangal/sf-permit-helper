"""The jev-first question loop, with jev faked."""

import asyncio

import pytest

from app.engine.model import load
from app.navigator import (
    ABORT_MESSAGE,
    MAX_ATTEMPTS,
    UNKNOWN,
    Navigator,
    Session,
    atoms_for,
    options_for,
    signature,
)

RS = load()


class FakeJev:
    """Answers from `known` (fact -> value); anything else is unknown.

    `replies` maps a user reply to the value jev should read it as.
    """

    def __init__(self, known: dict | None = None, replies: dict | None = None, fail=False):
        self.known = known or {}
        self.replies = replies or {}
        self.fail = fail
        self.asked: list[str] = []

    async def choose(self, state, name, question):
        self.asked.append(name)
        if self.fail:
            raise TimeoutError("jev down")
        if "response" in state:
            value = self.replies.get(state["response"], UNKNOWN)
        else:
            value = self.known.get(name, UNKNOWN)
        label = UNKNOWN if value == UNKNOWN else label_of(name, value)
        return {k: (0.9 if k == label else 0.1 / len(question.criteria)) for k in question.criteria}


def label_of(fact: str, value) -> str:
    """The option whose range decides the rules the same way `value` does."""
    atoms = atoms_for(RS, fact)
    sig = signature(atoms, value)
    return next(o.label for o in options_for(RS, fact) if signature(atoms, o.value) == sig)


def run(coro):
    return asyncio.run(coro)


@pytest.mark.parametrize("scenario", RS.scenarios, ids=lambda s: s.id)
def test_jev_answers_everything(scenario):
    nav = Navigator(FakeJev(scenario.facts), RS, scenario.as_of)
    session = Session(description=scenario.description)
    turn = run(nav.advance(session))
    assert turn["kind"] == "terminal"
    assert set(turn["answered_by"].values()) <= {"jev"}
    got = {r["id"] for r in turn["rules"]}
    assert set(scenario.expected_permits) <= got


def test_unknown_goes_to_user_then_resumes_with_jev():
    scenario = RS.scenarios[0]
    known = dict(scenario.facts)
    first = run(Navigator(FakeJev(), RS, scenario.as_of).advance(Session("x")))["fact"]
    held_back = known.pop(first)

    nav = Navigator(FakeJev(known), RS, scenario.as_of)
    session = Session(description=scenario.description)
    turn = run(nav.advance(session))
    assert turn["kind"] == "question" and turn["fact"] == first
    assert turn["attempts_left"] == MAX_ATTEMPTS
    assert UNKNOWN not in [o["label"] for o in turn["options"]]

    answer = "yes" if held_back is True else "no" if held_back is False else str(held_back)
    turn = run(nav.reply(session, answer))
    assert turn["kind"] == "terminal"
    assert turn["answered_by"][first] == "user"
    assert session.transcript == [{"question": RS.facts[first].question, "answer": answer}]


def test_reply_jev_reads_free_text():
    nav = Navigator(FakeJev(replies={"it's at my house": "private_residence"}), RS)
    session = Session(description="a party")
    turn = run(nav.advance(session))
    assert turn["fact"] == "event_type"
    turn = run(nav.reply(session, "general"))
    assert turn["fact"] == "location"
    run(nav.reply(session, "it's at my house"))
    assert session.facts["location"] == "private_residence"


def test_aborts_after_three_bad_replies():
    nav = Navigator(FakeJev(), RS)
    session = Session(description="something")
    run(nav.advance(session))
    for left in range(MAX_ATTEMPTS - 1, 0, -1):
        turn = run(nav.reply(session, "banana"))
        assert turn["kind"] == "question"
        assert turn["rejected"] == "banana" and turn["attempts_left"] == left
    turn = run(nav.reply(session, "banana"))
    assert turn == {"kind": "aborted", "message": ABORT_MESSAGE, "fact": "event_type"}
    with pytest.raises(ValueError):
        run(nav.reply(session, "general"))


def test_jev_failure_asks_the_user():
    nav = Navigator(FakeJev(fail=True), RS)
    turn = run(nav.advance(Session(description="anything")))
    assert turn["kind"] == "question" and turn["fact"] == "event_type"


def test_parsed_reply_skips_jev():
    jev = FakeJev()
    nav = Navigator(jev, RS)
    session = Session(description="x")
    run(nav.advance(session))
    jev.asked.clear()
    run(nav.reply(session, "General"))
    assert session.facts["event_type"] == "general"
    assert jev.asked[:1] == ["location"]  # the next question, not a validation call


@pytest.mark.parametrize(
    "fact", [f for f, spec in RS.facts.items() if spec.type in ("int", "number")]
)
def test_numeric_ranges_decide_rules_distinctly(fact):
    atoms = atoms_for(RS, fact)
    options = options_for(RS, fact)
    if not atoms:
        assert options == []
        return
    # Neighbors differ, so no cut is wasted. Non-neighbors may match (an eq test
    # splits 0 from 2 to 3 around 1) and are left apart to keep labels readable.
    sigs = [signature(atoms, o.value) for o in options]
    assert all(a != b for a, b in zip(sigs, sigs[1:], strict=False)), [o.label for o in options]
    assert len({o.label for o in options}) == len(options)


def test_attendance_ranges():
    labels = [o.label for o in options_for(RS, "peak_attendance")]
    assert labels[0] == "fewer than 25"
    assert labels[-1] == "5000 or more"


def test_option_label_reply_skips_jev():
    jev = FakeJev()
    nav = Navigator(jev, RS)
    session = Session(description="x")
    session.facts = {"event_type": "general", "location": "city_park"}
    session.pending = {"kind": "question", "fact": "peak_attendance", "prompt": "How many?"}
    label = options_for(RS, "peak_attendance")[0].label
    run(nav.reply(session, label.upper()))
    assert session.labels["peak_attendance"] == label
    assert "peak_attendance" not in jev.asked


def test_turns_carry_known_facts_and_citations():
    scenario = RS.scenarios[0]
    nav = Navigator(FakeJev(scenario.facts), RS, scenario.as_of)
    turn = run(nav.advance(Session(description=scenario.description)))
    assert [k["fact"] for k in turn["known"]] == list(turn["answered_by"])
    assert all(k["by"] == "jev" for k in turn["known"])
    for r in turn["rules"]:
        assert all(s["url"].startswith("http") for s in r["sources"])
    applying = {r["id"] for r in turn["rules"]}
    assert turn["not_needed"] and not applying & {r["id"] for r in turn["not_needed"]}


class FakeLlm:
    """Streams `reply` in two pieces and keeps what it was asked."""

    def __init__(self, reply: str = "It means the most people there at once."):
        self.reply = reply
        self.prompts: list[tuple[str, str | None]] = []

    async def stream(self, prompt, *, system=None):
        self.prompts.append((prompt, system))
        half = len(self.reply) // 2
        for part in (self.reply[:half], self.reply[half:]):
            yield part


async def collect(stream) -> str:
    return "".join([text async for text in stream])


def test_clarify_streams_an_answer_about_the_pending_question():
    nav = Navigator(FakeJev(), RS)
    session = Session(description="A block party with a DJ")
    turn = run(nav.advance(session))
    llm = FakeLlm()

    answer = run(collect(nav.clarify(llm, session, "Does that count kids?")))

    assert answer == llm.reply
    prompt, system = llm.prompts[0]
    assert "A block party with a DJ" in prompt
    assert turn["prompt"] in prompt
    assert "Does that count kids?" in prompt
    assert system and "San Francisco" in system
    # The question is still waiting, nothing was settled, and the exchange is remembered.
    assert session.pending is not None and session.pending["fact"] == turn["fact"]
    assert session.facts == {}
    assert session.clarifications == [
        {"about": turn["prompt"], "question": "Does that count kids?", "answer": llm.reply}
    ]

    run(collect(nav.clarify(llm, session, "And the band?")))
    assert "Does that count kids?" in llm.prompts[1][0]


def test_clarify_needs_a_pending_question():
    with pytest.raises(ValueError):
        run(collect(Navigator(FakeJev(), RS).clarify(FakeLlm(), Session("x"), "what?")))
