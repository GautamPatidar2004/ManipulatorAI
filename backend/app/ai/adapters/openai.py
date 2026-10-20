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


class OpenAIAdapter(BaseAIProvider):
    """Adapter for OpenAI API."""

    BASE_URL = "https://api.openai.com/v1"

    @property
    def provider_name(self) -> str:
        return "openai"

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

            if res.status_code >= 400:
                raw_msg = f"HTTP {res.status_code} error from OpenAI."
                err_code = None
                err_type = None
                try:
                    err_json = res.json()
                    if isinstance(err_json, dict) and "error" in err_json:
                        err_obj = err_json["error"]
                        if isinstance(err_obj, dict):
                            raw_msg = err_obj.get("message") or raw_msg
                            err_code = err_obj.get("code")
                            err_type = err_obj.get("type")
                        elif isinstance(err_obj, str):
                            raw_msg = err_obj
                except Exception:
                    pass

                # Sanitize error message to ensure no secret tokens or keys leak into logs or client
                safe_msg = str(raw_msg)
                if self.api_key:
                    safe_msg = safe_msg.replace(self.api_key, "[REDACTED]")
                import re
                safe_msg = re.sub(r"sk-[a-zA-Z0-9_\-]{15,}", "[REDACTED]", safe_msg)

                if res.status_code == 429:
                    retry_after = res.headers.get("Retry-After")
                    is_quota = (
                        err_code == "insufficient_quota"
                        or "quota" in safe_msg.lower()
                        or "billing" in safe_msg.lower()
                    )
                    error_desc = (
                        f"OpenAI API quota or billing limit exceeded: {safe_msg}"
                        if is_quota
                        else f"OpenAI rate limit exceeded: {safe_msg}"
                    )
                    raise AIRateLimitError(
                        provider=self.provider_name,
                        retry_after=int(retry_after) if retry_after and retry_after.isdigit() else None,
                        message=error_desc,
                        details={"error_code": err_code, "error_type": err_type, "is_quota_issue": is_quota},
                    )

                if res.status_code in (401, 403):
                    raise AIAuthenticationError(
                        provider=self.provider_name,
                        message=f"OpenAI authentication failed: {safe_msg}. Please check OPENAI_API_KEY in backend/.env.",
                        details={"error_code": err_code, "error_type": err_type},
                    )

                if res.status_code == 404 or err_code == "model_not_found" or "model" in safe_msg.lower():
                    raise AIProviderError(
                        provider=self.provider_name,
                        message=f"OpenAI model access error for model '{self.model}': {safe_msg}",
                    )

                raise AIProviderError(
                    provider=self.provider_name,
                    message=f"OpenAI service returned HTTP {res.status_code}: {safe_msg}",
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
                message=f"Connection to OpenAI service failed: {type(exc).__name__}",
            )
