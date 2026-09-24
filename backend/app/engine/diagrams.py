"""Generate Mermaid decision diagrams from the rules file.

One overview (section 00 rules plus routing into every section), one diagram
per section, and one per composite macro. Usage:

    python -m app.engine.diagrams [--out ../docs/rules] [--check]

How a section is drawn: the section's `entry` restricts enum facts (e.g.
location = street_or_sidewalk), and each rule's `when` is simplified under
that restriction. The residual becomes DNF: a list of paths, each a list of
yes/no tests. Paths merge into a trie, so rules sharing leading tests share
diamonds. Small macros are inlined; bigger ones stay a single hexagon and get
their own diagram. A path that opens with "rule X applies" hangs off X's own
node when X is drawn in the same diagram.
"""

import argparse
import re
import sys
from dataclasses import dataclass, field
from itertools import product
from pathlib import Path

from .logic import (
    All,
    Any,
    Atom,
    Cond,
    Env,
    MacroRef,
    Not,
    Result,
    RuleRef,
    describe,
    simplify,
    tests_in,
)
from .model import RuleSet, load

DEFAULT_OUT = Path(__file__).resolve().parents[3] / "docs" / "rules"
MAX_INLINE_ATOMS = 2
HEADER = (
    "%% Generated from backend/app/engine/rules.yaml"
    " by `python -m app.engine.diagrams`. Do not edit."
)

CLASS_DEFS = {
    "permit": "fill:#dbeafe,stroke:#1d4ed8,color:#111",
    "plan": "fill:#ede9fe,stroke:#6d28d9,color:#111",
    "requirement": "fill:#fef3c7,stroke:#b45309,color:#111",
    "exemption": "fill:#dcfce7,stroke:#15803d,color:#111",
    "advisory": "fill:#f1f5f9,stroke:#475569,color:#111",
    "stop": "fill:#fee2e2,stroke:#b91c1c,color:#111",
    "section": "fill:#e0f2fe,stroke:#0369a1,color:#111",
    "note": "fill:#fafafa,stroke:#a3a3a3,color:#111,stroke-dasharray:3 3",
}
KIND_CLASS = {
    "permit": "permit",
    "license": "permit",
    "plan": "plan",
    "document": "plan",
    "requirement": "requirement",
    "process_step": "requirement",
    "exemption": "exemption",
    "advisory": "advisory",
    "blocker": "stop",
    "out_of_scope": "stop",
}

# A test is an Atom in canonical form (no ne/not_in, bools as `eq True`),
# a MacroRef or a RuleRef; a step is a test plus which answer the path takes.
Test = Atom | MacroRef | RuleRef
Step = tuple[Test, bool]
Path_ = tuple[Step, ...]


# --------------------------------------------------------------------------- envs


class _InlineEnv(Env):
    """Everything inlined, under optional domain restrictions."""

    def __init__(self, rs: RuleSet, domains: dict[str, set] | None = None):
        super().__init__({}, domains)
        self.rs = rs

    def macro(self, ref: MacroRef) -> Result:
        return simplify(self.rs.macros[ref.name], self)

    def rule(self, ref: RuleRef) -> Result:
        when = self.rs.by_id[ref.id].when
        return True if when is None else simplify(when, self)


class _DiagramEnv(_InlineEnv):
    """Inline small macros; keep bigger ones and rule references as single tests."""

    def __init__(self, rs: RuleSet, domains: dict[str, set] | None = None):
        super().__init__(rs, domains)
        self.inline = _InlineEnv(rs, domains)
        self.opaque_macros: set[str] = set()

    def macro(self, ref: MacroRef) -> Result:
        full = self.inline.macro(ref)
        if isinstance(full, bool) or _atom_count(full) <= MAX_INLINE_ATOMS:
            return full
        self.opaque_macros.add(ref.name)
        # A composite macro's small sub-macros are drawn as the path leading
        # into it, so e.g. "closes street, not recurring" is shared with the
        # rules that test those directly. Sound because the macro implies them.
        body = self.rs.macros[ref.name]
        prefix: list[Cond] = []
        if isinstance(body, All):
            for item in body.items:
                if isinstance(item, MacroRef):
                    r = self.macro(item)
                    if not isinstance(r, bool) and not _contains_macro(r):
                        prefix.append(r)
        return All((*prefix, ref)) if prefix else ref

    def rule(self, ref: RuleRef) -> Result:
        r = self.inline.rule(ref)
        return r if isinstance(r, bool) else ref


def _atom_count(cond: Cond) -> int:
    return sum(isinstance(t, Atom) for t in tests_in(cond))


def _contains_macro(cond: Cond) -> bool:
    return any(isinstance(t, MacroRef) for t in tests_in(cond))


def section_domains(rs: RuleSet, entry: Cond | None) -> dict[str, set]:
    """For each enum fact in `entry`, the values under which entry can hold."""
    if entry is None:
        return {}
    env = _InlineEnv(rs)
    full = simplify(entry, env)
    if isinstance(full, bool):
        return {}
    out: dict[str, set] = {}
    for fact in {t.fact for t in tests_in(full) if isinstance(t, Atom)}:
        spec = rs.facts[fact]
        if spec.type != "enum":
            continue
        out[fact] = {v for v in spec.values or () if simplify(full, Env({fact: v})) is not False}
    return out


# ---------------------------------------------------------------------------- DNF


def canonical(test: Test, positive: bool) -> Step:
    """One spelling per question, so equal questions merge in the trie.

    Negative operators become their positive twin on the "no" branch; bools
    always read "fact?". Numeric comparisons keep their authored direction.
    """
    if not isinstance(test, Atom):
        return test, positive
    fact, op, value = test.fact, test.op, test.value
    flip = {"ne": "eq", "not_in": "in"}
    if op in flip:
        op, positive = flip[op], not positive
    if op == "eq" and isinstance(value, bool):
        positive = positive == value
        value = True
    return Atom(fact, op, value), positive


def dnf(cond: Result, positive: bool = True) -> list[Path_]:
    if cond is True:
        return [()] if positive else []
    if cond is False:
        return [] if positive else [()]
    match cond:
        case Not(item):
            return dnf(item, not positive)
        case All(items) | Any(items):
            conj = isinstance(cond, All) == positive
            parts = [dnf(i, positive) for i in items]
            if not conj:
                return [p for part in parts for p in part]
            return [tuple(s for p in combo for s in p) for combo in product(*parts)]
    return [(canonical(cond, positive),)]  # type: ignore[arg-type]


def clean(paths: list[Path_]) -> list[Path_]:
    """Drop repeated steps and self-contradicting paths; keep order."""
    out: list[Path_] = []
    for path in paths:
        seen: dict[Test, bool] = {}
        steps: list[Step] = []
        ok = True
        for test, pol in path:
            if test in seen:
                ok = seen[test] == pol
                if not ok:
                    break
                continue
            seen[test] = pol
            steps.append((test, pol))
        if ok and tuple(steps) not in out:
            out.append(tuple(steps))
    return out


# --------------------------------------------------------------------------- trie


@dataclass
class _Node:
    test: Test
    edges: dict[bool, list] = field(default_factory=lambda: {True: [], False: []})


@dataclass(frozen=True)
class _Leaf:
    key: str


def _insert(children: list, path: Path_, leaf: _Leaf) -> None:
    for test, pol in path:
        node = next((c for c in children if isinstance(c, _Node) and c.test == test), None)
        if node is None:
            node = _Node(test)
            children.append(node)
        children = node.edges[pol]
    if leaf not in children:
        children.append(leaf)


# ------------------------------------------------------------------------ render


def _esc(text: str) -> str:
    return text.replace('"', "#quot;").replace("<", "#lt;").replace(">", "#gt;")


def _test_label(test: Test) -> str:
    if isinstance(test, Atom) and test.op == "eq" and test.value is True:
        return f"{test.fact}?"
    if isinstance(test, RuleRef):
        return f"{test.id} applies?"
    return describe(test) + "?"


class _Diagram:
    def __init__(self, title: str):
        self.title = title
        self.roots: list = []
        self.anchors: dict[str, list] = {}  # leaf key -> children hanging off it
        self.leaves: dict[str, str] = {}  # leaf key -> node definition
        self.extra: list[str] = []  # extra edges/nodes (requires, overrides)

    def add_path(self, path: Path_, leaf: _Leaf) -> None:
        if path and isinstance(path[0][0], RuleRef) and path[0][1]:
            anchor = "r_" + path[0][0].id
            if anchor in self.leaves:
                _insert(self.anchors.setdefault(anchor, []), path[1:], leaf)
                return
        _insert(self.roots, path, leaf)

    def render(self) -> str:
        lines = [HEADER, "flowchart TD", f'  start(["{_esc(self.title)}"])']
        counter = iter(range(1, 10_000))

        def emit(src: str, label: str | None, children: list) -> None:
            arrow = f"-->|{label}|" if label else "-->"
            switches = _switches(children)
            for child in children:
                if isinstance(child, _Leaf):
                    lines.append(f"  {src} {arrow} {child.key}")
                    continue
                if id(child) in switches:
                    fact, members = switches[id(child)]
                    if child is not members[0]:
                        continue
                    nid = f"n{next(counter)}"
                    lines.append(f'  {nid}{{"{_esc(fact)}?"}}')
                    lines.append(f"  {src} {arrow} {nid}")
                    for m in members:
                        emit(nid, _esc(_value_label(m.test)), m.edges[True])
                    continue
                nid = f"n{next(counter)}"
                shape = '{{"%s"}}' if isinstance(child.test, MacroRef) else '{"%s"}'
                lines.append(f"  {nid}{shape % _esc(_test_label(child.test))}")
                lines.append(f"  {src} {arrow} {nid}")
                emit(nid, "yes", child.edges[True])
                emit(nid, "no", child.edges[False])

        emit("start", None, self.roots)
        for anchor, children in self.anchors.items():
            emit(anchor, "then", children)
        lines.extend(f"  {d}" for d in self.leaves.values())
        lines.extend(self.extra)
        used = {m for d in self.leaves.values() for m in re.findall(r":::(\w+)$", d)}
        used |= {m for d in self.extra for m in re.findall(r":::(\w+)$", d)}
        lines.extend(f"  classDef {c} {CLASS_DEFS[c]}" for c in CLASS_DEFS if c in used)
        return "\n".join(lines) + "\n"

    def node_count(self) -> int:
        text = self.render()
        return len(re.findall(r"^  (?:n\d+|r_\w+|s_\w+|o_\w+|start)[\[\{\(]", text, re.M))


def _switches(children: list) -> dict[int, tuple[str, list[_Node]]]:
    """Sibling yes-only tests on one enum fact, drawn as a single multi-way diamond.

    Returns {id(node): (fact, members)} for every node that joins a switch.
    """
    groups: dict[str, list[_Node]] = {}
    for c in children:
        if (
            isinstance(c, _Node)
            and isinstance(c.test, Atom)
            and c.test.op in ("eq", "in")
            and not isinstance(c.test.value, bool)
            and not c.edges[False]
        ):
            groups.setdefault(c.test.fact, []).append(c)
    return {id(m): (f, ms) for f, ms in groups.items() if len(ms) > 1 for m in ms}


def _value_label(test: Test) -> str:
    assert isinstance(test, Atom)
    value = test.value
    return ", ".join(value) if isinstance(value, tuple) else str(value)


def _rule_node(rs: RuleSet, rid: str) -> str:
    rule = rs.by_id[rid]
    label = f"{_esc(rule.title)}<br/><i>{rid}</i>"
    if rule.effective_from:
        label += f"<br/>from {rule.effective_from.isoformat()}"
    cls = KIND_CLASS[rule.kind]
    shape = '[["%s"]]' if cls == "stop" else '["%s"]'
    return f"r_{rid}{shape % label}:::{cls}"


def _rule_paths(rule_when: Cond | None, env: Env) -> list[Path_]:
    residual = True if rule_when is None else simplify(rule_when, env)
    return clean(dnf(residual))


def _add_rule_extras(d: _Diagram, rs: RuleSet, rids: list[str]) -> set[str]:
    """Dashed `requires` edges between rules in this diagram, and override notes.

    Returns macro names used by override conditions.
    """
    macros: set[str] = set()
    for rid in rids:
        rule = rs.by_id[rid]
        # Group requirements (e.g. property_permission) would tie most rules
        # to most others; only direct ones are drawn.
        for dep in (r for r in rule.requires if not r.startswith("group:")):
            if dep in rids:
                d.extra.append(f"  r_{dep} -.->|before| r_{rid}")
        for i, ov in enumerate(rule.lead_time.overrides if rule.lead_time else (), 1):
            macros |= {t.name for t in tests_in(ov.when) if isinstance(t, MacroRef)}
            text = f"if {describe(ov.when)}: lead time {ov.min_days} days"
            nid = f"o_{rid}_{i}"
            d.extra.append(f'  {nid}[/"{_esc(text)}"/]:::note')
            d.extra.append(f"  r_{rid} -.- {nid}")
    return macros


def section_diagram(rs: RuleSet, sid: str) -> tuple[_Diagram, set[str]]:
    section = rs.sections[sid]
    env = _DiagramEnv(rs, section_domains(rs, section.entry))
    d = _Diagram(f"{sid} · {section.title}")
    rids = [r.id for r in rs.rules if sid in r.section]
    # Define every leaf first so "rule X applies" paths can anchor on X.
    for rid in rids:
        d.leaves["r_" + rid] = _rule_node(rs, rid)
    for rid in rids:
        rule = rs.by_id[rid]
        for path in _rule_paths(rule.when, env):
            d.add_path(path, _Leaf("r_" + rid))
    override_macros = _add_rule_extras(d, rs, rids)
    return d, env.opaque_macros | override_macros


def overview_diagram(rs: RuleSet) -> tuple[_Diagram, set[str]]:
    d, macros = section_diagram(rs, "00")
    env = _DiagramEnv(rs)
    for sid, section in rs.sections.items():
        if sid == "00":
            continue
        key = f"s_{sid}"
        d.leaves[key] = f'{key}(["{sid} · {_esc(section.title)}"]):::section'
        for path in _rule_paths(section.entry, env):
            d.add_path(path, _Leaf(key))
    return d, macros | env.opaque_macros


def macro_diagram(rs: RuleSet, name: str) -> _Diagram:
    env = _InlineEnv(rs)
    d = _Diagram(f"macro · {name}")
    key = f"m_{name}"
    d.leaves[key] = f'{key}(["✓ {name}"]):::exemption'
    for path in clean(dnf(simplify(MacroRef(name), env))):
        d.add_path(path, _Leaf(key))
    return d


def _slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", text.lower()).strip("_")


def generate(rs: RuleSet) -> dict[str, str]:
    """{filename: content} for every diagram plus README.md."""
    files: dict[str, str] = {}
    sections: list[tuple[str, str, str]] = []  # (heading, filename, source)
    macros: set[str] = set()

    d, used = overview_diagram(rs)
    macros |= used
    sections.append(("00 · Overview", "00_overview.mmd", d.render()))
    for sid, section in rs.sections.items():
        if sid == "00":
            continue
        d, used = section_diagram(rs, sid)
        macros |= used
        sections.append(
            (f"{sid} · {section.title}", f"{sid}_{_slug(section.title)}.mmd", d.render())
        )

    # Only macros too big to inline get a diagram of their own.
    inline_env = _InlineEnv(rs)
    for name in sorted(macros):
        full = simplify(MacroRef(name), inline_env)
        if not isinstance(full, bool) and _atom_count(full) > MAX_INLINE_ATOMS:
            src = macro_diagram(rs, name).render()
            sections.append((f"Macro · {name}", f"macro_{name}.mmd", src))

    readme = [
        "# Event permit rule diagrams",
        "",
        "Generated from `backend/app/engine/rules.yaml`. Do not edit by hand;",
        "regenerate with `cd backend && python -m app.engine.diagrams`.",
        "",
        "Diamonds are questions, hexagons are macros (each drawn further down), and",
        "boxes are rules, colored by kind. Dashed `before` edges mean one approval",
        "must come first (group requirements such as `property_permission` are not",
        "drawn); `then` edges hang rules that depend on another rule applying. A",
        "diamond with several `yes` edges means every branch is checked.",
        "",
    ]
    for heading, filename, src in sections:
        files[filename] = src
        body = "\n".join(line for line in src.splitlines() if not line.startswith("%%"))
        readme += [
            f"## {heading}",
            "",
            f"[`{filename}`]({filename})",
            "",
            "```mermaid",
            body,
            "```",
            "",
        ]
    files["README.md"] = "\n".join(readme)
    return files


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--rules", type=Path, default=None, help="rules YAML (default: bundled)")
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    parser.add_argument("--check", action="store_true", help="fail if --out is stale")
    args = parser.parse_args(argv)

    rs = load(args.rules) if args.rules else load()
    files = generate(rs)
    existing = (
        {p.name for p in args.out.glob("*") if p.suffix in (".mmd", ".md")}
        if args.out.exists()
        else set()
    )
    stale = sorted(existing - set(files))

    if args.check:
        changed = [
            n
            for n, s in files.items()
            if not (args.out / n).exists() or (args.out / n).read_text() != s
        ]
        if changed or stale:
            print("diagrams are stale:", *changed, *stale, sep="\n  ", file=sys.stderr)
            return 1
        return 0

    args.out.mkdir(parents=True, exist_ok=True)
    for name in stale:
        (args.out / name).unlink()
    for name, src in files.items():
        (args.out / name).write_text(src)
    print(f"wrote {len(files)} files to {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
