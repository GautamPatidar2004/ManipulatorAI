import uuid
from datetime import datetime, timezone
from sqlalchemy import Boolean, DateTime, Float, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base


class UserMemory(Base):
    """
    User memory entity for storing verified, persistent career facts and preferences.
    Tracks provenance source, timestamps, and update versioning.
    """

    __tablename__ = "user_memories"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
        index=True,
    )
    user_id: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        default="default_user",
        index=True,
        comment="User identifier (supports future multi-tenancy/auth)",
    )
    key: Mapped[str] = mapped_column(
        String(128),
        nullable=False,
        index=True,
        comment="Semantic fact identifier, e.g. target_role, years_experience",
    )
    value: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="Extracted or declared user fact content",
    )
    category: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        default="general",
        index=True,
        comment="Fact grouping: career_goals, skills, preferences, constraints",
    )
    source: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        default="chat_dialogue",
        comment="Provenance origin: chat_dialogue, direct_input, resume_parsed",
    )
    confidence: Mapped[float] = mapped_column(
        Float,
        nullable=False,
        default=1.0,
        comment="Confidence score between 0.0 and 1.0",
    )
    version: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=1,
        comment="Monotonic version for update tracking",
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        index=True,
        comment="Flag for active state vs superseded facts",
    )
    source_conversation_id: Mapped[str | None] = mapped_column(
        String(64),
        nullable=True,
        index=True,
        comment="Source conversation where fact was established or corrected",
    )
    source_message_id: Mapped[str | None] = mapped_column(
        String(64),
        nullable=True,
        index=True,
        comment="Source message provenance ID",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    def __repr__(self) -> str:
        return f"<UserMemory(id={self.id!r}, key={self.key!r}, category={self.category!r}, active={self.is_active})>"
