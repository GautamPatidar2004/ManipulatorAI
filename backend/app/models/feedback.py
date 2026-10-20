import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import DateTime, ForeignKey, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base


class MessageFeedback(Base):
    """
    Message-level feedback from users (helpful/unhelpful + optional comment).
    Stored securely for offline analysis; never directly injected as system instructions
    nor used to mutate model weights automatically.
    """

    __tablename__ = "message_feedback"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
        index=True,
    )
    message_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("messages.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    conversation_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("conversations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        default="default_user",
        index=True,
    )
    rating: Mapped[str] = mapped_column(
        String(16),  # 'helpful' or 'unhelpful'
        nullable=False,
    )
    comment: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    category: Mapped[Optional[str]] = mapped_column(
        String(64),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    __table_args__ = (
        UniqueConstraint("user_id", "message_id", name="uq_user_message_feedback"),
    )

    def __repr__(self) -> str:
        return f"<MessageFeedback(id={self.id!r}, message_id={self.message_id!r}, rating={self.rating!r})>"
