from typing import Optional
from sqlalchemy import select
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.core.logging import get_logger
from app.feedback.schemas import MessageFeedbackCreateRequest, MessageFeedbackResponse
from app.models.conversation import Conversation
from app.models.feedback import MessageFeedback
from app.models.message import Message

logger = get_logger("feedback_service")


class FeedbackService:
    """
    Service layer for storing and retrieving message-level feedback.
    Enforces ownership boundaries, prevents duplicate submissions, and logs
    privacy-safe operational metrics without sensitive dialogue text.
    """

    @classmethod
    def submit_feedback(
        cls,
        db: Session,
        user_id: str,
        message_id: str,
        request: MessageFeedbackCreateRequest,
    ) -> MessageFeedbackResponse:
        """
        Record message feedback for an assistant response.
        Enforces conversation ownership and duplicate prevention.
        """
        # 1. Fetch target message
        message = db.get(Message, message_id)
        if not message:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Message '{message_id}' not found.",
            )

        # 2. Only assistant messages can receive feedback
        if message.role != "assistant":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Feedback can only be provided for assistant counsellor responses.",
            )

        # 3. Verify conversation ownership
        conversation = db.get(Conversation, message.conversation_id)
        if not conversation:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Parent conversation '{message.conversation_id}' not found.",
            )

        # Enforce user ownership if user_id is set
        if (
            hasattr(conversation, "user_id")
            and conversation.user_id
            and conversation.user_id not in (user_id, "default_user")
            and user_id != "default_user"
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: You do not own the conversation containing this message.",
            )


        # 4. Check for duplicate submission
        stmt = select(MessageFeedback).where(
            MessageFeedback.user_id == user_id,
            MessageFeedback.message_id == message_id,
        )
        existing = db.scalars(stmt).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Feedback has already been recorded for this message.",
            )

        # 5. Persist feedback
        feedback = MessageFeedback(
            message_id=message.id,
            conversation_id=message.conversation_id,
            user_id=user_id,
            rating=request.rating,
            comment=request.comment.strip() if request.comment else None,
            category=request.category.strip() if request.category else None,
        )
        db.add(feedback)
        db.commit()
        db.refresh(feedback)

        # Privacy-safe operational logging (log only IDs, rating, and category; NEVER private comment or chat text)
        logger.info(
            f"Message feedback submitted: message_id={message.id}, rating={request.rating}, category={request.category}"
        )

        return MessageFeedbackResponse(
            id=feedback.id,
            message_id=feedback.message_id,
            conversation_id=feedback.conversation_id,
            user_id=feedback.user_id,
            rating=feedback.rating,
            comment=feedback.comment,
            category=feedback.category,
            created_at=feedback.created_at,
        )

    @classmethod
    def get_feedback_for_message(
        cls,
        db: Session,
        user_id: str,
        message_id: str,
    ) -> Optional[MessageFeedbackResponse]:
        """Retrieve existing feedback for a message by the authorized owner."""
        stmt = select(MessageFeedback).where(
            MessageFeedback.user_id == user_id,
            MessageFeedback.message_id == message_id,
        )
        feedback = db.scalars(stmt).first()
        if not feedback:
            return None

        return MessageFeedbackResponse(
            id=feedback.id,
            message_id=feedback.message_id,
            conversation_id=feedback.conversation_id,
            user_id=feedback.user_id,
            rating=feedback.rating,
            comment=feedback.comment,
            category=feedback.category,
            created_at=feedback.created_at,
        )
