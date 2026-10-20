from typing import Optional
from app.config import Settings, get_settings
from app.rag.embeddings.base import BaseEmbeddingProvider
from app.rag.embeddings.gemini import GeminiEmbeddingProvider
from app.rag.embeddings.mock import MockEmbeddingProvider
from app.rag.embeddings.openai import OpenAIEmbeddingProvider


def get_embedding_provider(settings: Optional[Settings] = None) -> BaseEmbeddingProvider:
    """
    Factory resolving active embedding provider.
    Defaults to MockEmbeddingProvider for offline, deterministic, zero-cost operation.
    """
    cfg = settings or get_settings()
    provider_name = cfg.EMBEDDING_PROVIDER.lower().strip()

    if provider_name == "openai" and cfg.OPENAI_API_KEY:
        return OpenAIEmbeddingProvider(
            api_key=cfg.OPENAI_API_KEY.strip(),
            model_name=cfg.EMBEDDING_MODEL,
            dimension=cfg.EMBEDDING_DIM,
            timeout_seconds=cfg.AI_TIMEOUT_SECONDS,
        )

    if provider_name == "gemini" and cfg.GEMINI_API_KEY:
        return GeminiEmbeddingProvider(
            api_key=cfg.GEMINI_API_KEY.strip(),
            model_name=cfg.EMBEDDING_MODEL,
            dimension=cfg.EMBEDDING_DIM,
            timeout_seconds=cfg.AI_TIMEOUT_SECONDS,
        )

    # Default fallback / Mock
    return MockEmbeddingProvider(
        model_name=cfg.EMBEDDING_MODEL,
        dimension=cfg.EMBEDDING_DIM,
    )
