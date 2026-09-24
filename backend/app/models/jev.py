from collections.abc import Mapping

from typesafe_sdk import (
    AsyncTypeSafeClient,
    Choice,
    JSONContent,
    Question,
    RetryPolicy,
    SystemOneResponse,
)

from ..environment import get_environment


class OpenRouterJevClient:
    """Wrapper around the TypeSafe SDK for asking the jev model structured questions.

    Uses OPENROUTER_API_KEY from the environment.
    """

    BASE_URL = "https://openrouter.ai/api"
    MODEL = "jev-1.13"

    def __init__(self) -> None:
        self._env = get_environment()

    def _client(self) -> AsyncTypeSafeClient:
        return AsyncTypeSafeClient(
            api_key=self._env.openrouter_api_key.get_secret_value(),
            model=self.MODEL,
            base_url=self.BASE_URL,
            timeout=20.0,
            retry=RetryPolicy(max_retries=2),
        )

    async def ask(
        self,
        state: JSONContent,
        questions: Mapping[str, Question],
    ) -> SystemOneResponse:
        """Answer several named questions about `state` in a single request."""
        async with self._client() as client:
            return await client.system_one(state=state, questions=questions)

    async def choose(self, state: JSONContent, name: str, question: Choice) -> dict[str, float]:
        """Probability of each label of one choice question."""
        response = await self.ask(state, {name: question})
        return dict(response.choices[name].probabilities)
