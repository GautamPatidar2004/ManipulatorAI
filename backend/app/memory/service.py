import re
import uuid
from datetime import datetime, timezone
from typing import List, Optional, Tuple
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.core.logging import get_logger
from app.memory.schemas import (
    ExtractedMemoryFact,
    MemoryRetrievalResult,
    UserMemoryResponse,
)
from app.models.memory import UserMemory

logger = get_logger("memory_service")


class MemoryService:
    """
    Persistent conversational memory service.
    Handles storage, monotonic versioning, correction overrides, conflict detection,
    and token-bounded relevance retrieval.
    """

    @classmethod
    def upsert_fact(
        cls,
        db: Session,
        user_id: str,
        fact: ExtractedMemoryFact,
        source_conversation_id: Optional[str] = None,
        source_message_id: Optional[str] = None,
    ) -> UserMemory:
        """
        Store or update a verified user fact.
        If a prior fact for the key exists with a different value or explicit correction,
        the prior fact is superseded and version is incremented.
        """
        now = datetime.now(timezone.utc)

        # Look for existing active memory under this key
        stmt = select(UserMemory).where(
            UserMemory.user_id == user_id,
            UserMemory.key == fact.key,
            UserMemory.is_active.is_(True),
        )
        existing = db.scalars(stmt).first()

        if existing:
            # If value is unchanged, just refresh timestamp and source
            if existing.value.strip().lower() == fact.value.strip().lower():
                existing.updated_at = now
                if source_conversation_id:
                    existing.source_conversation_id = source_conversation_id
                if source_message_id:
                    existing.source_message_id = source_message_id
                db.commit()
                db.refresh(existing)
                return existing

            # Supersede existing fact with explicit incremented version
            existing.is_active = False
            existing.updated_at = now
            db.flush()

            new_memory = UserMemory(
                id=str(uuid.uuid4()),
                user_id=user_id,
                key=fact.key,
                value=fact.value.strip(),
                category=fact.category,
                source="chat_correction" if fact.is_correction else "chat_dialogue",
                confidence=fact.confidence,
                version=existing.version + 1,
                is_active=True,
                source_conversation_id=source_conversation_id,
                source_message_id=source_message_id,
                created_at=now,
                updated_at=now,
            )
            db.add(new_memory)
            db.commit()
            db.refresh(new_memory)
            logger.info(f"Superseded memory '{fact.key}' for user '{user_id}' -> v{new_memory.version}")
            return new_memory

        # Fresh fact
        new_memory = UserMemory(
            id=str(uuid.uuid4()),
            user_id=user_id,
            key=fact.key,
            value=fact.value.strip(),
            category=fact.category,
            source="chat_correction" if fact.is_correction else "chat_dialogue",
            confidence=fact.confidence,
            version=1,
            is_active=True,
            source_conversation_id=source_conversation_id,
            source_message_id=source_message_id,
            created_at=now,
            updated_at=now,
        )
        db.add(new_memory)
        db.commit()
        db.refresh(new_memory)
        logger.info(f"Recorded new memory '{fact.key}' for user '{user_id}' (v1)")
        return new_memory

    @classmethod
    def get_relevant_memories(
        cls,
        db: Session,
        user_id: str,
        query_text: str = "",
        max_facts: int = 8,
        max_tokens: int = 400,
    ) -> MemoryRetrievalResult:
        """
        Select active memories for user_id filtered and ranked by relevance to query,
        bounded by token budget limits without dumping whole history.
        """
        stmt = (
            select(UserMemory)
            .where(
                UserMemory.user_id == user_id,
                UserMemory.is_active.is_(True),
            )
            .order_by(UserMemory.updated_at.desc())
        )
        all_memories = list(db.scalars(stmt).all())

        if not all_memories:
            return MemoryRetrievalResult(facts=[], prompt_context=None, token_count_estimate=0)

        # Relevance scoring based on query terms
        query_words = set(re.findall(r"\w+", query_text.lower()))

        def score_memory(m: UserMemory) -> Tuple[int, datetime]:
            score = 0
            key_words = set(re.findall(r"\w+", m.key.lower()))
            val_words = set(re.findall(r"\w+", m.value.lower()))
            cat_words = set(re.findall(r"\w+", m.category.lower()))

            # Keyword overlap adds relevance
            score += len(query_words.intersection(key_words)) * 3
            score += len(query_words.intersection(val_words)) * 2
            score += len(query_words.intersection(cat_words)) * 1

            # High priority categories for career decisions
            if m.category in ("education", "career_goals", "constraints"):
                score += 2

            return (score, m.updated_at)

        ranked = sorted(all_memories, key=score_memory, reverse=True)
        selected: List[UserMemory] = []
        token_estimate = 0

        for mem in ranked[:max_facts]:
            # Approximate token estimation (~4 characters per token)
            line = f"- {mem.key} ({mem.category}): {mem.value}"
            cost = max(1, len(line) // 4)
            if token_estimate + cost > max_tokens and selected:
                break
            selected.append(mem)
            token_estimate += cost

        # Conflict Detection check
        conflict_notes: List[str] = []
        target_roles = [m.value for m in selected if m.key == "target_role"]
        if len(target_roles) > 1:
            conflict_notes.append(f"Multiple active target roles recorded: {', '.join(target_roles)}")

        # Construct sanitized prompt context
        lines = ["[RECORDED_STUDENT_PROFILE_FACTS]"]
        for m in selected:
            # Escape newlines to prevent injection
            val_escaped = m.value.replace("\n", " ").strip()
            lines.append(f"- {m.key} ({m.category}): {val_escaped}")
        lines.append("[END_RECORDED_STUDENT_PROFILE_FACTS]")

        prompt_context = "\n".join(lines)
        responses = [
            UserMemoryResponse(
                id=m.id,
                user_id=m.user_id,
                key=m.key,
                value=m.value,
                category=m.category,
                source=m.source,
                confidence=m.confidence,
                version=m.version,
                is_active=m.is_active,
                source_conversation_id=m.source_conversation_id,
                source_message_id=m.source_message_id,
                created_at=m.created_at,
                updated_at=m.updated_at,
            )
            for m in selected
        ]

        return MemoryRetrievalResult(
            facts=responses,
            prompt_context=prompt_context,
            token_count_estimate=token_estimate,
            has_conflicts=len(conflict_notes) > 0,
            conflict_notes=conflict_notes,
        )

    @classmethod
    def list_active_memories(cls, db: Session, user_id: str) -> List[UserMemoryResponse]:
        """List all active memories for the user."""
        stmt = (
            select(UserMemory)
            .where(
                UserMemory.user_id == user_id,
                UserMemory.is_active.is_(True),
            )
            .order_by(UserMemory.updated_at.desc())
        )
        memories = list(db.scalars(stmt).all())
        return [
            UserMemoryResponse(
                id=m.id,
                user_id=m.user_id,
                key=m.key,
                value=m.value,
                category=m.category,
                source=m.source,
                confidence=m.confidence,
                version=m.version,
                is_active=m.is_active,
                source_conversation_id=m.source_conversation_id,
                source_message_id=m.source_message_id,
                created_at=m.created_at,
                updated_at=m.updated_at,
            )
            for m in memories
        ]

    @classmethod
    def update_memory(
        cls,
        db: Session,
        user_id: str,
        memory_id: str,
        new_value: str,
        new_category: Optional[str] = None,
    ) -> Optional[UserMemoryResponse]:
        """Manually update or correct a fact, enforcing ownership."""
        stmt = select(UserMemory).where(
            UserMemory.id == memory_id,
            UserMemory.user_id == user_id,
        )
        mem = db.scalars(stmt).first()
        if not mem:
            return None

        now = datetime.now(timezone.utc)
        mem.value = new_value.strip()
        if new_category:
            mem.category = new_category
        mem.version += 1
        mem.source = "direct_correction"
        mem.updated_at = now
        db.commit()
        db.refresh(mem)

        return UserMemoryResponse(
            id=mem.id,
            user_id=mem.user_id,
            key=mem.key,
            value=mem.value,
            category=mem.category,
            source=mem.source,
            confidence=mem.confidence,
            version=mem.version,
            is_active=mem.is_active,
            source_conversation_id=mem.source_conversation_id,
            source_message_id=mem.source_message_id,
            created_at=mem.created_at,
            updated_at=mem.updated_at,
        )

    @classmethod
    def delete_memory(cls, db: Session, user_id: str, memory_id: str) -> bool:
        """Deactivate/forget a single fact, enforcing ownership."""
        stmt = select(UserMemory).where(
            UserMemory.id == memory_id,
            UserMemory.user_id == user_id,
            UserMemory.is_active.is_(True),
        )
        mem = db.scalars(stmt).first()
        if not mem:
            return False

        mem.is_active = False
        mem.updated_at = datetime.now(timezone.utc)
        db.commit()
        return True

    @classmethod
    def forget_all(cls, db: Session, user_id: str) -> int:
        """Forget/deactivate all persistent memories for the user."""
        stmt = (
            update(UserMemory)
            .where(
                UserMemory.user_id == user_id,
                UserMemory.is_active.is_(True),
            )
            .values(
                is_active=False,
                updated_at=datetime.now(timezone.utc),
            )
        )
        result = db.execute(stmt)
        db.commit()
        return result.rowcount or 0
