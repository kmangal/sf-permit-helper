"""Mermaid diagram generation from the rules file."""

import re

import pytest

from app.engine.diagrams import DEFAULT_OUT, generate
from app.engine.model import load

RS = load()
FILES = generate(RS)
MAX_NODES = 40


def _nodes(src: str) -> set[str]:
    return set(re.findall(r"^  (\w+)[\[\{\(]", src, re.M))


def test_every_rule_is_drawn_in_its_sections():
    for rule in RS.rules:
        for sid in rule.section:
            src = next(s for name, s in FILES.items() if name.startswith(f"{sid}_"))
            assert f"r_{rule.id}[" in src, f"{rule.id} missing from section {sid}"
            assert re.search(rf"--> r_{rule.id}$|-->\|[^|]+\| r_{rule.id}$", src, re.M), (
                f"{rule.id} has no incoming edge in section {sid}"
            )


def test_every_section_is_routed_from_the_overview():
    overview = FILES["00_overview.mmd"]
    for sid in RS.sections:
        if sid != "00":
            assert re.search(rf"\| s_{sid}$|--> s_{sid}$", overview, re.M), sid


@pytest.mark.parametrize("name", sorted(n for n in FILES if n.endswith(".mmd")))
def test_diagrams_stay_small(name):
    assert len(_nodes(FILES[name])) < MAX_NODES


def test_block_party_macro_is_its_own_diagram():
    streets = FILES["04_street_or_sidewalk.mmd"]
    assert '{{"block_party_eligible?"}}' in streets
    assert "macro_block_party_eligible.mmd" in FILES


def test_committed_diagrams_are_current():
    """Regenerate with `python -m app.engine.diagrams` if this fails."""
    on_disk = {p.name: p.read_text() for p in DEFAULT_OUT.glob("*") if p.suffix in (".mmd", ".md")}
    assert set(on_disk) == set(FILES), "diagram files added or removed"
    stale = [name for name, src in FILES.items() if on_disk[name] != src]
    assert not stale, f"stale diagrams: {stale}"
