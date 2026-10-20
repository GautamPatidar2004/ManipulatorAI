import pytest
from unittest.mock import AsyncMock, patch
import httpx
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.ai import (
    AIMessage,
    AIResponse,
    GeminiAdapter,
    GroqAdapter,
    OpenAIAdapter,
    get_ai_provider,
)
from app.ai.exceptions import (
    AIAuthenticationError,
    AIMalformedResponseError,
    AIMissingKeyError,
    AIProviderError,
    AIRateLimitError,
    AITimeoutError,
)
from app.api.routes.chat import get_db
from app.config import Settings
from app.db.base import Base
from app.main import app

# ---------------------------------------------------------------------------
# Test Fixtures & In-Memory DB setup
# ---------------------------------------------------------------------------

test_engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(autouse=True)
def setup_database():
    Base.metadata.create_all(bind=test_engine)
    app.dependency_overrides[get_db] = override_get_db
    yield
    Base.metadata.drop_all(bind=test_engine)
    app.dependency_overrides.clear()


client = TestClient(app)


# ---------------------------------------------------------------------------
# 1. Gemini Adapter Unit Tests (Mocked)
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_gemini_adapter_success():
    adapter = GeminiAdapter(api_key="mock_gemini_key", model="gemini-1.5-flash", timeout_seconds=10.0)

    mock_json = {
        "candidates": [
            {
                "content": {
                    "role": "model",
                    "parts": [{"text": "Targeting cloud architect roles requires hands-on distributed systems skills."}],
                },
                "finishReason": "STOP",
            }
        ],
        "usageMetadata": {
            "promptTokenCount": 15,
            "candidatesTokenCount": 25,
            "totalTokenCount": 40,
        },
    }

    mock_resp = httpx.Response(200, json=mock_json, request=httpx.Request("POST", "https://mock"))

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock, return_value=mock_resp):
        messages = [AIMessage(role="user", content="How do I become a cloud architect?")]
        response = await adapter.generate_reply(messages=messages, system_prompt="You are a career guide.")

    assert response.provider == "gemini"
    assert response.model == "gemini-1.5-flash"
    assert "Targeting cloud architect" in response.content
    assert response.finish_reason == "STOP"
    assert response.tokens_used["total_tokens"] == 40


@pytest.mark.anyio
async def test_gemini_adapter_rate_limit_429():
    adapter = GeminiAdapter(api_key="mock_key", model="gemini-1.5-flash")
    mock_resp = httpx.Response(429, headers={"Retry-After": "15"}, request=httpx.Request("POST", "https://mock"))

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock, return_value=mock_resp):
        with pytest.raises(AIRateLimitError) as exc_info:
            await adapter.generate_reply([AIMessage(role="user", content="Test")])

    assert exc_info.value.code == "AI_RATE_LIMIT_EXCEEDED"
    assert exc_info.value.status_code == 429


@pytest.mark.anyio
async def test_gemini_adapter_timeout():
    adapter = GeminiAdapter(api_key="mock_key", model="gemini-1.5-flash", timeout_seconds=5.0)

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock, side_effect=httpx.TimeoutException("Timeout")):
        with pytest.raises(AITimeoutError) as exc_info:
            await adapter.generate_reply([AIMessage(role="user", content="Test")])

    assert exc_info.value.code == "AI_TIMEOUT"
    assert exc_info.value.status_code == 504


@pytest.mark.anyio
async def test_gemini_adapter_auth_error():
    adapter = GeminiAdapter(api_key="bad_key", model="gemini-1.5-flash")
    mock_resp = httpx.Response(401, request=httpx.Request("POST", "https://mock"))

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock, return_value=mock_resp):
        with pytest.raises(AIAuthenticationError) as exc_info:
            await adapter.generate_reply([AIMessage(role="user", content="Test")])

    assert exc_info.value.code == "AI_AUTHENTICATION_FAILED"
    assert "bad_key" not in str(exc_info.value)  # Ensures key is not leaked


@pytest.mark.anyio
async def test_gemini_adapter_malformed_response():
    adapter = GeminiAdapter(api_key="mock_key", model="gemini-1.5-flash")
    mock_resp = httpx.Response(200, json={"candidates": []}, request=httpx.Request("POST", "https://mock"))

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock, return_value=mock_resp):
        with pytest.raises(AIMalformedResponseError):
            await adapter.generate_reply([AIMessage(role="user", content="Test")])


# ---------------------------------------------------------------------------
# 2. Groq Adapter Unit Tests (Mocked)
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_groq_adapter_success():
    adapter = GroqAdapter(api_key="mock_groq_key", model="llama-3.3-70b-versatile")

    mock_json = {
        "choices": [
            {
                "message": {
                    "role": "assistant",
                    "content": "Focus on high-leverage architectural designs for staff promotion.",
                },
                "finish_reason": "stop",
            }
        ],
        "usage": {
            "prompt_tokens": 10,
            "completion_tokens": 20,
            "total_tokens": 30,
        },
    }

    mock_resp = httpx.Response(200, json=mock_json, request=httpx.Request("POST", "https://mock"))

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock, return_value=mock_resp):
        messages = [AIMessage(role="user", content="Staff engineer progression advice")]
        response = await adapter.generate_reply(messages=messages)

    assert response.provider == "groq"
    assert "Focus on high-leverage" in response.content
    assert response.tokens_used["total_tokens"] == 30


@pytest.mark.anyio
async def test_groq_adapter_rate_limit():
    adapter = GroqAdapter(api_key="mock_key", model="llama-3.3-70b-versatile")
    mock_resp = httpx.Response(429, request=httpx.Request("POST", "https://mock"))

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock, return_value=mock_resp):
        with pytest.raises(AIRateLimitError):
            await adapter.generate_reply([AIMessage(role="user", content="Test")])


# ---------------------------------------------------------------------------
# 3. OpenAI Adapter Unit Tests (Mocked)
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_openai_adapter_success():
    adapter = OpenAIAdapter(api_key="mock_openai_key", model="gpt-4o-mini")

    mock_json = {
        "choices": [
            {
                "message": {
                    "role": "assistant",
                    "content": "Strategic resume framing requires quantifying business impact.",
                },
                "finish_reason": "stop",
            }
        ],
        "usage": {
            "prompt_tokens": 12,
            "completion_tokens": 18,
            "total_tokens": 30,
        },
    }

    mock_resp = httpx.Response(200, json=mock_json, request=httpx.Request("POST", "https://mock"))

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock, return_value=mock_resp):
        response = await adapter.generate_reply([AIMessage(role="user", content="Resume advice")])

    assert response.provider == "openai"
    assert "quantifying business impact" in response.content


# ---------------------------------------------------------------------------
# 4. Factory & Configuration Tests
# ---------------------------------------------------------------------------

def test_factory_none_provider():
    settings = Settings(AI_PROVIDER="none")
    assert get_ai_provider(settings) is None


def test_factory_missing_api_key():
    settings = Settings(AI_PROVIDER="gemini", GEMINI_API_KEY="")
    with pytest.raises(AIMissingKeyError) as exc_info:
        get_ai_provider(settings)
    assert exc_info.value.code == "AI_MISSING_API_KEY"


def test_factory_valid_gemini():
    settings = Settings(AI_PROVIDER="gemini", GEMINI_API_KEY="test_key_gemini")
    provider = get_ai_provider(settings)
    assert isinstance(provider, GeminiAdapter)
    assert provider.provider_name == "gemini"


def test_factory_valid_groq():
    settings = Settings(AI_PROVIDER="groq", GROQ_API_KEY="test_key_groq")
    provider = get_ai_provider(settings)
    assert isinstance(provider, GroqAdapter)
    assert provider.provider_name == "groq"


def test_factory_valid_openai():
    settings = Settings(AI_PROVIDER="openai", OPENAI_API_KEY="test_key_openai")
    provider = get_ai_provider(settings)
    assert isinstance(provider, OpenAIAdapter)
    assert provider.provider_name == "openai"


# ---------------------------------------------------------------------------
# 5. End-to-End Chat Turn Integration (Mocked AI Provider)
# ---------------------------------------------------------------------------

def test_chat_turn_with_configured_provider():
    """Verify chat turn calls active provider and persists user & assistant responses."""
    mock_ai_response = AIResponse(
        content="Here is a concrete 3-step action roadmap for your transition.",
        model="gemini-1.5-flash",
        provider="gemini",
        finish_reason="STOP",
        tokens_used={"total_tokens": 50},
    )

    with patch("app.services.chat_service.get_ai_provider") as mock_get_provider:
        mock_adapter = AsyncMock()
        mock_adapter.generate_reply.return_value = mock_ai_response
        mock_get_provider.return_value = mock_adapter

        resp = client.post(
            "/api/v1/chat/message",
            json={"message": "I want to transition from backend to AI engineering."},
        )

    assert resp.status_code == 200
    data = resp.json()
    assert data["role"] == "assistant"
    assert data["status"] == "ready"
    assert "3-step action roadmap" in data["content"]
    assert "Generated via gemini" in data["notice"]

    # Verify conversation history persisted in DB
    conv_id = data["session_id"]
    msgs_res = client.get(f"/api/v1/chat/conversations/{conv_id}/messages")
    assert msgs_res.status_code == 200
    saved = msgs_res.json()["messages"]
    assert len(saved) == 2
    assert saved[0]["role"] == "user"
    assert saved[1]["role"] == "assistant"
    assert saved[1]["status"] == "ready"


def test_chat_turn_with_provider_rate_limit_rollback():
    """Verify provider error safely rolls back and returns 429 without duplicate persistence."""
    with patch("app.services.chat_service.get_ai_provider") as mock_get_provider:
        mock_adapter = AsyncMock()
        mock_adapter.generate_reply.side_effect = AIRateLimitError("groq", retry_after=10)
        mock_get_provider.return_value = mock_adapter

        resp = client.post(
            "/api/v1/chat/message",
            json={"message": "High frequency query"},
        )

    assert resp.status_code == 429
    err = resp.json()
    assert err["error"]["code"] == "AI_RATE_LIMIT_EXCEEDED"
    assert "rate limit was exceeded" in err["error"]["message"]
