"""LLM prompts, kept as JSON templates in `templates/`; see `loader`."""

from .loader import TEMPLATES, Prompt, PromptName, load

__all__ = ["TEMPLATES", "Prompt", "PromptName", "load"]
