from typing import Optional
from fastapi import APIRouter, Depends, Header, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user_from_token
from app.counselling.escalation.schemas import EscalationHandoffResult
from app.counselling.escalation.service import HumanEscalationService
from app.db.session import get_db
from app.models.escalation import EscalationCase
from app.models.user import User

router = APIRouter(prefix="/chat/escalation", tags=["escalation"])


def get_current_user_id(
    x_user_id: Optional[str] = Header(default="default_user"),
    user: Optional[User] = Depends(get_current_user_from_token),
) -> str:
    if user:
        return user.id
    return x_user_id or "default_user"


class EscalationHandoffRequestBody(BaseModel):
    conversation_id: str = Field(..., min_length=1)
    action: str = Field(..., pattern=r"^(accept|decline|info)$")
    user_notes: Optional[str] = Field(default=None, max_length=500)


@router.post(
    "/action",
    response_model=EscalationHandoffResult,
    status_code=status.HTTP_200_OK,
    summary="Handle user action on human counsellor escalation offer",
)
def handle_escalation_action(
    payload: EscalationHandoffRequestBody,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """
    Process an accept, decline, or info action on a counsellor escalation offer.
    Honestly reflects external handoff configuration without fabricating appointments,
    while registering an internal EscalationCase in the administrative triage queue.
    """
    if payload.action == "accept":
        existing = db.scalars(
            select(EscalationCase).where(
                EscalationCase.conversation_id == payload.conversation_id,
                EscalationCase.status.in_(["pending", "assigned", "in_progress"]),
            )
        ).first()
        if not existing:
            new_case = EscalationCase(
                conversation_id=payload.conversation_id,
                user_id=user_id,
                trigger_type="explicit_request",
                reason="User accepted human counsellor consultation offer",
                priority="medium",
                status="pending",
                user_notes=payload.user_notes,
            )
            db.add(new_case)
            db.commit()

    return HumanEscalationService.process_handoff_request(
        user_id=user_id,
        conversation_id=payload.conversation_id,
        action=payload.action,
        user_notes=payload.user_notes,
    )

