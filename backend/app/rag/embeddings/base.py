from abc import ABC, abstractmethod
from typing import List


class BaseEmbeddingProvider(ABC):
    """Abstract interface for provider-independent text embedding generation."""

    def __init__(self, model_name: str, dimension: int):
        self.model_name = model_name
        self.dimension = dimension

    @property
    @abstractmethod
    def provider_name(self) -> str:
        pass

    @abstractmethod
    async def embed_text(self, text: str) -> List[float]:
        """Generate a normalized dense float vector for a single text string."""
        pass

    @abstractmethod
    async def embed_batch(self, texts: List[str]) -> List[List[float]]:
        """Generate normalized dense float vectors for multiple text strings."""
        pass
