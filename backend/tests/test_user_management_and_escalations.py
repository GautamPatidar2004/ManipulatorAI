import uuid
from datetime import datetime, timezone
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from app.cli.create_admin import provision_admin
from app.db.session import get_session_factory
from app.main import create_application
from app.models.conversation import Conversation
from app.models.escalation import EscalationCase
from app.models.message import Message
from app.models.user import User


@pytest.fixture
def client():
    app = create_application()
    return TestClient(app)


@pytest.fixture
def db_session():
    factory = get_session_factory()
    with factory() as db:
        yield db


def create_test_user(client: TestClient, role: str = "user") -> tuple[User, str]:
    unique_email = f"user_{uuid.uuid4().hex[:8]}@careercompass.ai"
    password = "UserPassword123!"
    if role == "admin":
        user = provision_admin(
            email=unique_email,
            password=password,
            full_name="Staff Administrator",
        )
    else:
        res = client.post(
            "/api/v1/auth/signup",
            json={"email": unique_email, "password": password, "full_name": "Student User"},
        )
        assert res.status_code == 201

    login_res = client.post(
        "/api/v1/auth/login",
        json={"email": unique_email, "password": password},
    )
    token = login_res.json()["access_token"]
    factory = get_session_factory()
    with factory() as db:
        user_db = db.scalar(select(User).where(User.email == unique_email))
    return user_db, token


def test_user_management_search_pagination_and_detail(client, db_session):
    admin_user, admin_token = create_test_user(client, role="admin")
    student_user, _ = create_test_user(client, role="user")

    # Create a conversation for the student
    conv = Conversation(
        id=f"conv_{uuid.uuid4().hex[:8]}",
        title="Engineering Career Exploration",
        user_id=student_user.id,
    )
    db_session.add(conv)
    db_session.commit()

    headers = {"Authorization": f"Bearer {admin_token}"}

    # 1. Search users by email
    search_res = client.get(f"/api/v1/admin/users?q={student_user.email[:10]}", headers=headers)
    assert search_res.status_code == 200
    search_data = search_res.json()
    assert "items" in search_data
    assert any(u["id"] == student_user.id for u in search_data["items"])
    assert search_data["total"] >= 1

    # 2. Get User Detail
    detail_res = client.get(f"/api/v1/admin/users/{student_user.id}", headers=headers)
    assert detail_res.status_code == 200
    detail_data = detail_res.json()
    assert detail_data["user"]["id"] == student_user.id
    assert len(detail_data["conversations"]) >= 1
    assert detail_data["conversations"][0]["id"] == conv.id


def test_user_status_activation_and_self_lockout_defense(client, db_session):
    admin_user, admin_token = create_test_user(client, role="admin")
    student_user, student_token = create_test_user(client, role="user")

    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    student_headers = {"Authorization": f"Bearer {student_token}"}

    # 1. Standard user cannot toggle user status (403 Forbidden)
    forbidden_res = client.patch(
        f"/api/v1/admin/users/{student_user.id}/status",
        json={"is_active": False},
        headers=student_headers,
    )
    assert forbidden_res.status_code == 403

    # 2. Admin safely deactivates student account
    deactivate_res = client.patch(
        f"/api/v1/admin/users/{student_user.id}/status",
        json={"is_active": False},
        headers=admin_headers,
    )
    assert deactivate_res.status_code == 200
    assert deactivate_res.json()["is_active"] is False

    # 3. Admin reactivates student account
    activate_res = client.patch(
        f"/api/v1/admin/users/{student_user.id}/status",
        json={"is_active": True},
        headers=admin_headers,
    )
    assert activate_res.status_code == 200
    assert activate_res.json()["is_active"] is True

    # 4. Self-lockout prevention: Admin cannot deactivate themselves (400 Bad Request)
    self_lock_res = client.patch(
        f"/api/v1/admin/users/{admin_user.id}/status",
        json={"is_active": False},
        headers=admin_headers,
    )
    assert self_lock_res.status_code == 400
    assert "self-lockout" in self_lock_res.text.lower() or "cannot deactivate" in self_lock_res.text.lower()


def test_counsellor_escalation_lifecycle_and_assignment(client, db_session):
    admin_user, admin_token = create_test_user(client, role="admin")
    student_user, student_token = create_test_user(client, role="user")
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # Create a conversation
    conv_id = f"conv_esc_{uuid.uuid4().hex[:8]}"
    conv = Conversation(id=conv_id, title="Crisis Career Decision", user_id=student_user.id)
    db_session.add(conv)
    db_session.commit()

    # 1. User accepts escalation offer -> Creates EscalationCase in pending status
    esc_accept_res = client.post(
        "/api/v1/chat/escalation/action",
        json={
            "conversation_id": conv_id,
            "action": "accept",
            "user_notes": "Extremely confused between medical entrance and coding.",
        },
        headers={"Authorization": f"Bearer {student_token}"},
    )
    assert esc_accept_res.status_code == 200

    # Verify case is in database
    case = db_session.scalar(select(EscalationCase).where(EscalationCase.conversation_id == conv_id))
    assert case is not None
    assert case.status == "pending"
    assert case.user_notes == "Extremely confused between medical entrance and coding."

    # 2. Admin retrieves escalation queue
    list_res = client.get("/api/v1/admin/escalations?status=pending", headers=admin_headers)
    assert list_res.status_code == 200
    list_data = list_res.json()
    assert list_data["pending_count"] >= 1
    assert any(c["id"] == case.id for c in list_data["items"])

    # 3. Forbid assignment to non-admin user (400 Bad Request)
    bad_assign_res = client.patch(
        f"/api/v1/admin/escalations/{case.id}",
        json={"assigned_to": student_user.id},
        headers=admin_headers,
    )
    assert bad_assign_res.status_code == 400
    assert "administrator" in bad_assign_res.text.lower() or "authorized" in bad_assign_res.text.lower()

    # 4. Assign to authorized admin counsellor
    assign_res = client.patch(
        f"/api/v1/admin/escalations/{case.id}",
        json={"assigned_to": admin_user.id, "status": "assigned", "priority": "high"},
        headers=admin_headers,
    )
    assert assign_res.status_code == 200
    assign_data = assign_res.json()
    assert assign_data["status"] == "assigned"
    assert assign_data["priority"] == "high"
    assert assign_data["assigned_to"] == admin_user.id
    assert assign_data["assigned_at"] is not None

    # 5. Advance to in_progress and then resolved with clinical notes
    resolve_res = client.patch(
        f"/api/v1/admin/escalations/{case.id}",
        json={
            "status": "resolved",
            "resolution_notes": "Conducted 1-on-1 career exploration session. Student decided to pursue BCA.",
        },
        headers=admin_headers,
    )
    assert resolve_res.status_code == 200
    resolve_data = resolve_res.json()
    assert resolve_data["status"] == "resolved"
    assert resolve_data["resolved_at"] is not None
    assert "BCA" in resolve_data["resolution_notes"]
