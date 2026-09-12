import asyncio

from llm import LLMClient


async def main():
    client = LLMClient()
    response = await client.complete("Say 'hello' and nothing else.")
    print(f"Response: {response}")
    assert response, "Empty response from LLM"
    print("Smoke test passed.")


if __name__ == "__main__":
    asyncio.run(main())
