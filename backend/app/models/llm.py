import anthropic

from ..environment import get_environment


class LLMClient:
    BASE_URL = "https://openrouter.ai/api"

    def __init__(self, model: str = "claude-sonnet-5"):
        self.client = anthropic.AsyncAnthropic(
            api_key=get_environment().openrouter_api_key.get_secret_value(),
            base_url=self.BASE_URL,
        )
        self.model = model

    async def complete(
        self,
        prompt: str,
        *,
        system: str | None = None,
    ) -> str:
        kwargs: dict = {
            "model": self.model,
            "max_tokens": 16000,
            "messages": [{"role": "user", "content": prompt}],
            "thinking": {"type": "adaptive"},
        }
        if system:
            kwargs["system"] = system

        response = await self.client.messages.create(**kwargs)
        return next(block.text for block in response.content if block.type == "text")
