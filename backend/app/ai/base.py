from abc import ABC, abstractmethod
from typing import List, Optional
from app.ai.types import AIMessage, AIResponse


class BaseAIProvider(ABC):
    """Abstract base class for all AI provider adapters."""

    def __init__(self, api_key: str, model: str, timeout_seconds: float = 30.0):
        self.api_key = api_key
        self.model = model
        self.timeout_seconds = timeout_seconds

    @property
    @abstractmethod
    def provider_name(self) -> str:
        """Normalized provider identifier, e.g. 'gemini', 'groq', 'openai'."""
        pass

    @abstractmethod
    async def generate_reply(
        self,
        messages: List[AIMessage],
        system_prompt: Optional[str] = None,
    ) -> AIResponse:
        """
        Generate a normalized assistant reply given a chronological history of messages.
        Must raise subclasses of AIError on failure without exposing credentials.
        """
        pass
