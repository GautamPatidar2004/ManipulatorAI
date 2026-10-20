import uuid
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from app.cli.create_admin import provision_admin
from app.core.security import decode_access_token
from app.db.session import get_session_factory
from app.main import create_application
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


def get_error_message(res) -> str:
    data = res.json()
    if "error" in data and isinstance(data["error"], dict):
        return data["error"].get("message", "")
    return str(data.get("detail", ""))


def test_signup_creates_user_with_strict_user_role(client, db_session):
    unique_email = f"student_{uuid.uuid4().hex[:8]}@careercompass.ai"
    payload = {
        "email": unique_email,
        "password": "Password123!",
        "full_name": "Aarav Sharma",
    }
    res = client.post("/api/v1/auth/signup", json=payload)
    assert res.status_code == 201, res.text
    data = res.json()

    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == unique_email
    assert data["user"]["full_name"] == "Aarav Sharma"
    assert data["user"]["role"] == "user"

    # Verify token payload
    decoded = decode_access_token(data["access_token"])
    assert decoded is not None
    assert decoded["sub"] == data["user"]["id"]
    assert decoded["role"] == "user"

    # Verify database state
    user = db_session.scalar(select(User).where(User.email == unique_email))
    assert user is not None
    assert user.role == "user"


def test_signup_cannot_escalate_to_admin(client, db_session):
    """Ensure any client payload attempting to inject role='admin' is forced to 'user'."""
    unique_email = f"hacker_{uuid.uuid4().hex[:8]}@careercompass.ai"
    payload = {
        "email": unique_email,
        "password": "HackerPassword123!",
        "full_name": "Suspicious User",
        "role": "admin",  # Malicious escalation attempt
    }
    res = client.post("/api/v1/auth/signup", json=payload)
    assert res.status_code == 201, res.text
    data = res.json()

    assert data["user"]["role"] == "user"

    user = db_session.scalar(select(User).where(User.email == unique_email))
    assert user is not None
    assert user.role == "user"


def test_signup_duplicate_email_rejected(client):
    unique_email = f"dup_{uuid.uuid4().hex[:8]}@careercompass.ai"
    payload = {
        "email": unique_email,
        "password": "Password123!",
        "full_name": "Duplicate Tester",
    }
    res1 = client.post("/api/v1/auth/signup", json=payload)
    assert res1.status_code == 201

    res2 = client.post("/api/v1/auth/signup", json=payload)
    assert res2.status_code == 409
    assert "already exists" in get_error_message(res2)


def test_login_flow(client):
    unique_email = f"login_{uuid.uuid4().hex[:8]}@careercompass.ai"
    signup_payload = {
        "email": unique_email,
        "password": "LoginSecret123!",
        "full_name": "Login Tester",
    }
    signup_res = client.post("/api/v1/auth/signup", json=signup_payload)
    assert signup_res.status_code == 201

    # Valid login
    login_res = client.post(
        "/api/v1/auth/login",
        json={"email": unique_email, "password": "LoginSecret123!"},
    )
    assert login_res.status_code == 200
    login_data = login_res.json()
    assert "access_token" in login_data
    assert login_data["user"]["email"] == unique_email

    # Invalid password
    bad_res = client.post(
        "/api/v1/auth/login",
        json={"email": unique_email, "password": "WrongPassword!"},
    )
    assert bad_res.status_code == 401
    assert "Invalid email or password" in get_error_message(bad_res)

    # Nonexistent email
    no_user_res = client.post(
        "/api/v1/auth/login",
        json={"email": f"nobody_{uuid.uuid4().hex[:8]}@careercompass.ai", "password": "Password123!"},
    )
    assert no_user_res.status_code == 401


def test_protected_routes_unauthenticated_rejected(client):
    res_me = client.get("/api/v1/auth/me")
    assert res_me.status_code == 401

    res_admin = client.get("/api/v1/admin/users")
    assert res_admin.status_code == 401


def test_admin_route_rejects_standard_user(client):
    unique_email = f"student_{uuid.uuid4().hex[:8]}@careercompass.ai"
    signup_payload = {
        "email": unique_email,
        "password": "Password123!",
        "full_name": "Regular Student",
    }
    signup_res = client.post("/api/v1/auth/signup", json=signup_payload)
    assert signup_res.status_code == 201
    token = signup_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # /auth/me should succeed
    me_res = client.get("/api/v1/auth/me", headers=headers)
    assert me_res.status_code == 200
    assert me_res.json()["role"] == "user"

    # /admin/users should be forbidden
    admin_res = client.get("/api/v1/admin/users", headers=headers)
    assert admin_res.status_code == 403
    assert "forbidden" in get_error_message(admin_res).lower()

    # /admin/stats should be forbidden
    stats_res = client.get("/api/v1/admin/stats", headers=headers)
    assert stats_res.status_code == 403


def test_admin_provisioning_and_admin_portal_access(client):
    unique_email = f"admin_{uuid.uuid4().hex[:8]}@careercompass.ai"
    admin_user = provision_admin(
        email=unique_email,
        full_name="Chief Administrator",
        password="AdminMasterPass123!",
    )
    assert admin_user.role == "admin"

    # Authenticate via login
    login_res = client.post(
        "/api/v1/auth/login",
        json={"email": unique_email, "password": "AdminMasterPass123!"},
    )
    assert login_res.status_code == 200
    admin_token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {admin_token}"}

    # Admin access to user list
    users_res = client.get("/api/v1/admin/users", headers=headers)
    assert users_res.status_code == 200
    data = users_res.json()
    assert "users" in data
    assert any(u["email"] == unique_email for u in data["users"])

    # Admin access to system stats
    stats_res = client.get("/api/v1/admin/stats", headers=headers)
    assert stats_res.status_code == 200
    stats = stats_res.json()
    assert "users" in stats
    assert stats["users"]["admins"] >= 1
    assert "knowledge_base" in stats
