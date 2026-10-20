import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.routes.chat import get_db
from app.db.base import Base
from app.main import app

# In-memory SQLite engine for testing database models and transactional semantics
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


def test_health_check_endpoint():
    """Verify health check endpoint returns expected schema."""
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert "CareerCompass" in data["app_name"]
    assert "database" in data
    assert "connected" in data["database"]


def test_create_and_list_conversations():
    """Verify conversation creation and listing with message counts."""
    create_res = client.post(
        "/api/v1/chat/conversations",
        json={"title": "Career Pivot to Cloud"},
    )
    assert create_res.status_code == 201
    created = create_res.json()
    assert created["title"] == "Career Pivot to Cloud"
    conv_id = created["id"]

    list_res = client.get("/api/v1/chat/conversations")
    assert list_res.status_code == 200
    conversations = list_res.json()["conversations"]
    assert len(conversations) >= 1
    assert conversations[0]["id"] == conv_id
    assert conversations[0]["message_count"] == 0


def test_rename_and_delete_conversation():
    """Verify renaming a conversation and deleting with cascade."""
    create_res = client.post(
        "/api/v1/chat/conversations",
        json={"title": "Original Title"},
    )
    conv_id = create_res.json()["id"]

    # Rename
    patch_res = client.patch(
        f"/api/v1/chat/conversations/{conv_id}",
        json={"title": "Updated Strategy Discussion"},
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["title"] == "Updated Strategy Discussion"

    # Delete
    del_res = client.delete(f"/api/v1/chat/conversations/{conv_id}")
    assert del_res.status_code == 204

    # Verify 404 after deletion
    get_res = client.get(f"/api/v1/chat/conversations/{conv_id}/messages")
    assert get_res.status_code == 404
    assert get_res.json()["error"]["code"] == "NOT_FOUND"


def test_persist_and_retrieve_messages():
    """Verify explicit message persistence and chronological ordering."""
    create_res = client.post(
        "/api/v1/chat/conversations",
        json={"title": "Resume Review"},
    )
    conv_id = create_res.json()["id"]

    # Add message
    msg_res = client.post(
        f"/api/v1/chat/conversations/{conv_id}/messages",
        json={"role": "user", "content": "How do I format leadership accomplishments?"},
    )
    assert msg_res.status_code == 201
    msg_data = msg_res.json()
    assert msg_data["conversation_id"] == conv_id
    assert msg_data["role"] == "user"

    # Retrieve messages
    list_msgs = client.get(f"/api/v1/chat/conversations/{conv_id}/messages")
    assert list_msgs.status_code == 200
    messages = list_msgs.json()["messages"]
    assert len(messages) == 1
    assert messages[0]["content"] == "How do I format leadership accomplishments?"


def test_chat_turn_endpoint_persistence():
    """Verify chat turn persists both user message and assistant message."""
    turn_res = client.post(
        "/api/v1/chat/message",
        json={"message": "I am exploring transition paths into AI leadership."},
    )
    assert turn_res.status_code == 200
    resp_data = turn_res.json()
    assert resp_data["role"] == "assistant"
    assert resp_data["status"] in ("ready", "unavailable")
    conv_id = resp_data["session_id"]

    # Verify both messages are saved in database
    msgs_res = client.get(f"/api/v1/chat/conversations/{conv_id}/messages")
    assert msgs_res.status_code == 200
    saved_msgs = msgs_res.json()["messages"]
    assert len(saved_msgs) == 2
    assert saved_msgs[0]["role"] == "user"
    assert saved_msgs[0]["content"] == "I am exploring transition paths into AI leadership."
    assert saved_msgs[1]["role"] == "assistant"
    assert saved_msgs[1]["status"] in ("ready", "unavailable")


def test_user_memory_foundation():
    """Verify user memory fact persistence, retrieval and monotonic version tracking."""
    # 1. Record fact
    mem_res1 = client.post(
        "/api/v1/chat/memory",
        json={
            "key": "target_role",
            "value": "Staff Software Engineer",
            "category": "career_goals",
            "source": "onboarding_dialogue",
            "confidence": 0.95,
        },
    )
    assert mem_res1.status_code == 201
    data1 = mem_res1.json()
    assert data1["key"] == "target_role"
    assert data1["value"] == "Staff Software Engineer"
    assert data1["version"] == 1
    assert data1["is_active"] is True

    # 2. Update fact with new value
    mem_res2 = client.post(
        "/api/v1/chat/memory",
        json={
            "key": "target_role",
            "value": "Principal AI Architect",
            "category": "career_goals",
            "source": "followup_dialogue",
            "confidence": 1.0,
        },
    )
    assert mem_res2.status_code == 201
    data2 = mem_res2.json()
    assert data2["key"] == "target_role"
    assert data2["value"] == "Principal AI Architect"
    assert data2["version"] == 2

    # 3. List active memories
    list_mem = client.get("/api/v1/chat/memory")
    assert list_mem.status_code == 200
    active_mems = list_mem.json()
    assert len(active_mems) == 1
    assert active_mems[0]["value"] == "Principal AI Architect"


def test_payload_validation_errors():
    """Verify validation errors return structured 422 JSON."""
    empty_msg_res = client.post(
        "/api/v1/chat/message",
        json={"message": ""},
    )
    assert empty_msg_res.status_code == 422
    err_data = empty_msg_res.json()
    assert err_data["error"]["code"] == "VALIDATION_ERROR"
