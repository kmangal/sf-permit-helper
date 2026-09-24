"""Prompt templates: the enum and the template files match, and each one loads."""

import pytest

from app.prompts import TEMPLATES, PromptName, load


def test_every_template_file_has_an_enum_member():
    assert {p.stem for p in TEMPLATES.glob("*.json")} == {n.value for n in PromptName}


@pytest.mark.parametrize("name", list(PromptName))
def test_every_prompt_loads(name):
    prompt = load(name)
    assert prompt.system.strip()
    assert prompt.user.strip()


def test_clarify_renders_its_fields():
    user = load(PromptName.CLARIFY).render(context='{"a": 1}', question="What counts?")
    assert user == '{"a": 1}\n\nTheir question: What counts?'
