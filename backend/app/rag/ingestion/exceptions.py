from typing import Any, Optional
from fastapi import status
from app.core.errors import AppError


class IngestionError(AppError):
    """Base exception for all knowledge document ingestion errors."""

    def __init__(
        self,
        message: str,
        code: str = "INGESTION_ERROR",
        status_code: int = status.HTTP_400_BAD_REQUEST,
        details: Optional[Any] = None,
    ):
        super().__init__(message=message, code=code, status_code=status_code, details=details)


class UnsupportedFileTypeError(IngestionError):
    """Raised when an uploaded document has an unsupported extension or MIME type."""

    def __init__(self, filename: str, extension: str, supported: list[str]):
        super().__init__(
            message=f"File '{filename}' has unsupported extension '{extension}'. Supported types: {', '.join(supported)}.",
            code="UNSUPPORTED_FILE_TYPE",
            status_code=status.HTTP_400_BAD_REQUEST,
            details={"filename": filename, "extension": extension, "supported": supported},
        )


class FileTooLargeError(IngestionError):
    """Raised when an uploaded file exceeds the configured size ceiling."""

    def __init__(self, filename: str, size_bytes: int, max_bytes: int):
        super().__init__(
            message=f"File '{filename}' exceeds maximum allowed size ({size_bytes} > {max_bytes} bytes).",
            code="FILE_TOO_LARGE",
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            details={"filename": filename, "size_bytes": size_bytes, "max_bytes": max_bytes},
        )


class EmptyDocumentError(IngestionError):
    """Raised when a document contains no extractable or readable text."""

    def __init__(self, filename: str):
        super().__init__(
            message=f"File '{filename}' contains no extractable or meaningful text.",
            code="EMPTY_DOCUMENT",
            status_code=status.HTTP_400_BAD_REQUEST,
            details={"filename": filename},
        )


class TextExtractionError(IngestionError):
    """Raised when a document parser fails to extract text from a corrupted/encrypted file."""

    def __init__(self, filename: str, reason: str):
        super().__init__(
            message=f"Failed to extract text from '{filename}': {reason}",
            code="TEXT_EXTRACTION_FAILED",
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            details={"filename": filename, "reason": reason},
        )


class IngestionAuthError(IngestionError):
    """Raised when an unauthorized client attempts to use the ingestion API."""

    def __init__(self, message: str = "Unauthorized ingestion access."):
        super().__init__(
            message=message,
            code="INGESTION_UNAUTHORIZED",
            status_code=status.HTTP_403_FORBIDDEN,
        )
