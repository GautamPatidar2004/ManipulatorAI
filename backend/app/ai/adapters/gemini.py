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


class GeminiAdapter(BaseAIProvider):
    """Adapter for Google Gemini REST API."""

    BASE_URL = "https://generativelanguage.googleapis.com/v1beta"

    @property
    def provider_name(self) -> str:
        return "gemini"

    async def generate_reply(
        self,
        messages: List[AIMessage],
        system_prompt: Optional[str] = None,
    ) -> AIResponse:
        url = f"{self.BASE_URL}/models/{self.model}:generateContent"

        # Transform normalized messages to Gemini contents structure
        contents = []
        for msg in messages:
            # Gemini maps assistant -> model
            gemini_role = "model" if msg.role == "assistant" else "user"
            contents.append({
                "role": gemini_role,
                "parts": [{"text": msg.content}],
            })

        payload = {"contents": contents}
        if system_prompt:
            payload["systemInstruction"] = {
                "parts": [{"text": system_prompt}]
            }

        try:
            async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
                res = await client.post(
                    url,
                    params={"key": self.api_key},
                    json=payload,
                    headers={"Content-Type": "application/json"},
                )

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
                    message=f"Gemini service returned HTTP {res.status_code}.",
                )

            data = res.json()
            candidates = data.get("candidates")
            if not candidates or not isinstance(candidates, list):
                raise AIMalformedResponseError(provider=self.provider_name)

            first_candidate = candidates[0]
            parts = first_candidate.get("content", {}).get("parts", [])
            if not parts:
                raise AIMalformedResponseError(provider=self.provider_name)

            reply_text = parts[0].get("text", "").strip()
            if not reply_text:
                raise AIMalformedResponseError(provider=self.provider_name)

            finish_reason = first_candidate.get("finishReason")
            usage_raw = data.get("usageMetadata", {})

            return AIResponse(
                content=reply_text,
                model=self.model,
                provider=self.provider_name,
                finish_reason=finish_reason,
                tokens_used={
                    "prompt_tokens": usage_raw.get("promptTokenCount", 0),
                    "completion_tokens": usage_raw.get("candidatesTokenCount", 0),
                    "total_tokens": usage_raw.get("totalTokenCount", 0),
                } if usage_raw else None,
            )

        except httpx.TimeoutException:
            raise AITimeoutError(provider=self.provider_name, timeout_seconds=self.timeout_seconds)
        except (AIRateLimitError, AIAuthenticationError, AIProviderError, AIMalformedResponseError):
            raise
        except Exception as exc:
            raise AIProviderError(
                provider=self.provider_name,
                message=f"Connection to Gemini service failed: {type(exc).__name__}",
            )
