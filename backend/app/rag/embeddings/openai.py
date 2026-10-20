from typing import List
import httpx
from app.rag.embeddings.base import BaseEmbeddingProvider
from app.rag.exceptions import EmbeddingProviderError, IncompatibleEmbeddingDimensionError


class OpenAIEmbeddingProvider(BaseEmbeddingProvider):
    """Embedding provider using OpenAI's /v1/embeddings API."""

    BASE_URL = "https://api.openai.com/v1"

    def __init__(
        self,
        api_key: str,
        model_name: str = "text-embedding-3-small",
        dimension: int = 1536,
        timeout_seconds: float = 20.0,
    ):
        super().__init__(model_name=model_name, dimension=dimension)
        self.api_key = api_key
        self.timeout_seconds = timeout_seconds

    @property
    def provider_name(self) -> str:
        return "openai"

    async def embed_batch(self, texts: List[str]) -> List[List[float]]:
        url = f"{self.BASE_URL}/embeddings"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": self.model_name,
            "input": texts,
        }

        try:
            async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
                res = await client.post(url, json=payload, headers=headers)

            if res.status_code != 200:
                raise EmbeddingProviderError(
                    provider=self.provider_name,
                    message=f"OpenAI embedding request failed with HTTP {res.status_code}.",
                )

            data = res.json()
            items = data.get("data", [])
            # Sort by index to maintain ordering
            items_sorted = sorted(items, key=lambda x: x.get("index", 0))
            vectors = [item["embedding"] for item in items_sorted]

            for vec in vectors:
                if len(vec) != self.dimension:
                    raise IncompatibleEmbeddingDimensionError(
                        expected_dim=self.dimension,
                        actual_dim=len(vec),
                        model=self.model_name,
                    )
            return vectors

        except (EmbeddingProviderError, IncompatibleEmbeddingDimensionError):
            raise
        except Exception as exc:
            raise EmbeddingProviderError(
                provider=self.provider_name,
                message=f"Connection to OpenAI embedding endpoint failed: {type(exc).__name__}",
            )

    async def embed_text(self, text: str) -> List[float]:
        results = await self.embed_batch([text])
        return results[0]
