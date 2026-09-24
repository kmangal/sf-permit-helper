"""LLM prompts, kept as JSON templates beside this module.

Each `templates/<name>.json` holds {"system": ..., "user": ...}; the user
prompt has `str.format` fields filled per call.

    prompt = load(PromptName.CLARIFY)
    llm.stream(prompt.render(context=..., question=...), system=prompt.system)

Every PromptName member names exactly one template file, and every file has a
member.
"""

import json
from dataclasses import dataclass
from functools import cache
from pathlib import Path

from .catalog import PromptName

TEMPLATES_DIR = Path(__file__).parent / "templates"


@dataclass(frozen=True)
class Prompt:
    system: str
    user: str

    def render(self, **values: object) -> str:
        """The user prompt with its fields filled in."""
        return self.user.format(**values)


def path(name: PromptName) -> Path:
    return TEMPLATES_DIR / f"{name}.json"


@cache
def load(name: PromptName) -> Prompt:
    data = json.loads(path(name).read_text(encoding="utf-8"))
    if set(data) != {"system", "user"}:
        raise ValueError(f"{path(name)} must have exactly 'system' and 'user', got {sorted(data)}")
    return Prompt(system=data["system"], user=data["user"])
