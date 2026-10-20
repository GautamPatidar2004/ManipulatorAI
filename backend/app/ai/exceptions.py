from typing import Any, Optional
from fastapi import status
from app.core.errors import AppError


class AIError(AppError):
    """Base class for all AI provider exceptions."""

    def __init__(
        self,
        message: str = "An error occurred during AI processing.",
        code: str = "AI_ERROR",
        status_code: int = status.HTTP_502_BAD_GATEWAY,
        details: Optional[Any] = None,
    ):
        super().__init__(message=message, code=code, status_code=status_code, details=details)


class AIMissingKeyError(AIError):
    """Raised when the active provider API key is missing or blank."""

    def __init__(self, provider: str):
        super().__init__(
            message=f"API key for provider '{provider}' is not configured. Please set the matching environment variable in backend/.env.",
            code="AI_MISSING_API_KEY",
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            details={"provider": provider, "status": "unconfigured"},
        )


class AIConfigurationError(AIError):
    """Raised when the AI provider configuration is invalid."""

    def __init__(self, message: str):
        super().__init__(
            message=message,
            code="AI_CONFIGURATION_ERROR",
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            details={"status": "invalid_configuration"},
        )


class AIRateLimitError(AIError):
    """Raised when the provider rejects the request due to rate limiting or quota exhaustion (429)."""

    def __init__(
        self,
        provider: str,
        retry_after: Optional[int] = None,
        message: Optional[str] = None,
        details: Optional[Any] = None,
    ):
        info = {"provider": provider, "retry_after": retry_after}
        if isinstance(details, dict):
            info.update(details)
        super().__init__(
            message=message or f"The AI provider ({provider}) rate limit was exceeded. Please wait a moment before sending another message.",
            code="AI_RATE_LIMIT_EXCEEDED",
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            details=info,
        )


class AITimeoutError(AIError):
    """Raised when a provider request exceeds the timeout threshold."""

    def __init__(self, provider: str, timeout_seconds: float):
        super().__init__(
            message=f"The request to AI provider '{provider}' timed out after {timeout_seconds}s. Please retry your question.",
            code="AI_TIMEOUT",
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            details={"provider": provider, "timeout_seconds": timeout_seconds},
        )


class AIAuthenticationError(AIError):
    """Raised when provider rejects credentials (401/403)."""

    def __init__(
        self,
        provider: str,
        message: Optional[str] = None,
        details: Optional[Any] = None,
    ):
        info = {"provider": provider}
        if isinstance(details, dict):
            info.update(details)
        super().__init__(
            message=message or f"Authentication with AI provider '{provider}' failed. Please verify your API key.",
            code="AI_AUTHENTICATION_FAILED",
            status_code=status.HTTP_502_BAD_GATEWAY,
            details=info,
        )


class AIProviderError(AIError):
    """Raised when the provider service returns a 5xx or unexpected error."""

    def __init__(self, provider: str, message: Optional[str] = None):
        super().__init__(
            message=message or f"AI provider '{provider}' encountered a service error. Please try again later.",
            code="AI_PROVIDER_ERROR",
            status_code=status.HTTP_502_BAD_GATEWAY,
            details={"provider": provider},
        )


class AIMalformedResponseError(AIError):
    """Raised when the provider returns unparseable or empty candidates."""

    def __init__(self, provider: str):
        super().__init__(
            message=f"Received a malformed or empty response from AI provider '{provider}'.",
            code="AI_MALFORMED_RESPONSE",
            status_code=status.HTTP_502_BAD_GATEWAY,
            details={"provider": provider},
        )
