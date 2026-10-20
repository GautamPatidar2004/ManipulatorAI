import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional
from pgvector.sqlalchemy import Vector
from sqlalchemy import DateTime, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.types import JSON
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base


class KnowledgeChunk(Base):
    """
    Knowledge chunk entity representing an embedded reference document passage for RAG.
    Tracks provenance source metadata, content hash, embedding vector, and model identity.
    """

    __tablename__ = "knowledge_chunks"
    __table_args__ = (
        UniqueConstraint("source_id", "content_hash", name="uq_knowledge_chunks_source_content"),
    )

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
        index=True,
    )
    source_id: Mapped[str] = mapped_column(
        String(128),
        nullable=False,
        index=True,
        comment="Document or origin identifier, e.g. 'career_guide_2026'",
    )
    source_title: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="Human-readable title of source document",
    )
    source_url: Mapped[Optional[str]] = mapped_column(
        String(512),
        nullable=True,
        comment="Optional canonical reference URL",
    )
    source_metadata: Mapped[Dict[str, Any]] = mapped_column(
        JSON().with_variant(JSONB, "postgresql"),
        default=dict,
        nullable=False,
        comment="Structured metadata (domain, tags, section, author, etc.)",
    )
    chunk_text: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="Passage text content",
    )
    content_hash: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        index=True,
        comment="SHA-256 hash of chunk_text to prevent duplicates",
    )
    embedding: Mapped[Any] = mapped_column(
        Vector(),
        nullable=False,
        comment="Dense embedding vector for cosine similarity retrieval",
    )
    embedding_model: Mapped[str] = mapped_column(
        String(128),
        nullable=False,
        index=True,
        comment="Model used to generate embedding, e.g. 'text-embedding-3-small'",
    )
    embedding_dim: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        comment="Dimension length of embedding vector",
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
        return f"<KnowledgeChunk(id={self.id!r}, source={self.source_id!r}, model={self.embedding_model!r})>"
