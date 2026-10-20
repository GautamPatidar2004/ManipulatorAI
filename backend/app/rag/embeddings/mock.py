import hashlib
import math
import re
from typing import List
from app.rag.embeddings.base import BaseEmbeddingProvider


class MockEmbeddingProvider(BaseEmbeddingProvider):
    """
    Deterministic, offline embedding provider for testing and zero-cost local operation.
    Produces unit-normalized dense vectors of exact dimension where semantic word overlap
    correlates with cosine similarity.
    """

    def __init__(self, model_name: str = "career-embed-384", dimension: int = 384):
        super().__init__(model_name=model_name, dimension=dimension)

    @property
    def provider_name(self) -> str:
        return "mock"

    def _generate_vector(self, text: str) -> List[float]:
        vec = [0.0] * self.dimension
        clean = text.lower().strip()
        tokens = re.findall(r"\w+", clean)

        if not tokens:
            tokens = ["empty"]

        for idx, token in enumerate(tokens):
            h = int(hashlib.sha256(token.encode("utf-8")).hexdigest(), 16)
            dim_idx = h % self.dimension
            weight = 1.0 + (1.0 / (idx + 1))
            vec[dim_idx] += weight

        # Normalize to unit length (L2 norm)
        norm = math.sqrt(sum(x * x for x in vec))
        if norm > 0:
            vec = [x / norm for x in vec]
        else:
            vec[0] = 1.0

        return vec

    async def embed_text(self, text: str) -> List[float]:
        return self._generate_vector(text)

    async def embed_batch(self, texts: List[str]) -> List[List[float]]:
        return [self._generate_vector(t) for t in texts]
