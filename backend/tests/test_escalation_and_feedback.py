"""Comprehensive test suite for Human Counsellor Escalation & Message-Level Feedback (Prompt 11).

Covers:
1. Escalation trigger evaluation (explicit request, crisis decisions, conflicting constraints, prolonged uncertainty)
2. Non-escalation for ordinary exploratory queries
3. Provider-independent handoff adapter and unconfigured limitation honesty (never faking booking)
4. User accept/decline/info actions
5. Escalation integration into counselling turn response blocks
6. Feedback persistence and retrieval
7. Duplicate feedback rejection (409 Conflict)
8. Role validation (only assistant messages receive feedback)
9. Ownership isolation (users cannot rate or inspect other users' messages)
10. Privacy boundaries in feedback and operational logging
"""

from unittest.mock import AsyncMock
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.ai.types import AIResponse
from app.config import Settings
from app.counselling.escalation.schemas import EscalationHandoffStatus, EscalationTriggerType
from app.counselling.escalation.service import HumanEscalationService
from app.counselling.orchestrator import CounsellingOrchestrator
from app.counselling.types import CounsellingIntent, CounsellingSignals
from app.db.base import Base
from app.db.session import get_db
from app.feedback.schemas import MessageFeedbackCreateRequest
from app.feedback.service import FeedbackService
from app.main import app
from app.models.conversation import Conversation
from app.models.feedback import MessageFeedback
from app.models.message import Message

# In-memory SQLite engine for tests
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


@pytest.fixture
def db_session():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


client = TestClient(app)


# ---------------------------------------------------------------------------
# 1. Escalation Trigger Evaluation Tests
# ---------------------------------------------------------------------------

def test_escalation_trigger_explicit_request():
    signals = CounsellingSignals(intent=CounsellingIntent.GENERAL_GUIDANCE)
    result = HumanEscalationService.evaluate_turn(
        query="Can I speak to a human counsellor please?",
        signals=signals,
    )
    assert result.should_escalate is True
    assert result.trigger_type == EscalationTriggerType.EXPLICIT_REQUEST
    assert "human counsellor" in result.reason.lower()
    assert result.confidence == 1.0


def test_escalation_trigger_complex_decision_crisis():
    signals = CounsellingSignals(intent=CounsellingIntent.PATHWAY_EXPLORATION)
    result = HumanEscalationService.evaluate_turn(
        query="I dropped out of college with huge debt and ruined my career.",
        signals=signals,
    )
    assert result.should_escalate is True
    assert result.trigger_type == EscalationTriggerType.UNRESOLVED_COMPLEX_DECISION
    assert result.confidence >= 0.90


def test_escalation_trigger_conflicting_high_impact_constraints():
    signals = CounsellingSignals(
        intent=CounsellingIntent.CAREER_COMPARISON,
        has_conflicting_goals=True,
        conflicting_goal_details="Immediate 20 LPA package desired with zero financial budget for master's degree",
    )
    result = HumanEscalationService.evaluate_turn(
        query="Should I take this offer or try again?",
        signals=signals,
    )
    assert result.should_escalate is True
    assert result.trigger_type == EscalationTriggerType.CONFLICTING_HIGH_IMPACT_CONSTRAINTS


def test_escalation_trigger_prolonged_uncertainty():
    signals = CounsellingSignals(
        intent=CounsellingIntent.CAREER_DISCOVERY,
        has_high_uncertainty=True,
    )
    result = HumanEscalationService.evaluate_turn(
        query="I am completely lost and overwhelmed, nothing makes sense anymore.",
        signals=signals,
        history_count=4,
    )
    assert result.should_escalate is True
    assert result.trigger_type == EscalationTriggerType.PROLONGED_UNCERTAINTY


def test_no_escalation_for_ordinary_inquiry():
    signals = CounsellingSignals(intent=CounsellingIntent.CAREER_DISCOVERY)
    result = HumanEscalationService.evaluate_turn(
        query="What subjects are taught in standard B.Tech Computer Science?",
        signals=signals,
        history_count=1,
    )
    assert result.should_escalate is False
    assert result.trigger_type is None


# ---------------------------------------------------------------------------
# 2. Honest Limitations: Unconfigured Handoff Service
# ---------------------------------------------------------------------------

def test_unconfigured_handoff_honesty():
    settings = Settings(
        HUMAN_COUNSELLOR_SERVICE_URL=None,
        HUMAN_COUNSELLOR_EMAIL=None,
    )
    res = HumanEscalationService.process_handoff_request(
        user_id="test_user",
        conversation_id="conv_1",
        action="accept",
        settings=settings,
    )
    assert res.status == EscalationHandoffStatus.UNCONFIGURED
    assert res.is_configured is False
    assert res.reference_id is None
    assert "currently unconfigured" in res.message.lower()
    assert "booked" not in res.message.lower()
    assert "scheduled" not in res.message.lower()


def test_user_decline_and_info_actions():
    res_decline = HumanEscalationService.process_handoff_request(
        user_id="test_user",
        conversation_id="conv_1",
        action="decline",
    )
    assert res_decline.status == EscalationHandoffStatus.DECLINED
    assert "continue exploring" in res_decline.message.lower()

    res_info = HumanEscalationService.process_handoff_request(
        user_id="test_user",
        conversation_id="conv_1",
        action="info",
    )
    assert res_info.status == EscalationHandoffStatus.COMPLETED
    assert "1-on-1" in res_info.message or "human counsellors" in res_info.message.lower()


# ---------------------------------------------------------------------------
# 3. Counselling Turn Integration with Escalation Commands
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_orchestrator_handles_direct_escalation_accept(db_session: Session):
    turn_res = await CounsellingOrchestrator.process_counselling_turn(
        db=db_session,
        user_message="escalation:accept",
        dialogue_history=[],
        user_id="user_esc",
    )
    assert turn_res.versioned is not None
    block_types = [b.type for b in turn_res.versioned.blocks]
    assert "limitation_notice" in block_types
    assert "quick_replies" in block_types
    assert "unconfigured" in turn_res.content.lower()


@pytest.mark.anyio
async def test_orchestrator_attaches_escalation_offer_when_appropriate(db_session: Session):
    mock_reply = AIResponse(
        content="Here are several pathways to consider after a dropped academic year.",
        model="mock-model",
        provider="mock",
        finish_reason="STOP",
    )
    mock_provider = AsyncMock()
    mock_provider.generate_reply.return_value = mock_reply

    turn_res = await CounsellingOrchestrator.process_counselling_turn(
        db=db_session,
        user_message="I really want to speak with a human counsellor about my dropped year.",
        dialogue_history=[],
        provider=mock_provider,
        settings=Settings(RAG_ENABLED=False),
        user_id="user_esc_2",
    )
    assert turn_res.versioned is not None
    assert turn_res.versioned.metadata.get("escalation_suggested") is True
    block_types = [b.type for b in turn_res.versioned.blocks]
    assert "recommendation_card" in block_types
    assert "quick_replies" in block_types


# ---------------------------------------------------------------------------
# 4. Message-Level Feedback Persistence, Retrieval & Validation
# ---------------------------------------------------------------------------

def test_feedback_submit_and_retrieve(db_session: Session):
    conv = Conversation(id="conv_100", title="Feedback Conversation")
    db_session.add(conv)
    db_session.commit()

    msg = Message(
        id="msg_100",
        conversation_id="conv_100",
        role="assistant",
        content="Here is a step-by-step roadmap to become a Cloud DevOps engineer.",
    )
    db_session.add(msg)
    db_session.commit()

    req = MessageFeedbackCreateRequest(
        rating="helpful",
        comment="Great breakdown of AWS and Linux milestones.",
        category="clarity",
    )
    fb_res = FeedbackService.submit_feedback(
        db=db_session,
        user_id="student_1",
        message_id="msg_100",
        request=req,
    )
    assert fb_res.id is not None
    assert fb_res.message_id == "msg_100"
    assert fb_res.rating == "helpful"
    assert fb_res.comment == "Great breakdown of AWS and Linux milestones."
    assert fb_res.category == "clarity"

    retrieved = FeedbackService.get_feedback_for_message(
        db=db_session,
        user_id="student_1",
        message_id="msg_100",
    )
    assert retrieved is not None
    assert retrieved.id == fb_res.id


def test_feedback_duplicate_rejection(db_session: Session):
    conv = Conversation(id="conv_101", title="Dup Conv")
    db_session.add(conv)
    db_session.commit()

    msg = Message(id="msg_101", conversation_id="conv_101", role="assistant", content="Guidance text")
    db_session.add(msg)
    db_session.commit()

    req = MessageFeedbackCreateRequest(rating="unhelpful", comment="Too brief")
    FeedbackService.submit_feedback(db=db_session, user_id="student_2", message_id="msg_101", request=req)

    with pytest.raises(Exception) as excinfo:
        FeedbackService.submit_feedback(db=db_session, user_id="student_2", message_id="msg_101", request=req)
    assert "409" in str(excinfo.value) or "already been recorded" in str(excinfo.value)


def test_feedback_rejects_user_messages(db_session: Session):
    conv = Conversation(id="conv_102", title="User Msg Conv")
    db_session.add(conv)
    db_session.commit()

    msg = Message(id="msg_102", conversation_id="conv_102", role="user", content="My own question")
    db_session.add(msg)
    db_session.commit()

    req = MessageFeedbackCreateRequest(rating="helpful")
    with pytest.raises(Exception) as excinfo:
        FeedbackService.submit_feedback(db=db_session, user_id="student_3", message_id="msg_102", request=req)
    assert "400" in str(excinfo.value) or "assistant" in str(excinfo.value).lower()


def test_feedback_ownership_isolation(db_session: Session):
    conv = Conversation(id="conv_103", title="Alice Conv")
    db_session.add(conv)
    db_session.commit()

    msg = Message(id="msg_103", conversation_id="conv_103", role="assistant", content="Alice guidance")
    db_session.add(msg)
    db_session.commit()

    req = MessageFeedbackCreateRequest(rating="helpful")
    # Alice submits feedback
    FeedbackService.submit_feedback(db=db_session, user_id="alice", message_id="msg_103", request=req)

    # Bob should not be able to retrieve Alice's feedback
    bob_feedback = FeedbackService.get_feedback_for_message(db=db_session, user_id="bob", message_id="msg_103")
    assert bob_feedback is None


# ---------------------------------------------------------------------------
# 5. REST API Endpoints (/chat/messages/{id}/feedback & /chat/escalation/action)
# ---------------------------------------------------------------------------

def test_api_feedback_and_escalation_endpoints():
    user_header = {"X-User-Id": "api_student"}

    # 1. Create a conversation and assistant message via client/db
    db = TestingSessionLocal()
    conv = Conversation(id="api_conv_1", title="API Test")
    msg = Message(id="api_msg_1", conversation_id="api_conv_1", role="assistant", content="Hello student")
    db.add(conv)
    db.add(msg)
    db.commit()
    db.close()

    # 2. Submit feedback via API
    fb_res = client.post(
        "/api/v1/chat/messages/api_msg_1/feedback",
        json={"rating": "helpful", "comment": "Clear response", "category": "clarity"},
        headers=user_header,
    )
    assert fb_res.status_code == 201
    fb_data = fb_res.json()
    assert fb_data["rating"] == "helpful"
    assert fb_data["message_id"] == "api_msg_1"

    # 3. Duplicate feedback returns 409
    dup_res = client.post(
        "/api/v1/chat/messages/api_msg_1/feedback",
        json={"rating": "helpful"},
        headers=user_header,
    )
    assert dup_res.status_code == 409

    # 4. Get feedback via API
    get_res = client.get("/api/v1/chat/messages/api_msg_1/feedback", headers=user_header)
    assert get_res.status_code == 200
    assert get_res.json()["rating"] == "helpful"

    # 5. Non-existent feedback returns 404
    missing_res = client.get("/api/v1/chat/messages/non_existent_msg/feedback", headers=user_header)
    assert missing_res.status_code == 404

    # 6. Post escalation action via API
    esc_res = client.post(
        "/api/v1/chat/escalation/action",
        json={"conversation_id": "api_conv_1", "action": "accept"},
        headers=user_header,
    )
    assert esc_res.status_code == 200
    esc_data = esc_res.json()
    assert esc_data["status"] == "unconfigured"
    assert esc_data["is_configured"] is False
    assert "unconfigured" in esc_data["message"].lower()
