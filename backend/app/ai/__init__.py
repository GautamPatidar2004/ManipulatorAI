"""AI multi-provider package with normalized interfaces and adapters."""

from app.ai.adapters.gemini import GeminiAdapter
from app.ai.adapters.groq import GroqAdapter
from app.ai.adapters.openai import OpenAIAdapter
from app.ai.base import BaseAIProvider
from app.ai.exceptions import (
    AIAuthenticationError,
    AIConfigurationError,
    AIError,
    AIMalformedResponseError,
    AIMissingKeyError,
    AIProviderError,
    AIRateLimitError,
    AITimeoutError,
)
from app.ai.factory import get_ai_provider
from app.ai.types import AIMessage, AIResponse

__all__ = [
    "BaseAIProvider",
    "GeminiAdapter",
    "GroqAdapter",
    "OpenAIAdapter",
    "AIMessage",
    "AIResponse",
    "AIError",
    "AIMissingKeyError",
    "AIConfigurationError",
    "AIRateLimitError",
    "AITimeoutError",
    "AIAuthenticationError",
    "AIProviderError",
    "AIMalformedResponseError",
    "get_ai_provider",
]
