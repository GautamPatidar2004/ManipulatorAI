from typing import Any, Optional
from fastapi import status
from app.core.errors import AppError


class RAGError(AppError):
    """Base exception for RAG and embedding operations."""

    def __init__(
        self,
        message: str = "An error occurred during RAG operation.",
        code: str = "RAG_ERROR",
        status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR,
        details: Optional[Any] = None,
    ):
        super().__init__(message=message, code=code, status_code=status_code, details=details)


class IncompatibleEmbeddingDimensionError(RAGError):
    """Raised when an embedding vector length does not match the configured model dimension."""

    def __init__(self, expected_dim: int, actual_dim: int, model: str):
        super().__init__(
            message=f"Embedding dimension mismatch for model '{model}': expected {expected_dim}, got {actual_dim}.",
            code="INCOMPATIBLE_EMBEDDING_DIMENSION",
            status_code=status.HTTP_400_BAD_REQUEST,
            details={"model": model, "expected_dim": expected_dim, "actual_dim": actual_dim},
        )


class IncompatibleEmbeddingModelError(RAGError):
    """Raised when querying a vector index with a different embedding model than the indexed chunks."""

    def __init__(self, target_model: str, query_model: str):
        super().__init__(
            message=f"Cannot mix incompatible embedding models: query uses '{query_model}', while chunks use '{target_model}'.",
            code="INCOMPATIBLE_EMBEDDING_MODEL",
            status_code=status.HTTP_400_BAD_REQUEST,
            details={"target_model": target_model, "query_model": query_model},
        )


class EmbeddingProviderError(RAGError):
    """Raised when an external embedding provider fails."""

    def __init__(self, provider: str, message: Optional[str] = None):
        super().__init__(
            message=message or f"Embedding generation failed for provider '{provider}'.",
            code="EMBEDDING_PROVIDER_ERROR",
            status_code=status.HTTP_502_BAD_GATEWAY,
            details={"provider": provider},
        )
