"""LLM prompts, kept as JSON templates in `templates/`; see `loader`."""

from .loader import TEMPLATES_DIR, Prompt, PromptName, load

__all__ = ["TEMPLATES_DIR", "Prompt", "PromptName", "load"]
