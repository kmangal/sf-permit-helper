from openrouter import OpenRouter

from ..environment import get_environment


class OpenRouterLlmClient:
    def __init__(self, model: str = "anthropic/claude-haiku-4.5"):
        self.client = OpenRouter(
            api_key=get_environment().openrouter_api_key.get_secret_value(),
        )
        self.model = model

    async def complete(
        self,
        prompt: str,
        *,
        system: str | None = None,
    ) -> str:
        messages: list = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})

        response = await self.client.chat.send_async(
            model=self.model,
            messages=messages,
            max_tokens=5000,
        )
        content = response.choices[0].message.content
        if isinstance(content, str):
            return content
        # Content can also arrive as a list of parts; keep only the text ones.
        return "".join(getattr(part, "text", "") for part in content or [])


async def test() -> None:

    client = OpenRouterLlmClient()

    response = await client.complete("Say 'hello' and nothing else.")

    print(f"Response: {response}")

    assert response, "Empty response from LLM"


if __name__ == "__main__":
    # Run smoke test to make sure the LLM call works
    import asyncio

    asyncio.run(test())
