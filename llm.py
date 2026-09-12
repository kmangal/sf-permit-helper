import anthropic
from dotenv import load_dotenv
from pydantic import BaseModel

load_dotenv()


class LLMClient:
    def __init__(self, model: str = "claude-sonnet-5"):
        self.client = anthropic.AsyncAnthropic()
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
        return next(
            block.text for block in response.content if block.type == "text"
        )

    async def parse[T: BaseModel](
        self,
        prompt: str,
        output_format: type[T],
        *,
        system: str | None = None,
    ) -> tuple[T, anthropic.types.Message]:
        kwargs: dict = {
            "model": self.model,
            "max_tokens": 16000,
            "messages": [{"role": "user", "content": prompt}],
            "thinking": {"type": "adaptive"},
            "output_format": output_format,
        }
        if system:
            kwargs["system"] = system

        response = await self.client.messages.parse(**kwargs)
        return response.parsed_output, response
