from typing import List, Optional
import httpx
from app.ai.base import BaseAIProvider
from app.ai.exceptions import (
    AIAuthenticationError,
    AIMalformedResponseError,
    AIProviderError,
    AIRateLimitError,
    AITimeoutError,
)
from app.ai.types import AIMessage, AIResponse


class GroqAdapter(BaseAIProvider):
    """Adapter for Groq Cloud API (OpenAI-compatible chat completions)."""

    BASE_URL = "https://api.groq.com/openai/v1"

    @property
    def provider_name(self) -> str:
        return "groq"

    async def generate_reply(
        self,
        messages: List[AIMessage],
        system_prompt: Optional[str] = None,
    ) -> AIResponse:
        url = f"{self.BASE_URL}/chat/completions"

        chat_messages = []
        if system_prompt:
            chat_messages.append({"role": "system", "content": system_prompt})

        for msg in messages:
            chat_messages.append({
                "role": msg.role,
                "content": msg.content,
            })

        payload = {
            "model": self.model,
            "messages": chat_messages,
        }

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        try:
            async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
                res = await client.post(url, json=payload, headers=headers)

            if res.status_code == 429:
                retry_after = res.headers.get("Retry-After")
                raise AIRateLimitError(
                    provider=self.provider_name,
                    retry_after=int(retry_after) if retry_after and retry_after.isdigit() else None,
                )
            elif res.status_code in (401, 403):
                raise AIAuthenticationError(provider=self.provider_name)
            elif res.status_code >= 400:
                raise AIProviderError(
                    provider=self.provider_name,
                    message=f"Groq service returned HTTP {res.status_code}.",
                )

            data = res.json()
            choices = data.get("choices")
            if not choices or not isinstance(choices, list):
                raise AIMalformedResponseError(provider=self.provider_name)

            first_choice = choices[0]
            message_obj = first_choice.get("message", {})
            reply_text = message_obj.get("content", "").strip()
            if not reply_text:
                raise AIMalformedResponseError(provider=self.provider_name)

            finish_reason = first_choice.get("finish_reason")
            usage_raw = data.get("usage", {})

            return AIResponse(
                content=reply_text,
                model=self.model,
                provider=self.provider_name,
                finish_reason=finish_reason,
                tokens_used={
                    "prompt_tokens": usage_raw.get("prompt_tokens", 0),
                    "completion_tokens": usage_raw.get("completion_tokens", 0),
                    "total_tokens": usage_raw.get("total_tokens", 0),
                } if usage_raw else None,
            )

        except httpx.TimeoutException:
            raise AITimeoutError(provider=self.provider_name, timeout_seconds=self.timeout_seconds)
        except (AIRateLimitError, AIAuthenticationError, AIProviderError, AIMalformedResponseError):
            raise
        except Exception as exc:
            raise AIProviderError(
                provider=self.provider_name,
                message=f"Connection to Groq service failed: {type(exc).__name__}",
            )
