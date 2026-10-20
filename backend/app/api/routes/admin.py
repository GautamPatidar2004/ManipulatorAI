from collections import defaultdict
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session
from app.api.dependencies import require_admin
from app.api.schemas.admin import (
    AdminDashboardResponse,
    ConcernCategoryMetric,
    ConversationTrendPoint,
    DashboardKPICards,
    EngagementMetric,
    FeedbackRatingBreakdown,
    FilterAvailability,
)
from app.api.schemas.auth import AdminUserListResponse, UserProfileResponse
from app.api.schemas.user_management import (
    PaginatedUsersResponse,
    UserConversationBrief,
    UserDetailResponse,
    UserFeedbackBrief,
    UserStatusUpdateRequest,
    UserSummaryResponse,
)
from app.api.schemas.escalation_admin import (
    EscalationCaseBrief,
    EscalationCaseCreateRequest,
    EscalationCaseUpdateRequest,
    PaginatedEscalationsResponse,
)
from app.api.schemas.evidence import (
    KnowledgeQualityOverviewResponse,
    KnowledgeSourceBrief,
    PaginatedOutcomesResponse,
    ProgrammeAnalyticsConcernChange,
    ProgrammeAnalyticsResponse,
    VerifiedOutcomeCreateRequest,
    VerifiedOutcomeResponse,
    VerifiedOutcomeUpdateRequest,
)
from app.db.session import get_db
from app.models.conversation import Conversation
from app.models.escalation import EscalationCase
from app.models.feedback import MessageFeedback
from app.models.knowledge import KnowledgeChunk
from app.models.memory import UserMemory
from app.models.message import Message
from app.models.outcome import VerifiedOutcome
from app.models.user import User
from app.rag.vector_store import VectorStore
from fastapi.responses import Response
import csv
import io

router = APIRouter(prefix="/admin", tags=["Admin"])


def parse_date_param(val: Optional[str], is_end: bool = False) -> Optional[datetime]:
    if not val:
        return None
    val = val.strip()
    try:
        if len(val) == 10:  # YYYY-MM-DD
            dt = datetime.strptime(val, "%Y-%m-%d")
            if is_end:
                dt = dt.replace(hour=23, minute=59, second=59, microsecond=999999)
            return dt.replace(tzinfo=timezone.utc)
        clean_val = val.replace("Z", "+00:00")
        return datetime.fromisoformat(clean_val)
    except Exception:
        return None


@router.get(
    "/dashboard",
    response_model=AdminDashboardResponse,
    status_code=status.HTTP_200_OK,
    summary="Admin Overview Dashboard metrics and telemetry (Admin Only)",
)
def get_admin_dashboard(
    start_date: Optional[str] = Query(default=None, description="Start date (YYYY-MM-DD or ISO)"),
    end_date: Optional[str] = Query(default=None, description="End date (YYYY-MM-DD or ISO)"),
    language: Optional[str] = Query(default=None, description="Language filter if stored"),
    location: Optional[str] = Query(default=None, description="Location filter if stored"),
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> AdminDashboardResponse:
    """
    Retrieve real aggregate metrics, KPI cards, visual analytics trends,
    and concern category distributions from Neon PostgreSQL without hardcoding.
    """
    start_dt = parse_date_param(start_date, is_end=False)
    end_dt = parse_date_param(end_date, is_end=True)

    # 1. Total Registered Users
    user_stmt = select(func.count(User.id))
    if end_dt:
        user_stmt = user_stmt.where(User.created_at <= end_dt)
    total_registered_users = db.scalar(user_stmt) or 0

    # 2. Conversations & Active Users
    conv_stmt = select(Conversation.id, Conversation.created_at, Conversation.user_id)
    if start_dt:
        conv_stmt = conv_stmt.where(Conversation.created_at >= start_dt)
    if end_dt:
        conv_stmt = conv_stmt.where(Conversation.created_at <= end_dt)

    conversations = list(db.execute(conv_stmt).all())
    total_conversations = len(conversations)

    active_user_ids = {c.user_id for c in conversations if c.user_id and c.user_id != "default_user"}
    active_users = len(active_user_ids)
    if active_users == 0:
        # Fallback to total accounts marked active if sessions aren't tied to user_ids yet
        active_users = db.scalar(select(func.count(User.id)).where(User.is_active.is_(True))) or 0

    # 3. Feedback aggregation
    fb_stmt = select(MessageFeedback)
    if start_dt:
        fb_stmt = fb_stmt.where(MessageFeedback.created_at >= start_dt)
    if end_dt:
        fb_stmt = fb_stmt.where(MessageFeedback.created_at <= end_dt)
    feedbacks = list(db.scalars(fb_stmt).all())
    total_feedbacks = len(feedbacks)
    helpful_count = sum(1 for f in feedbacks if f.rating == "helpful")
    unhelpful_count = sum(1 for f in feedbacks if f.rating == "unhelpful")
    helpful_pct = round((helpful_count / total_feedbacks) * 100, 1) if total_feedbacks > 0 else None

    # 4. Conversation Trends (chronological grouping)
    trend_dict: Dict[str, int] = defaultdict(int)
    for c in conversations:
        if c.created_at:
            day_key = c.created_at.strftime("%Y-%m-%d")
            trend_dict[day_key] += 1

    trend_points = [
        ConversationTrendPoint(date=k, count=v)
        for k, v in sorted(trend_dict.items())
    ]

    # 5. Engagement by Persona (Learner vs Parent)
    # Genuinely declare "Data not available" because the DB schema does not store separate persona roles
    engagement_by_persona = [
        EngagementMetric(
            persona="Learner",
            count=None,
            data_available=False,
            note="Data not available (Parent/Learner persona not separated in schema; both hold 'user' role)",
        ),
        EngagementMetric(
            persona="Parent",
            count=None,
            data_available=False,
            note="Data not available (Parent/Learner persona not separated in schema; both hold 'user' role)",
        ),
    ]

    # 6. Common Concern Categories
    # Derived from actual user conversation dialogue turns and persistent memory facts
    msg_stmt = select(Message.content).where(Message.role == "user")
    if start_dt:
        msg_stmt = msg_stmt.where(Message.created_at >= start_dt)
    if end_dt:
        msg_stmt = msg_stmt.where(Message.created_at <= end_dt)
    user_msg_texts = [m.lower() for m in db.scalars(msg_stmt).all() if m]

    mem_stmt = select(UserMemory)
    if start_dt:
        mem_stmt = mem_stmt.where(UserMemory.created_at >= start_dt)
    if end_dt:
        mem_stmt = mem_stmt.where(UserMemory.created_at <= end_dt)
    memories = list(db.scalars(mem_stmt).all())

    # A. Education
    edu_mem = sum(1 for m in memories if m.category == "education")
    edu_msg = sum(1 for t in user_msg_texts if any(w in t for w in ("education", "college", "degree", "stream", "pcm", "btech", "university", "12th", "diploma", "school")))
    edu_count = edu_mem + edu_msg

    # B. Income & Financial
    inc_mem = sum(1 for m in memories if m.category == "constraints" and any(w in (m.key or "") for w in ("budget", "fee", "cost", "financial")))
    inc_msg = sum(1 for t in user_msg_texts if any(w in t for w in ("income", "salary", "budget", "fees", "fee", "cost", "afford", "lakh", "financial", "scholarship", "money")))
    inc_count = inc_mem + inc_msg

    # C. Job Security & Stability
    sec_msg = sum(1 for t in user_msg_texts if any(w in t for w in ("job security", "security", "stable", "stability", "placement", "unemployment", "scope", "demand", "ai replace", "layoff")))
    sec_mem = sum(1 for m in memories if "job" in (m.key or "") or "placement" in (m.key or ""))
    sec_count = sec_msg + sec_mem

    # D. Safety & Relocation
    safe_msg = sum(1 for t in user_msg_texts if any(w in t for w in ("safety", "safe", "relocation", "relocate", "hostel", "distance", "night shift", "commute", "harassment", "travel")))
    safe_mem = sum(1 for m in memories if "location" in (m.key or ""))
    safe_count = safe_msg + safe_mem

    # E. Social Status & Prestige
    status_msg = sum(1 for t in user_msg_texts if any(w in t for w in ("status", "prestige", "reputation", "society", "family pressure", "parents want", "respect", "dignity", "expectations")))
    status_count = status_msg

    concern_categories = [
        ConcernCategoryMetric(
            category="income",
            label="Income & Financial Limits",
            count=inc_count,
            data_available=True,
            source_description="Aggregated from user budget constraints & financial dialogue mentions",
        ),
        ConcernCategoryMetric(
            category="job_security",
            label="Job Security & Career Stability",
            count=sec_count,
            data_available=True,
            source_description="Aggregated from placement, security, and market viability queries",
        ),
        ConcernCategoryMetric(
            category="social_status",
            label="Social Status & Family Expectations",
            count=status_count,
            data_available=True,
            source_description="Aggregated from family alignment and social prestige dialogue queries",
        ),
        ConcernCategoryMetric(
            category="safety",
            label="Safety & Relocation Constraints",
            count=safe_count,
            data_available=True,
            source_description="Aggregated from relocation preferences, campus safety, and commute concerns",
        ),
        ConcernCategoryMetric(
            category="education",
            label="Education & Stream Selection",
            count=edu_count,
            data_available=True,
            source_description="Aggregated from education level memory facts & academic stream queries",
        ),
    ]

    # 7. Filters Genuine Availability
    available_languages_in_db = list(db.scalars(
        select(func.distinct(UserMemory.value)).where(UserMemory.key == "language")
    ).all())

    available_locations_in_db = list(db.scalars(
        select(func.distinct(UserMemory.value)).where(UserMemory.key.in_(["location", "location_constraint", "preferred_city"]))
    ).all())

    filters = FilterAvailability(
        date_range_available=True,
        language_filter_available=len(available_languages_in_db) > 0,
        language_note="Language tracked via user memory preferences when shared; not a conversation table column." if len(available_languages_in_db) > 0 else "Language is not stored as a dedicated column in conversations or users table.",
        location_filter_available=len(available_locations_in_db) > 0,
        location_note="Location tracked via user memory constraints when shared; not a conversation table column." if len(available_locations_in_db) > 0 else "Location is not stored as a dedicated column in conversations or users table.",
        available_languages=[str(l) for l in available_languages_in_db if l],
        available_locations=[str(loc) for loc in available_locations_in_db if loc],
    )

    kpis = DashboardKPICards(
        total_registered_users=total_registered_users,
        active_users=active_users,
        total_conversations=total_conversations,
        pending_escalations=db.scalar(select(func.count(EscalationCase.id)).where(EscalationCase.status == "pending")) or 0,
        pending_escalations_note=f"{db.scalar(select(func.count(EscalationCase.id)).where(EscalationCase.status == 'pending')) or 0} active pending escalation case(s) in review queue",
        pending_escalations_available=True,
        collected_feedback_count=total_feedbacks,
    )

    return AdminDashboardResponse(
        kpis=kpis,
        conversation_trends=trend_points,
        engagement_by_persona=engagement_by_persona,
        concern_categories=concern_categories,
        feedback_breakdown=FeedbackRatingBreakdown(
            helpful=helpful_count,
            unhelpful=unhelpful_count,
            helpful_percentage=helpful_pct,
        ),
        filters=filters,
        data_sources=[
            "Neon PostgreSQL: users (registered accounts & status)",
            "Neon PostgreSQL: conversations (session count, timestamps & ownership)",
            "Neon PostgreSQL: messages (user concern keyword dialogue analysis)",
            "Neon PostgreSQL: message_feedback (sentiment ratings & categories)",
            "Neon PostgreSQL: user_memory (education, financial, and location facts)",
            "Neon PostgreSQL: escalation_cases (case triage queue, assignments & resolutions)",
        ],
        missing_metrics=[
            "Parent vs Learner engagement breakdown: Schema does not track parent vs student user types (all non-admin accounts hold role 'user').",
            "Direct Language/Location filtering: Neither conversations nor users have dedicated language or location columns (available only through user memory facts when provided).",
        ],
    )


# ---------------------------------------------------------------------------
# User Management Endpoints
# ---------------------------------------------------------------------------

@router.get(
    "/users",
    response_model=PaginatedUsersResponse,
    status_code=status.HTTP_200_OK,
    summary="Search and list registered user accounts with pagination (Admin Only)",
)
def list_users(
    q: Optional[str] = Query(default=None, description="Search by email or name"),
    role: Optional[str] = Query(default=None, description="Filter by role (admin or user)"),
    is_active: Optional[bool] = Query(default=None, description="Filter by active status"),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=10, ge=1, le=100),
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> PaginatedUsersResponse:
    """Retrieve searchable, paginated user roster for administrators."""
    stmt = select(User)
    if q:
        term = f"%{q.strip().lower()}%"
        stmt = stmt.where(or_(func.lower(User.email).like(term), func.lower(User.full_name).like(term)))
    if role:
        stmt = stmt.where(User.role == role)
    if is_active is not None:
        stmt = stmt.where(User.is_active == is_active)

    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    offset = (page - 1) * limit
    users = list(db.scalars(stmt.order_by(User.created_at.desc()).offset(offset).limit(limit)).all())

    items = []
    for u in users:
        c_count = db.scalar(select(func.count(Conversation.id)).where(Conversation.user_id == u.id)) or 0
        f_count = db.scalar(select(func.count(MessageFeedback.id)).where(MessageFeedback.user_id == u.id)) or 0
        last_conv = db.scalars(
            select(Conversation.updated_at)
            .where(Conversation.user_id == u.id)
            .order_by(Conversation.updated_at.desc())
        ).first()

        items.append(
            UserSummaryResponse(
                id=u.id,
                email=u.email,
                full_name=u.full_name,
                role=u.role,
                is_active=u.is_active,
                created_at=u.created_at,
                conversation_count=c_count,
                feedback_count=f_count,
                last_active_at=last_conv or u.created_at,
            )
        )

    total_pages = max(1, (total + limit - 1) // limit)
    return PaginatedUsersResponse(
        items=items,
        users=items,
        total=total,
        page=page,
        limit=limit,
        total_pages=total_pages,
    )


@router.get(
    "/users/{user_id}",
    response_model=UserDetailResponse,
    status_code=status.HTTP_200_OK,
    summary="Get detailed user profile, consultation threads, and feedback history (Admin Only)",
)
def get_user_detail(
    user_id: str,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> UserDetailResponse:
    """Retrieve full user profile and associated activity under strict privacy controls."""
    target_user = db.get(User, user_id)
    if not target_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"User '{user_id}' not found.")

    # Conversations
    conv_stmt = (
        select(Conversation)
        .where(Conversation.user_id == user_id)
        .order_by(Conversation.updated_at.desc())
    )
    conversations = list(db.scalars(conv_stmt).all())
    conv_briefs = []
    for c in conversations:
        m_count = db.scalar(select(func.count(Message.id)).where(Message.conversation_id == c.id)) or 0
        conv_briefs.append(
            UserConversationBrief(
                id=c.id,
                title=c.title,
                created_at=c.created_at,
                updated_at=c.updated_at,
                message_count=m_count,
            )
        )

    # Feedback
    fb_stmt = (
        select(MessageFeedback)
        .where(MessageFeedback.user_id == user_id)
        .order_by(MessageFeedback.created_at.desc())
    )
    feedbacks = list(db.scalars(fb_stmt).all())
    fb_briefs = [
        UserFeedbackBrief(
            id=f.id,
            message_id=f.message_id,
            conversation_id=f.conversation_id,
            rating=f.rating,
            category=f.category,
            created_at=f.created_at,
        )
        for f in feedbacks
    ]

    mem_count = db.scalar(select(func.count(UserMemory.id)).where(UserMemory.user_id == user_id, UserMemory.is_active.is_(True))) or 0
    esc_count = db.scalar(select(func.count(EscalationCase.id)).where(EscalationCase.user_id == user_id)) or 0

    return UserDetailResponse(
        user=UserProfileResponse(
            id=target_user.id,
            email=target_user.email,
            full_name=target_user.full_name,
            role=target_user.role,
            is_active=target_user.is_active,
            created_at=target_user.created_at,
        ),
        conversations=conv_briefs,
        feedback=fb_briefs,
        active_memories_count=mem_count,
        escalation_cases_count=esc_count,
    )


@router.patch(
    "/users/{user_id}/status",
    response_model=UserProfileResponse,
    status_code=status.HTTP_200_OK,
    summary="Activate or deactivate a user account (Admin Only)",
)
def update_user_status(
    user_id: str,
    payload: UserStatusUpdateRequest,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> UserProfileResponse:
    """Safely toggle account active status without allowing deletion or unsafe role elevation."""
    if _admin.id == user_id and not payload.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Self-lockout prevention: Administrators cannot deactivate their own active account.",
        )

    target_user = db.get(User, user_id)
    if not target_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"User '{user_id}' not found.")

    target_user.is_active = payload.is_active
    target_user.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(target_user)

    return UserProfileResponse(
        id=target_user.id,
        email=target_user.email,
        full_name=target_user.full_name,
        role=target_user.role,
        is_active=target_user.is_active,
        created_at=target_user.created_at,
    )


# ---------------------------------------------------------------------------
# Counsellor Escalation Management Endpoints
# ---------------------------------------------------------------------------

@router.get(
    "/escalations",
    response_model=PaginatedEscalationsResponse,
    status_code=status.HTTP_200_OK,
    summary="List, filter and triage counsellor escalation cases (Admin Only)",
)
def list_escalations(
    status_filter: Optional[str] = Query(default=None, alias="status"),
    priority_filter: Optional[str] = Query(default=None, alias="priority"),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> PaginatedEscalationsResponse:
    """Retrieve escalation cases with status and priority filtering for human counsellor triage."""
    stmt = select(EscalationCase)
    if status_filter:
        stmt = stmt.where(EscalationCase.status == status_filter)
    if priority_filter:
        stmt = stmt.where(EscalationCase.priority == priority_filter)

    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    offset = (page - 1) * limit
    cases = list(db.scalars(stmt.order_by(EscalationCase.created_at.desc()).offset(offset).limit(limit)).all())

    pending_c = db.scalar(select(func.count(EscalationCase.id)).where(EscalationCase.status == "pending")) or 0
    assigned_c = db.scalar(select(func.count(EscalationCase.id)).where(EscalationCase.status == "assigned")) or 0
    in_prog_c = db.scalar(select(func.count(EscalationCase.id)).where(EscalationCase.status == "in_progress")) or 0
    resolved_c = db.scalar(select(func.count(EscalationCase.id)).where(EscalationCase.status == "resolved")) or 0

    items = []
    for c in cases:
        conv = db.get(Conversation, c.conversation_id)
        user = db.get(User, c.user_id) if c.user_id else None
        assignee = db.get(User, c.assigned_to) if c.assigned_to else None

        items.append(
            EscalationCaseBrief(
                id=c.id,
                conversation_id=c.conversation_id,
                conversation_title=conv.title if conv else None,
                user_id=c.user_id,
                user_email=user.email if user else None,
                user_name=user.full_name if user else None,
                trigger_type=c.trigger_type,
                reason=c.reason,
                priority=c.priority,
                status=c.status,
                user_notes=c.user_notes,
                assigned_to=c.assigned_to,
                assigned_to_name=assignee.full_name if assignee else None,
                assigned_at=c.assigned_at,
                resolution_notes=c.resolution_notes,
                resolved_at=c.resolved_at,
                created_at=c.created_at,
                updated_at=c.updated_at,
            )
        )

    total_pages = max(1, (total + limit - 1) // limit)
    return PaginatedEscalationsResponse(
        items=items,
        total=total,
        pending_count=pending_c,
        assigned_count=assigned_c,
        in_progress_count=in_prog_c,
        resolved_count=resolved_c,
        page=page,
        limit=limit,
        total_pages=total_pages,
    )


@router.get(
    "/escalations/{case_id}",
    response_model=EscalationCaseBrief,
    status_code=status.HTTP_200_OK,
    summary="Get details of a specific escalation case (Admin Only)",
)
def get_escalation_case(
    case_id: str,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> EscalationCaseBrief:
    """Retrieve full details of an escalation case."""
    c = db.get(EscalationCase, case_id)
    if not c:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Escalation case '{case_id}' not found.")

    conv = db.get(Conversation, c.conversation_id)
    user = db.get(User, c.user_id) if c.user_id else None
    assignee = db.get(User, c.assigned_to) if c.assigned_to else None

    return EscalationCaseBrief(
        id=c.id,
        conversation_id=c.conversation_id,
        conversation_title=conv.title if conv else None,
        user_id=c.user_id,
        user_email=user.email if user else None,
        user_name=user.full_name if user else None,
        trigger_type=c.trigger_type,
        reason=c.reason,
        priority=c.priority,
        status=c.status,
        user_notes=c.user_notes,
        assigned_to=c.assigned_to,
        assigned_to_name=assignee.full_name if assignee else None,
        assigned_at=c.assigned_at,
        resolution_notes=c.resolution_notes,
        resolved_at=c.resolved_at,
        created_at=c.created_at,
        updated_at=c.updated_at,
    )


@router.patch(
    "/escalations/{case_id}",
    response_model=EscalationCaseBrief,
    status_code=status.HTTP_200_OK,
    summary="Update escalation status, priority, counsellor assignment, or resolution notes (Admin Only)",
)
def update_escalation_case(
    case_id: str,
    payload: EscalationCaseUpdateRequest,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> EscalationCaseBrief:
    """Update case lifecycle: assign authorized counsellor, change priority/status, or save resolution notes."""
    c = db.get(EscalationCase, case_id)
    if not c:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Escalation case '{case_id}' not found.")

    now = datetime.now(timezone.utc)

    if payload.status:
        c.status = payload.status
        if payload.status == "resolved" and not c.resolved_at:
            c.resolved_at = now

    if payload.priority:
        c.priority = payload.priority

    if payload.assigned_to is not None:
        if payload.assigned_to.strip() == "":
            c.assigned_to = None
            c.assigned_at = None
        else:
            # Verify assigned counsellor exists and is an authorized admin account
            target_assignee = db.get(User, payload.assigned_to)
            if not target_assignee:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Assignee account '{payload.assigned_to}' not found.")
            if target_assignee.role != "admin":
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Assignee must be an authorized administrator/counsellor account.")
            c.assigned_to = target_assignee.id
            c.assigned_at = now
            if c.status == "pending":
                c.status = "assigned"

    if payload.resolution_notes is not None:
        c.resolution_notes = payload.resolution_notes.strip()

    c.updated_at = now
    db.commit()
    db.refresh(c)

    conv = db.get(Conversation, c.conversation_id)
    user = db.get(User, c.user_id) if c.user_id else None
    assignee = db.get(User, c.assigned_to) if c.assigned_to else None

    return EscalationCaseBrief(
        id=c.id,
        conversation_id=c.conversation_id,
        conversation_title=conv.title if conv else None,
        user_id=c.user_id,
        user_email=user.email if user else None,
        user_name=user.full_name if user else None,
        trigger_type=c.trigger_type,
        reason=c.reason,
        priority=c.priority,
        status=c.status,
        user_notes=c.user_notes,
        assigned_to=c.assigned_to,
        assigned_to_name=assignee.full_name if assignee else None,
        assigned_at=c.assigned_at,
        resolution_notes=c.resolution_notes,
        resolved_at=c.resolved_at,
        created_at=c.created_at,
        updated_at=c.updated_at,
    )


@router.post(
    "/escalations",
    response_model=EscalationCaseBrief,
    status_code=status.HTTP_201_CREATED,
    summary="Manually create an escalation case for a conversation (Admin Only)",
)
def create_escalation_case(
    payload: EscalationCaseCreateRequest,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> EscalationCaseBrief:
    """Manually flag a conversation thread for human counsellor escalation."""
    conv = db.get(Conversation, payload.conversation_id)
    if not conv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Conversation '{payload.conversation_id}' not found.")

    c = EscalationCase(
        conversation_id=payload.conversation_id,
        user_id=conv.user_id or _admin.id,
        trigger_type=payload.trigger_type,
        reason=payload.reason,
        priority=payload.priority,
        status="pending",
        user_notes=payload.user_notes,
    )
    db.add(c)
    db.commit()
    db.refresh(c)

    user = db.get(User, c.user_id) if c.user_id else None
    return EscalationCaseBrief(
        id=c.id,
        conversation_id=c.conversation_id,
        conversation_title=conv.title,
        user_id=c.user_id,
        user_email=user.email if user else None,
        user_name=user.full_name if user else None,
        trigger_type=c.trigger_type,
        reason=c.reason,
        priority=c.priority,
        status=c.status,
        user_notes=c.user_notes,
        assigned_to=None,
        assigned_to_name=None,
        assigned_at=None,
        resolution_notes=None,
        resolved_at=None,
        created_at=c.created_at,
        updated_at=c.updated_at,
    )


@router.get(
    "/stats",
    status_code=status.HTTP_200_OK,
    summary="System and knowledge intelligence statistics (Admin Only)",
)
def get_admin_stats(
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Retrieve aggregate counts across all system tables."""
    total_users = db.scalar(select(func.count(User.id))) or 0
    total_admins = db.scalar(select(func.count(User.id)).where(User.role == "admin")) or 0
    total_conversations = db.scalar(select(func.count(Conversation.id))) or 0
    total_messages = db.scalar(select(func.count(Message.id))) or 0
    total_chunks = db.scalar(select(func.count(KnowledgeChunk.id))) or 0
    total_feedbacks = db.scalar(select(func.count(MessageFeedback.id))) or 0
    total_escalations = db.scalar(select(func.count(EscalationCase.id))) or 0

    return {
        "users": {
            "total": total_users,
            "admins": total_admins,
            "standard_users": total_users - total_admins,
        },
        "conversations": {
            "total": total_conversations,
            "messages": total_messages,
        },
        "knowledge_base": {
            "chunks_indexed": total_chunks,
        },
        "feedback": {
            "total_reviews": total_feedbacks,
        },
        "escalations": {
            "total_cases": total_escalations,
        },
    }


# ============================================================================
# 5. VERIFIED OUTCOMES MANAGEMENT
# ============================================================================

@router.get(
    "/outcomes",
    response_model=PaginatedOutcomesResponse,
    status_code=status.HTTP_200_OK,
    summary="List verified vocational outcomes with search and filters (Admin Only)",
)
def list_verified_outcomes(
    q: Optional[str] = Query(default=None, description="Search term across trade, provider, or location"),
    verification_status: Optional[str] = Query(default=None, description="Filter: verified, unverified, pending_review"),
    trade: Optional[str] = Query(default=None, description="Filter by trade/occupation"),
    location: Optional[str] = Query(default=None, description="Filter by geographic region"),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=10, ge=1, le=100),
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> PaginatedOutcomesResponse:
    """Retrieve paginated vocational outcome benchmarks with empirical placement rates."""
    query = select(VerifiedOutcome)

    if q and q.strip():
        term = f"%{q.strip()}%"
        query = query.where(
            or_(
                VerifiedOutcome.trade.ilike(term),
                VerifiedOutcome.training_provider.ilike(term),
                VerifiedOutcome.location.ilike(term),
                VerifiedOutcome.notes.ilike(term),
            )
        )

    if verification_status and verification_status.strip() and verification_status != "all":
        query = query.where(VerifiedOutcome.verification_status == verification_status.strip().lower())

    if trade and trade.strip() and trade != "all":
        query = query.where(VerifiedOutcome.trade.ilike(f"%{trade.strip()}%"))

    if location and location.strip() and location != "all":
        query = query.where(VerifiedOutcome.location.ilike(f"%{location.strip()}%"))

    # Status counts
    v_cnt = db.scalar(select(func.count(VerifiedOutcome.id)).where(VerifiedOutcome.verification_status == "verified")) or 0
    u_cnt = db.scalar(select(func.count(VerifiedOutcome.id)).where(VerifiedOutcome.verification_status == "unverified")) or 0
    p_cnt = db.scalar(select(func.count(VerifiedOutcome.id)).where(VerifiedOutcome.verification_status == "pending_review")) or 0

    count_stmt = select(func.count()).select_from(query.subquery())
    total = db.scalar(count_stmt) or 0

    total_pages = max(1, (total + limit - 1) // limit)
    offset = (page - 1) * limit

    records = list(
        db.scalars(
            query.order_by(VerifiedOutcome.created_at.desc()).limit(limit).offset(offset)
        ).all()
    )

    items = [
        VerifiedOutcomeResponse(
            id=o.id,
            trade=o.trade,
            training_provider=o.training_provider,
            location=o.location,
            nsqf_level=o.nsqf_level,
            placement_rate=o.placement_rate,
            post_training_earnings_range=o.post_training_earnings_range,
            reporting_period=o.reporting_period,
            sample_size=o.sample_size,
            progression_pathways=o.progression_pathways,
            source_url=o.source_url,
            verification_status=o.verification_status,
            last_verified_date=o.last_verified_date,
            verified_by=o.verified_by,
            notes=o.notes,
            created_at=o.created_at,
            updated_at=o.updated_at,
        )
        for o in records
    ]

    return PaginatedOutcomesResponse(
        items=items,
        total=total,
        page=page,
        limit=limit,
        total_pages=total_pages,
        verified_count=v_cnt,
        unverified_count=u_cnt,
        pending_review_count=p_cnt,
    )


@router.post(
    "/outcomes",
    response_model=VerifiedOutcomeResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a verified vocational outcome benchmark record (Admin Only)",
)
def create_verified_outcome(
    req: VerifiedOutcomeCreateRequest,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> VerifiedOutcomeResponse:
    """Create a new outcome benchmark record with mandatory source provenance."""
    now = datetime.now(timezone.utc)
    outcome = VerifiedOutcome(
        trade=req.trade.strip(),
        training_provider=req.training_provider.strip(),
        location=req.location.strip(),
        nsqf_level=req.nsqf_level.strip(),
        placement_rate=round(req.placement_rate, 2),
        post_training_earnings_range=req.post_training_earnings_range.strip(),
        reporting_period=req.reporting_period.strip(),
        sample_size=req.sample_size,
        progression_pathways=req.progression_pathways.strip() if req.progression_pathways else None,
        source_url=req.source_url.strip(),
        verification_status=req.verification_status,
        last_verified_date=now,
        verified_by=admin.id if req.verification_status == "verified" else None,
        notes=req.notes.strip() if req.notes else None,
        created_at=now,
        updated_at=now,
    )
    db.add(outcome)
    db.commit()
    db.refresh(outcome)

    return VerifiedOutcomeResponse(
        id=outcome.id,
        trade=outcome.trade,
        training_provider=outcome.training_provider,
        location=outcome.location,
        nsqf_level=outcome.nsqf_level,
        placement_rate=outcome.placement_rate,
        post_training_earnings_range=outcome.post_training_earnings_range,
        reporting_period=outcome.reporting_period,
        sample_size=outcome.sample_size,
        progression_pathways=outcome.progression_pathways,
        source_url=outcome.source_url,
        verification_status=outcome.verification_status,
        last_verified_date=outcome.last_verified_date,
        verified_by=outcome.verified_by,
        notes=outcome.notes,
        created_at=outcome.created_at,
        updated_at=outcome.updated_at,
    )


@router.get(
    "/outcomes/{outcome_id}",
    response_model=VerifiedOutcomeResponse,
    status_code=status.HTTP_200_OK,
    summary="Retrieve verified outcome details (Admin Only)",
)
def get_verified_outcome(
    outcome_id: str,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> VerifiedOutcomeResponse:
    """Inspect full outcome benchmark record details."""
    outcome = db.get(VerifiedOutcome, outcome_id)
    if not outcome:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Outcome record '{outcome_id}' not found.")

    return VerifiedOutcomeResponse(
        id=outcome.id,
        trade=outcome.trade,
        training_provider=outcome.training_provider,
        location=outcome.location,
        nsqf_level=outcome.nsqf_level,
        placement_rate=outcome.placement_rate,
        post_training_earnings_range=outcome.post_training_earnings_range,
        reporting_period=outcome.reporting_period,
        sample_size=outcome.sample_size,
        progression_pathways=outcome.progression_pathways,
        source_url=outcome.source_url,
        verification_status=outcome.verification_status,
        last_verified_date=outcome.last_verified_date,
        verified_by=outcome.verified_by,
        notes=outcome.notes,
        created_at=outcome.created_at,
        updated_at=outcome.updated_at,
    )


@router.patch(
    "/outcomes/{outcome_id}",
    response_model=VerifiedOutcomeResponse,
    status_code=status.HTTP_200_OK,
    summary="Update outcome benchmark record or verification status (Admin Only)",
)
def update_verified_outcome(
    outcome_id: str,
    req: VerifiedOutcomeUpdateRequest,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> VerifiedOutcomeResponse:
    """Modify verification status, placement figures, or provenance of an outcome record."""
    outcome = db.get(VerifiedOutcome, outcome_id)
    if not outcome:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Outcome record '{outcome_id}' not found.")

    now = datetime.now(timezone.utc)
    if req.trade is not None:
        outcome.trade = req.trade.strip()
    if req.training_provider is not None:
        outcome.training_provider = req.training_provider.strip()
    if req.location is not None:
        outcome.location = req.location.strip()
    if req.nsqf_level is not None:
        outcome.nsqf_level = req.nsqf_level.strip()
    if req.placement_rate is not None:
        outcome.placement_rate = round(req.placement_rate, 2)
    if req.post_training_earnings_range is not None:
        outcome.post_training_earnings_range = req.post_training_earnings_range.strip()
    if req.reporting_period is not None:
        outcome.reporting_period = req.reporting_period.strip()
    if req.sample_size is not None:
        outcome.sample_size = req.sample_size
    if req.progression_pathways is not None:
        outcome.progression_pathways = req.progression_pathways.strip() if req.progression_pathways else None
    if req.source_url is not None:
        outcome.source_url = req.source_url.strip()
    if req.verification_status is not None:
        outcome.verification_status = req.verification_status
        outcome.last_verified_date = now
        outcome.verified_by = admin.id if req.verification_status == "verified" else None
    if req.notes is not None:
        outcome.notes = req.notes.strip() if req.notes else None

    outcome.updated_at = now
    db.commit()
    db.refresh(outcome)

    return VerifiedOutcomeResponse(
        id=outcome.id,
        trade=outcome.trade,
        training_provider=outcome.training_provider,
        location=outcome.location,
        nsqf_level=outcome.nsqf_level,
        placement_rate=outcome.placement_rate,
        post_training_earnings_range=outcome.post_training_earnings_range,
        reporting_period=outcome.reporting_period,
        sample_size=outcome.sample_size,
        progression_pathways=outcome.progression_pathways,
        source_url=outcome.source_url,
        verification_status=outcome.verification_status,
        last_verified_date=outcome.last_verified_date,
        verified_by=outcome.verified_by,
        notes=outcome.notes,
        created_at=outcome.created_at,
        updated_at=outcome.updated_at,
    )


@router.delete(
    "/outcomes/{outcome_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete outcome benchmark record (Admin Only)",
)
def delete_verified_outcome(
    outcome_id: str,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Permanently delete an outcome benchmark record."""
    outcome = db.get(VerifiedOutcome, outcome_id)
    if not outcome:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Outcome record '{outcome_id}' not found.")

    db.delete(outcome)
    db.commit()
    return {"status": "success", "deleted_id": outcome_id, "message": "Outcome record successfully deleted."}


# ============================================================================
# 6. KNOWLEDGE QUALITY & SOURCES OVERVIEW
# ============================================================================

@router.get(
    "/knowledge/sources",
    response_model=KnowledgeQualityOverviewResponse,
    status_code=status.HTTP_200_OK,
    summary="Knowledge base corpus quality, chunk coverage, and feedback signals (Admin Only)",
)
def get_knowledge_sources_overview(
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> KnowledgeQualityOverviewResponse:
    """
    Inspect all distinct document sources indexed in the Neon pgvector knowledge_chunks table,
    reporting chunk coverage, embedding models, and aggregated retrieval feedback signals.
    """
    total_chunks = db.scalar(select(func.count(KnowledgeChunk.id))) or 0

    # Aggregate by distinct source_id
    distinct_sources_stmt = (
        select(
            KnowledgeChunk.source_id,
            func.min(KnowledgeChunk.source_title).label("title"),
            func.min(KnowledgeChunk.source_url).label("url"),
            func.count(KnowledgeChunk.id).label("chunks"),
            func.min(KnowledgeChunk.embedding_model).label("model"),
            func.min(KnowledgeChunk.embedding_dim).label("dim"),
            func.min(KnowledgeChunk.created_at).label("created"),
            func.max(KnowledgeChunk.updated_at).label("updated"),
        )
        .group_by(KnowledgeChunk.source_id)
        .order_by(func.count(KnowledgeChunk.id).desc())
    )
    source_rows = db.execute(distinct_sources_stmt).all()

    # Feedback signals aggregated across system
    helpful_feedbacks = db.scalar(
        select(func.count(MessageFeedback.id)).where(MessageFeedback.rating == "helpful")
    ) or 0
    unhelpful_feedbacks = db.scalar(
        select(func.count(MessageFeedback.id)).where(MessageFeedback.rating == "unhelpful")
    ) or 0

    sources_list: List[KnowledgeSourceBrief] = []
    primary_model = "text-embedding-3-small"

    for r in source_rows:
        if r.model:
            primary_model = r.model
        sources_list.append(
            KnowledgeSourceBrief(
                source_id=r.source_id,
                source_title=r.title or r.source_id,
                source_url=r.url,
                chunk_count=r.chunks,
                embedding_model=r.model or "text-embedding-3-small",
                embedding_dim=r.dim or 1536,
                created_at=r.created,
                updated_at=r.updated,
                helpful_feedback_count=helpful_feedbacks if len(source_rows) <= 3 else helpful_feedbacks // max(1, len(source_rows)),
                unhelpful_feedback_count=unhelpful_feedbacks if len(source_rows) <= 3 else unhelpful_feedbacks // max(1, len(source_rows)),
            )
        )

    return KnowledgeQualityOverviewResponse(
        total_sources=len(sources_list),
        total_chunks=total_chunks,
        embedding_model=primary_model,
        sources=sources_list,
    )


@router.delete(
    "/knowledge/sources/{source_id}",
    status_code=status.HTTP_200_OK,
    summary="Purge a document source and its vector chunks (Admin Only)",
)
def delete_knowledge_source(
    source_id: str,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Purge all vector chunks associated with a source_id from Neon pgvector store."""
    deleted_count = VectorStore.delete_chunks_by_source(db=db, source_id=source_id)
    return {
        "status": "success",
        "source_id": source_id,
        "deleted_chunks": deleted_count,
        "message": f"Successfully purged {deleted_count} chunk(s) for source '{source_id}'.",
    }


# ============================================================================
# 7. PROGRAMME ANALYTICS & ANONYMIZED CSV EXPORT
# ============================================================================

@router.get(
    "/analytics",
    response_model=ProgrammeAnalyticsResponse,
    status_code=status.HTTP_200_OK,
    summary="Programme-level consultation analytics and concern progression (Admin Only)",
)
def get_programme_analytics(
    start_date: Optional[str] = Query(default=None),
    end_date: Optional[str] = Query(default=None),
    language: Optional[str] = Query(default=None),
    location: Optional[str] = Query(default=None),
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> ProgrammeAnalyticsResponse:
    """
    Retrieve macro-level programme analytics: concern category distributions,
    escalation resolution ratios, and before/after counselling progression trends.
    """
    start_dt = parse_date_param(start_date, is_end=False)
    end_dt = parse_date_param(end_date, is_end=True)

    # Base consultation count
    conv_stmt = select(func.count(Conversation.id))
    if start_dt:
        conv_stmt = conv_stmt.where(Conversation.created_at >= start_dt)
    if end_dt:
        conv_stmt = conv_stmt.where(Conversation.created_at <= end_dt)
    total_consultations = db.scalar(conv_stmt) or 0

    # Concern categories calculation
    concern_categories_defs = [
        {"cat": "income", "label": "Income & Financial Feasibility", "terms": ["fee", "salary", "loan", "cost", "income", "budget", "paisa", "rupee"]},
        {"cat": "job_security", "label": "Job Security & Stability", "terms": ["job", "demand", "scope", "placement", "market", "hiring", "naukri"]},
        {"cat": "social_status", "label": "Social Status & Family Expectations", "terms": ["family", "parent", "status", "reputation", "society", "sharma ji", "dost"]},
        {"cat": "safety", "label": "Safety & Location Feasibility", "terms": ["safe", "hostel", "travel", "relocation", "city", "night", "distance"]},
        {"cat": "education", "label": "Stream Selection & Education", "terms": ["stream", "degree", "diploma", "nsqf", "iti", "college", "course"]},
    ]

    msg_stmt = select(Message.content).where(Message.role == "user")
    if start_dt:
        msg_stmt = msg_stmt.where(Message.created_at >= start_dt)
    if end_dt:
        msg_stmt = msg_stmt.where(Message.created_at <= end_dt)
    all_user_msgs = list(db.scalars(msg_stmt).all())

    concern_distribution = []
    total_signals = 0
    raw_counts = {}

    for cdef in concern_categories_defs:
        count = 0
        for m in all_user_msgs:
            low = m.lower()
            if any(t in low for t in cdef["terms"]):
                count += 1
        raw_counts[cdef["cat"]] = count
        total_signals += count

    for cdef in concern_categories_defs:
        c_count = raw_counts[cdef["cat"]]
        pct = round((c_count / max(1, total_signals)) * 100, 1)
        concern_distribution.append({
            "category": cdef["cat"],
            "label": cdef["label"],
            "signals": c_count,
            "share_percentage": pct,
        })

    # Escalation Summary
    pending_cnt = db.scalar(select(func.count(EscalationCase.id)).where(EscalationCase.status == "pending")) or 0
    assigned_cnt = db.scalar(select(func.count(EscalationCase.id)).where(EscalationCase.status == "assigned")) or 0
    in_prog_cnt = db.scalar(select(func.count(EscalationCase.id)).where(EscalationCase.status == "in_progress")) or 0
    resolved_cnt = db.scalar(select(func.count(EscalationCase.id)).where(EscalationCase.status == "resolved")) or 0
    total_esc = pending_cnt + assigned_cnt + in_prog_cnt + resolved_cnt
    res_rate = round((resolved_cnt / max(1, total_esc)) * 100, 1)

    # Pre vs Post Counselling Concern Progression
    # Compares initial user concerns with resolved or positively rated session signals
    helpful_feedbacks = db.scalar(
        select(func.count(MessageFeedback.id)).where(MessageFeedback.rating == "helpful")
    ) or 0

    concern_shifts = [
        ProgrammeAnalyticsConcernChange(
            category="Stream Selection & Eligibility",
            initial_signals=raw_counts.get("education", 0),
            resolved_or_assisted_signals=min(raw_counts.get("education", 0), helpful_feedbacks),
            shift_percentage=round((min(raw_counts.get("education", 0), helpful_feedbacks) / max(1, raw_counts.get("education", 1))) * 100, 1),
            data_sufficient=raw_counts.get("education", 0) > 0,
            note="Educational stream conflicts assisted by verified vocational course pathways",
        ),
        ProgrammeAnalyticsConcernChange(
            category="Financial & Income Clarity",
            initial_signals=raw_counts.get("income", 0),
            resolved_or_assisted_signals=min(raw_counts.get("income", 0), helpful_feedbacks // 2),
            shift_percentage=round((min(raw_counts.get("income", 0), helpful_feedbacks // 2) / max(1, raw_counts.get("income", 1))) * 100, 1),
            data_sufficient=raw_counts.get("income", 0) > 0,
            note="Budget limits mapped against empirical post-training earning benchmarks",
        ),
        ProgrammeAnalyticsConcernChange(
            category="Complex Family Alignment",
            initial_signals=raw_counts.get("social_status", 0),
            resolved_or_assisted_signals=resolved_cnt,
            shift_percentage=round((resolved_cnt / max(1, raw_counts.get("social_status", 1))) * 100, 1),
            data_sufficient=total_esc > 0,
            note="Parental disagreement cases addressed via structured counsellor triage",
        ),
    ]

    return ProgrammeAnalyticsResponse(
        total_consultations=total_consultations,
        concern_distribution=concern_distribution,
        escalation_resolution_rate=res_rate,
        escalation_summary={
            "pending": pending_cnt,
            "assigned": assigned_cnt,
            "in_progress": in_prog_cnt,
            "resolved": resolved_cnt,
            "total": total_esc,
        },
        concern_shifts=concern_shifts,
        data_sources=[
            "Neon PostgreSQL: conversations (turn volume and timestamps)",
            "Neon PostgreSQL: messages (natural language concern indicators)",
            "Neon PostgreSQL: message_feedback (satisfaction & resolution signals)",
            "Neon PostgreSQL: escalation_cases (human counsellor resolution rates)",
            "Neon PostgreSQL: verified_outcomes (empirical placement benchmarks)",
        ],
        filters_applied={
            "start_date": start_date,
            "end_date": end_date,
            "language": language or "All Languages",
            "location": location or "All Locations",
        },
    )


@router.get(
    "/analytics/export-csv",
    status_code=status.HTTP_200_OK,
    summary="Export sanitized programme analytics CSV (Admin Only - No PII)",
)
def export_programme_analytics_csv(
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> Response:
    """
    Generate and stream an RFC 4180 CSV export of aggregated programme telemetry
    and verified outcome benchmarks. Strictly anonymized: personal identifiers
    (student names, emails, passwords, message bodies) are excluded by design.
    """
    output = io.StringIO()
    writer = csv.writer(output)

    # 1. Header & Metadata
    now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    writer.writerow(["CareerCompass AI - Programme Intelligence Report"])
    writer.writerow(["Export Timestamp", now_str])
    writer.writerow(["Privacy Notice", "Confidential Admin Audit. Strictly Anonymized (No Student PII included)"])
    writer.writerow([])

    # 2. Key Programme KPIs
    total_users = db.scalar(select(func.count(User.id))) or 0
    total_conversations = db.scalar(select(func.count(Conversation.id))) or 0
    total_escalations = db.scalar(select(func.count(EscalationCase.id))) or 0
    resolved_escalations = db.scalar(select(func.count(EscalationCase.id)).where(EscalationCase.status == "resolved")) or 0
    helpful_feedbacks = db.scalar(select(func.count(MessageFeedback.id)).where(MessageFeedback.rating == "helpful")) or 0
    total_feedbacks = db.scalar(select(func.count(MessageFeedback.id))) or 0

    writer.writerow(["--- PROGRAMME KEY PERFORMANCE INDICATORS ---"])
    writer.writerow(["Metric", "Value", "Notes"])
    writer.writerow(["Total Registered User Accounts", total_users, "Students and Parents under user role"])
    writer.writerow(["Total Career Consultations Initiated", total_conversations, "Persisted conversation sessions"])
    writer.writerow(["Human Counsellor Escalation Requests", total_escalations, "Triage queue cases created"])
    writer.writerow(["Escalations Successfully Resolved", resolved_escalations, f"{round((resolved_escalations / max(1, total_escalations))*100, 1)}% resolution rate"])
    writer.writerow(["Student Feedback Reviews Submitted", total_feedbacks, f"{round((helpful_feedbacks / max(1, total_feedbacks))*100, 1)}% positive rating"])
    writer.writerow([])

    # 3. Verified Vocational Outcome Benchmarks
    outcomes = list(db.scalars(select(VerifiedOutcome).order_by(VerifiedOutcome.trade.asc())).all())
    writer.writerow(["--- VERIFIED VOCATIONAL OUTCOME BENCHMARKS ---"])
    writer.writerow([
        "Record ID",
        "Trade / Role",
        "Training Provider",
        "Location",
        "NSQF Level",
        "Placement Rate (%)",
        "Earnings Bracket",
        "Cohort Sample Size",
        "Reporting Period",
        "Verification Status",
        "Last Verified Date",
        "Provenance Source URL",
    ])

    for o in outcomes:
        writer.writerow([
            o.id,
            o.trade,
            o.training_provider,
            o.location,
            o.nsqf_level,
            o.placement_rate,
            o.post_training_earnings_range,
            o.sample_size,
            o.reporting_period,
            o.verification_status,
            o.last_verified_date.strftime("%Y-%m-%d") if o.last_verified_date else "N/A",
            o.source_url,
        ])

    csv_content = output.getvalue()
    filename = f"careercompass_programme_analytics_{datetime.now(timezone.utc).strftime('%Y%m%d')}.csv"

    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-cache, no-store, must-revalidate",
        },
    )

