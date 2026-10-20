from typing import List
import httpx
from app.rag.embeddings.base import BaseEmbeddingProvider
from app.rag.exceptions import EmbeddingProviderError, IncompatibleEmbeddingDimensionError


class GeminiEmbeddingProvider(BaseEmbeddingProvider):
    """Embedding provider using Google Gemini's embedContent REST API."""

    BASE_URL = "https://generativelanguage.googleapis.com/v1beta"

    def __init__(
        self,
        api_key: str,
        model_name: str = "text-embedding-004",
        dimension: int = 768,
        timeout_seconds: float = 20.0,
    ):
        super().__init__(model_name=model_name, dimension=dimension)
        self.api_key = api_key
        self.timeout_seconds = timeout_seconds

    @property
    def provider_name(self) -> str:
        return "gemini"

    async def embed_text(self, text: str) -> List[float]:
        url = f"{self.BASE_URL}/models/{self.model_name}:embedContent"
        params = {"key": self.api_key}
        payload = {
            "model": f"models/{self.model_name}",
            "content": {
                "parts": [{"text": text}],
            },
        }

        try:
            async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
                res = await client.post(url, params=params, json=payload)

            if res.status_code != 200:
                raise EmbeddingProviderError(
                    provider=self.provider_name,
                    message=f"Gemini embedding request failed with HTTP {res.status_code}.",
                )

            data = res.json()
            embedding_obj = data.get("embedding", {})
            values = embedding_obj.get("values", [])

            if len(values) != self.dimension:
                raise IncompatibleEmbeddingDimensionError(
                    expected_dim=self.dimension,
                    actual_dim=len(values),
                    model=self.model_name,
                )
            return values

        except (EmbeddingProviderError, IncompatibleEmbeddingDimensionError):
            raise
        except Exception as exc:
            raise EmbeddingProviderError(
                provider=self.provider_name,
                message=f"Connection to Gemini embedding endpoint failed: {type(exc).__name__}",
            )

    async def embed_batch(self, texts: List[str]) -> List[List[float]]:
        # Batch embedding sequentially or gather
        results = []
        for text in texts:
            vec = await self.embed_text(text)
            results.append(vec)
        return results
