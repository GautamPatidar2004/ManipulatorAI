import uuid
from datetime import datetime, timezone
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from app.cli.create_admin import provision_admin
from app.db.session import get_session_factory
from app.main import create_application
from app.models.conversation import Conversation
from app.models.feedback import MessageFeedback
from app.models.memory import UserMemory
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


def get_auth_token(client: TestClient, email: str, password: str, name: str) -> str:
    res = client.post(
        "/api/v1/auth/signup",
        json={"email": email, "password": password, "full_name": name},
    )
    if res.status_code == 201:
        return res.json()["access_token"]
    # If already exists, login
    login_res = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    return login_res.json()["access_token"]


def test_admin_dashboard_requires_admin_authorization(client, db_session):
    # 1. Unauthenticated request rejected
    unauth_res = client.get("/api/v1/admin/dashboard")
    assert unauth_res.status_code == 401

    # 2. Standard user rejected with 403
    user_email = f"user_{uuid.uuid4().hex[:8]}@example.com"
    token = get_auth_token(client, user_email, "UserPassword123!", "Standard User")
    forbidden_res = client.get(
        "/api/v1/admin/dashboard",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert forbidden_res.status_code == 403


def test_admin_dashboard_returns_kpi_cards_and_analytics(client, db_session):
    # 1. Provision an Admin
    admin_email = f"admin_{uuid.uuid4().hex[:8]}@example.com"
    admin_user = provision_admin(
        email=admin_email,
        password="AdminPassword123!",
        full_name="Lead Admin",
    )
    assert admin_user.role == "admin"

    login_res = client.post(
        "/api/v1/auth/login",
        json={"email": admin_email, "password": "AdminPassword123!"},
    )
    assert login_res.status_code == 200
    admin_token = login_res.json()["access_token"]

    # 2. Query Dashboard
    dash_res = client.get(
        "/api/v1/admin/dashboard",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert dash_res.status_code == 200
    data = dash_res.json()

    # 3. Check 5 KPI cards
    assert "kpis" in data
    kpis = data["kpis"]
    assert "total_registered_users" in kpis
    assert kpis["total_registered_users"] >= 1
    assert "active_users" in kpis
    assert "total_conversations" in kpis
    assert "pending_escalations" in kpis
    assert isinstance(kpis["pending_escalations"], int) or kpis["pending_escalations"] is None
    assert "collected_feedback_count" in kpis

    # 4. Check Visual Analytics: Conversation Trends
    assert "conversation_trends" in data
    assert isinstance(data["conversation_trends"], list)

    # 5. Check Visual Analytics: Parent vs Learner Engagement
    assert "engagement_by_persona" in data
    personas = data["engagement_by_persona"]
    assert len(personas) == 2
    for p in personas:
        assert p["data_available"] is False
        assert "not separated" in p["note"].lower() or "not tracked" in p["note"].lower()

    # 6. Check Visual Analytics: 5 Concern Categories
    assert "concern_categories" in data
    categories = {c["category"]: c for c in data["concern_categories"]}
    expected_categories = {"income", "job_security", "social_status", "safety", "education"}
    assert expected_categories.issubset(categories.keys())
    for cat_name in expected_categories:
        assert categories[cat_name]["data_available"] is True
        assert "source_description" in categories[cat_name]

    # 7. Check Feedback sentiment breakdown
    assert "feedback_breakdown" in data
    fb = data["feedback_breakdown"]
    assert "helpful" in fb
    assert "unhelpful" in fb

    # 8. Check Schema Transparency and Data Sources
    assert "filters" in data
    assert data["filters"]["date_range_available"] is True
    assert len(data["data_sources"]) > 0
    assert len(data["missing_metrics"]) > 0


def test_admin_dashboard_date_range_filtering(client, db_session):
    admin_email = f"admin_{uuid.uuid4().hex[:8]}@example.com"
    provision_admin(
        email=admin_email,
        password="AdminPassword123!",
        full_name="Range Admin",
    )
    login_res = client.post(
        "/api/v1/auth/login",
        json={"email": admin_email, "password": "AdminPassword123!"},
    )
    admin_token = login_res.json()["access_token"]

    # Filter by date far in the past
    past_res = client.get(
        "/api/v1/admin/dashboard?start_date=2020-01-01&end_date=2020-01-02",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert past_res.status_code == 200
    past_data = past_res.json()
    assert past_data["kpis"]["total_conversations"] == 0
    assert past_data["kpis"]["collected_feedback_count"] == 0
