from typing import Optional
from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.feedback.schemas import MessageFeedbackCreateRequest, MessageFeedbackResponse
from app.feedback.service import FeedbackService

router = APIRouter(prefix="/chat/messages", tags=["feedback"])


from app.api.dependencies import get_current_user_from_token
from app.models.user import User


def get_current_user_id(
    x_user_id: Optional[str] = Header(default="default_user"),
    user: Optional[User] = Depends(get_current_user_from_token),
) -> str:
    """Resolve user identifier for ownership isolation."""
    if user:
        return user.id
    return x_user_id or "default_user"


@router.post(
    "/{message_id}/feedback",
    response_model=MessageFeedbackResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Submit message-level feedback",
)
def create_message_feedback(
    message_id: str,
    payload: MessageFeedbackCreateRequest,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    """
    Submit helpful/unhelpful rating and optional comment for an assistant message.
    Enforces ownership and prevents duplicate submissions.
    """
    return FeedbackService.submit_feedback(
        db=db,
        user_id=user_id,
        message_id=message_id,
        request=payload,
    )


@router.get(
    "/{message_id}/feedback",
    response_model=Optional[MessageFeedbackResponse],
    summary="Get user feedback for a message",
)
def get_message_feedback(
    message_id: str,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    """Retrieve existing feedback submitted by the current user for a message."""
    feedback = FeedbackService.get_feedback_for_message(
        db=db,
        user_id=user_id,
        message_id=message_id,
    )
    if not feedback:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No feedback found for message '{message_id}'.",
        )
    return feedback
