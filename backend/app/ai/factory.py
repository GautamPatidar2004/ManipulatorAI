from typing import Optional
from app.ai.adapters.gemini import GeminiAdapter
from app.ai.adapters.groq import GroqAdapter
from app.ai.adapters.openai import OpenAIAdapter
from app.ai.base import BaseAIProvider
from app.ai.exceptions import AIConfigurationError, AIMissingKeyError
from app.config import Settings, get_settings


def get_ai_provider(settings: Optional[Settings] = None) -> Optional[BaseAIProvider]:
    """
    Factory function resolving and instantiating the configured AI provider.
    Returns None if AI_PROVIDER is 'none'.
    Raises AIMissingKeyError or AIConfigurationError if provider credentials are invalid.
    """
    cfg = settings or get_settings()
    provider_name = cfg.AI_PROVIDER.lower().strip()

    if provider_name == "none":
        return None

    if provider_name == "gemini":
        if not cfg.GEMINI_API_KEY or not cfg.GEMINI_API_KEY.strip():
            raise AIMissingKeyError("gemini")
        return GeminiAdapter(
            api_key=cfg.GEMINI_API_KEY.strip(),
            model=cfg.GEMINI_MODEL,
            timeout_seconds=cfg.AI_TIMEOUT_SECONDS,
        )

    if provider_name == "groq":
        if not cfg.GROQ_API_KEY or not cfg.GROQ_API_KEY.strip():
            raise AIMissingKeyError("groq")
        return GroqAdapter(
            api_key=cfg.GROQ_API_KEY.strip(),
            model=cfg.GROQ_MODEL,
            timeout_seconds=cfg.AI_TIMEOUT_SECONDS,
        )

    if provider_name == "openai":
        if not cfg.OPENAI_API_KEY or not cfg.OPENAI_API_KEY.strip():
            raise AIMissingKeyError("openai")
        return OpenAIAdapter(
            api_key=cfg.OPENAI_API_KEY.strip(),
            model=cfg.OPENAI_MODEL,
            timeout_seconds=cfg.AI_TIMEOUT_SECONDS,
        )

    raise AIConfigurationError(f"Unsupported AI provider '{provider_name}'. Supported: gemini, groq, openai, none.")
