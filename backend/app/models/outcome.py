import uuid
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import DateTime, Float, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base


class VerifiedOutcome(Base):
    """
    Verified vocational and employment outcome entity.
    Tracks empirical placement rates, salary benchmarks, and NSQF levels
    with required provenance source URL and verification status.
    """

    __tablename__ = "verified_outcomes"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
        index=True,
    )
    trade: Mapped[str] = mapped_column(
        String(128),
        nullable=False,
        index=True,
        comment="Vocational trade, occupation, or role name, e.g. 'Electrician'",
    )
    training_provider: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        index=True,
        comment="Training institute, ITI, or provider organization",
    )
    location: Mapped[str] = mapped_column(
        String(128),
        nullable=False,
        index=True,
        comment="Geographic region / city / state of training/placement",
    )
    nsqf_level: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        comment="National Skills Qualification Framework level, e.g. 'Level 4'",
    )
    placement_rate: Mapped[float] = mapped_column(
        Float,
        nullable=False,
        comment="Empirical placement percentage, e.g. 84.5",
    )
    post_training_earnings_range: Mapped[str] = mapped_column(
        String(128),
        nullable=False,
        comment="Monthly or annual earnings range, e.g. '₹18,000 - ₹24,000 / month'",
    )
    reporting_period: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        comment="Evaluation time window, e.g. '2023-2024' or 'Q3 2024'",
    )
    sample_size: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        comment="Number of surveyed/graduated trainees in cohort",
    )
    progression_pathways: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="Vertical progression steps, e.g. 'Junior Wireman -> Supervisor -> Electrical Contractor'",
    )
    source_url: Mapped[str] = mapped_column(
        String(512),
        nullable=False,
        comment="Mandatory provenance URL or audit citation link",
    )
    verification_status: Mapped[str] = mapped_column(
        String(32),
        server_default="unverified",
        default="unverified",
        nullable=False,
        index=True,
        comment="Status: 'verified', 'unverified', or 'pending_review'",
    )
    last_verified_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        comment="Date when the outcome data was last reviewed or validated",
    )
    verified_by: Mapped[Optional[str]] = mapped_column(
        String(36),
        nullable=True,
        comment="Admin identifier who verified the record",
    )
    notes: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="Administrative provenance or audit notes",
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
        return f"<VerifiedOutcome(id={self.id!r}, trade={self.trade!r}, status={self.verification_status!r})>"
