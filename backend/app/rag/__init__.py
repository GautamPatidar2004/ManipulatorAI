"""RAG package with pgvector storage, embeddings, and evidence retrieval."""

from app.rag.embeddings.base import BaseEmbeddingProvider
from app.rag.embeddings.factory import get_embedding_provider
from app.rag.embeddings.mock import MockEmbeddingProvider
from app.rag.exceptions import (
    EmbeddingProviderError,
    IncompatibleEmbeddingDimensionError,
    IncompatibleEmbeddingModelError,
    RAGError,
)
from app.rag.service import RAGService
from app.rag.types import RAGChunkResult, RAGRetrievalResult
from app.rag.vector_store import VectorStore

__all__ = [
    "BaseEmbeddingProvider",
    "MockEmbeddingProvider",
    "get_embedding_provider",
    "VectorStore",
    "RAGService",
    "RAGChunkResult",
    "RAGRetrievalResult",
    "RAGError",
    "IncompatibleEmbeddingDimensionError",
    "IncompatibleEmbeddingModelError",
    "EmbeddingProviderError",
]
