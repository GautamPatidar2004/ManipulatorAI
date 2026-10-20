import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from app.ai import AIMessage, BaseAIProvider, get_ai_provider
from app.ai.exceptions import AIError
from app.config import Settings, get_settings
from app.core.errors import NotFoundError
from app.models.conversation import Conversation
from app.models.message import Message
from app.models.memory import UserMemory


class ChatService:
    """Service providing transactional database operations for conversations, messages and memory."""

    @staticmethod
    def create_conversation(
        db: Session,
        title: Optional[str] = None,
        user_id: Optional[str] = "default_user",
    ) -> Conversation:
        """Create and persist a new conversation thread."""
        conv = Conversation(
            id=f"conv_{uuid.uuid4().hex[:12]}",
            title=(title.strip() if title and title.strip() else "New Consultation"),
            user_id=user_id or "default_user",
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        db.add(conv)
        db.commit()
        db.refresh(conv)
        return conv

    @staticmethod
    def list_conversations(
        db: Session,
        limit: int = 50,
        offset: int = 0,
        user_id: Optional[str] = None,
    ) -> List[dict]:
        """List conversations ordered by most recently updated with message counts."""
        query = (
            select(
                Conversation,
                func.count(Message.id).label("message_count"),
            )
            .outerjoin(Message, Conversation.id == Message.conversation_id)
        )
        if user_id:
            query = query.where(
                (Conversation.user_id == user_id)
                | (Conversation.user_id.is_(None))
                | (Conversation.user_id == "default_user")
            )

        stmt = (
            query.group_by(Conversation.id)
            .order_by(Conversation.updated_at.desc())
            .limit(limit)
            .offset(offset)
        )
        results = db.execute(stmt).all()

        conversations = []
        for conv, count in results:
            conversations.append({
                "id": conv.id,
                "title": conv.title,
                "created_at": conv.created_at,
                "updated_at": conv.updated_at,
                "message_count": count,
            })
        return conversations

    @staticmethod
    def get_conversation_or_404(db: Session, conversation_id: str) -> Conversation:
        """Fetch conversation by ID or raise NotFoundError."""
        conv = db.get(Conversation, conversation_id)
        if not conv:
            raise NotFoundError(f"Conversation with ID '{conversation_id}' was not found.")
        return conv

    @staticmethod
    def update_conversation_title(db: Session, conversation_id: str, new_title: str) -> Conversation:
        """Rename an existing conversation."""
        conv = ChatService.get_conversation_or_404(db, conversation_id)
        conv.title = new_title.strip()
        conv.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(conv)
        return conv

    @staticmethod
    def delete_conversation(db: Session, conversation_id: str) -> bool:
        """Delete a conversation and all its cascaded messages."""
        conv = ChatService.get_conversation_or_404(db, conversation_id)
        db.delete(conv)
        db.commit()
        return True

    @staticmethod
    def list_messages(db: Session, conversation_id: str) -> List[Message]:
        """Retrieve all messages for a given conversation ordered by created_at ascending."""
        ChatService.get_conversation_or_404(db, conversation_id)
        stmt = (
            select(Message)
            .where(Message.conversation_id == conversation_id)
            .order_by(Message.created_at.asc())
        )
        return list(db.scalars(stmt).all())

    @staticmethod
    def persist_message(
        db: Session,
        conversation_id: str,
        role: str,
        content: str,
        status: str = "ready",
        notice: Optional[str] = None,
        structured: Optional[Dict[str, Any]] = None,
    ) -> Message:
        """Persist a single message under an existing conversation."""
        conv = ChatService.get_conversation_or_404(db, conversation_id)
        msg = Message(
            id=f"msg_{uuid.uuid4().hex[:12]}",
            conversation_id=conversation_id,
            role=role,
            content=content,
            status=status,
            notice=notice,
            structured=structured,
            created_at=datetime.now(timezone.utc),
        )
        db.add(msg)
        conv.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(msg)
        return msg

    @staticmethod
    async def process_chat_turn(
        db: Session,
        conversation_id: Optional[str],
        user_message_text: str,
        settings: Optional[Settings] = None,
    ) -> tuple[Message, Message]:
        """
        Processes a full dialogue turn:
        1. Resolves or initializes conversation.
        2. Adds user message to dialogue history.
        3. Invokes active AI provider (Gemini / Groq / OpenAI) with conversation context.
        4. If AI provider is unconfigured, returns explicit transparent notice.
        5. Atomically commits user and assistant messages to database.
        """
        cfg = settings or get_settings()
        now = datetime.now(timezone.utc)
        clean_text = user_message_text.strip()

        # 1. Resolve or create conversation
        if conversation_id:
            conv = db.get(Conversation, conversation_id)
            if not conv:
                snippet = clean_text[:36]
                title = f"{snippet}..." if len(clean_text) > 36 else snippet
                conv = Conversation(
                    id=conversation_id,
                    title=title or "New Consultation",
                    created_at=now,
                    updated_at=now,
                )
                db.add(conv)
                db.flush()
        else:
            snippet = clean_text[:36]
            title = f"{snippet}..." if len(clean_text) > 36 else snippet
            conv = Conversation(
                id=f"conv_{uuid.uuid4().hex[:12]}",
                title=title or "New Consultation",
                created_at=now,
                updated_at=now,
            )
            db.add(conv)
            db.flush()

        # 2. Add user message
        user_msg = Message(
            id=f"msg_{uuid.uuid4().hex[:12]}",
            conversation_id=conv.id,
            role="user",
            content=clean_text,
            status="ready",
            notice=None,
            structured=None,
            created_at=now,
        )
        db.add(user_msg)
        db.flush()

        # 3. Check AI Provider
        provider: Optional[BaseAIProvider] = get_ai_provider(cfg)

        if provider is None:
            # Explicit unconfigured/unavailable response per contract
            assistant_content = (
                "The AI Career Counsellor engine is currently unavailable / not configured. "
                "To enable live career intelligence, configure AI_PROVIDER (gemini, groq, or openai) "
                "with a valid API key in backend/.env."
            )
            assistant_msg = Message(
                id=f"msg_{uuid.uuid4().hex[:12]}",
                conversation_id=conv.id,
                role="assistant",
                content=assistant_content,
                status="unavailable",
                notice="AI Service Pending Configuration (No mock data returned)",
                structured=None,
                created_at=datetime.now(timezone.utc),
            )
            db.add(assistant_msg)
            conv.updated_at = datetime.now(timezone.utc)
            db.commit()
            db.refresh(user_msg)
            db.refresh(assistant_msg)
            return user_msg, assistant_msg

        # 4. Load persisted conversation history for conversational context
        stmt = (
            select(Message)
            .where(Message.conversation_id == conv.id)
            .order_by(Message.created_at.asc())
        )
        existing_history = list(db.scalars(stmt).all())

        # Construct normalized AI messages history
        ai_messages: List[AIMessage] = []
        for m in existing_history:
            if m.role in ("user", "assistant"):
                ai_messages.append(AIMessage(role=m.role, content=m.content))

        # 5. Invoke Counselling Orchestration Layer with rollback protection
        from app.counselling import CounsellingOrchestrator
        try:
            counsel_res = await CounsellingOrchestrator.process_counselling_turn(
                db=db,
                user_message=clean_text,
                dialogue_history=ai_messages,
                settings=cfg,
                provider=provider,
                user_id="default_user",
                conversation_id=conv.id,
                message_id=user_msg.id,
            )

            # Structure representation separating facts, recommendations, and evidence
            structured_data = counsel_res.structured.model_dump()
            if counsel_res.versioned:
                v_dump = counsel_res.versioned.model_dump()
                structured_data["version"] = v_dump.get("version", "1.0")
                structured_data["blocks"] = v_dump.get("blocks", [])

            structured_payload = {
                "type": "counselling_response",
                "title": f"Career Guidance ({counsel_res.structured.intent.replace('_', ' ').title()})",
                "version": structured_data.get("version", "1.0"),
                "blocks": structured_data.get("blocks", []),
                "data": structured_data,
            }

            # If verified sources were present, preserve citation block for UI evidence display
            if counsel_res.structured.evidence_sources:
                structured_payload["type"] = "rag_evidence"
                structured_payload["title"] = "Verified Reference Citations"
                structured_payload["data"]["summary"] = f"Grounded on {len(counsel_res.structured.evidence_sources)} verified reference source(s)."
                structured_payload["data"]["items"] = [
                    f"{s['title']} (Match: {int(s.get('similarity_score', 0) * 100)}%)"
                    for s in counsel_res.structured.evidence_sources
                ]
                structured_payload["data"]["sources"] = counsel_res.structured.evidence_sources

            is_unavailable = counsel_res.notice and "Pending Configuration" in counsel_res.notice
            assistant_msg = Message(
                id=f"msg_{uuid.uuid4().hex[:12]}",
                conversation_id=conv.id,
                role="assistant",
                content=counsel_res.content,
                status="unavailable" if is_unavailable else "ready",
                notice=counsel_res.notice,
                structured=structured_payload if (counsel_res.versioned or counsel_res.structured.evidence_sources or counsel_res.structured.recommendations) else None,
                created_at=datetime.now(timezone.utc),
            )
            db.add(assistant_msg)
            conv.updated_at = datetime.now(timezone.utc)
            db.commit()
            db.refresh(user_msg)
            db.refresh(assistant_msg)
            return user_msg, assistant_msg

        except AIError:
            db.rollback()
            raise

    # ---------------------------------------------------------------------------
    # User Memory Foundation Operations
    # ---------------------------------------------------------------------------

    @staticmethod
    def upsert_user_memory(
        db: Session,
        key: str,
        value: str,
        category: str = "general",
        source: str = "chat_dialogue",
        confidence: float = 1.0,
        user_id: str = "default_user",
    ) -> UserMemory:
        """Store or update a verified user memory fact with monotonic versioning."""
        stmt = select(UserMemory).where(
            UserMemory.user_id == user_id,
            UserMemory.key == key,
            UserMemory.is_active.is_(True),
        )
        existing = db.scalars(stmt).first()

        now = datetime.now(timezone.utc)
        if existing:
            existing.value = value
            existing.category = category
            existing.source = source
            existing.confidence = confidence
            existing.version += 1
            existing.updated_at = now
            db.commit()
            db.refresh(existing)
            return existing

        memory = UserMemory(
            id=f"mem_{uuid.uuid4().hex[:12]}",
            user_id=user_id,
            key=key,
            value=value,
            category=category,
            source=source,
            confidence=confidence,
            version=1,
            is_active=True,
            created_at=now,
            updated_at=now,
        )
        db.add(memory)
        db.commit()
        db.refresh(memory)
        return memory

    @staticmethod
    def list_user_memories(
        db: Session,
        user_id: str = "default_user",
        active_only: bool = True,
    ) -> List[UserMemory]:
        """List user memories for the user."""
        stmt = select(UserMemory).where(UserMemory.user_id == user_id)
        if active_only:
            stmt = stmt.where(UserMemory.is_active.is_(True))
        stmt = stmt.order_by(UserMemory.updated_at.desc())
        return list(db.scalars(stmt).all())
