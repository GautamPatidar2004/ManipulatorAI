from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session
from app.api.dependencies import get_current_user_from_token
from app.models.user import User
from app.api.schemas.chat import (
    ChatMessageRequest,
    ChatMessageResponse,
    ConversationCreateRequest,
    ConversationListResponse,
    ConversationResponse,
    ConversationUpdateRequest,
    MessageCreateRequest,
    MessageListResponse,
    MessageResponse,
    StructuredBlock,
    UserMemoryCreateRequest,
    UserMemoryResponse,
)
from app.config import Settings, get_settings
from app.db.session import get_db
from app.services.chat_service import ChatService

router = APIRouter(prefix="/chat", tags=["Chat"])


# ---------------------------------------------------------------------------
# Chat Turn Endpoint
# ---------------------------------------------------------------------------

@router.post("/message", response_model=ChatMessageResponse, summary="Process chat message turn")
async def send_chat_message(
    payload: ChatMessageRequest,
    user: Optional[User] = Depends(get_current_user_from_token),
    settings: Settings = Depends(get_settings),
    db: Session = Depends(get_db),
) -> ChatMessageResponse:
    """
    Process an incoming user message.
    Persists both user query and assistant response in PostgreSQL.
    Invokes active AI provider if configured, or returns explicit notice if pending setup.
    """
    user_id = user.id if user else "default_user"
    _, assistant_msg = await ChatService.process_chat_turn(
        db=db,
        conversation_id=payload.effective_conversation_id,
        user_message_text=payload.message,
        settings=settings,
    )

    return ChatMessageResponse(
        id=assistant_msg.id,
        session_id=assistant_msg.conversation_id,
        role=assistant_msg.role,
        content=assistant_msg.content,
        timestamp=assistant_msg.created_at,
        status=assistant_msg.status,
        notice=assistant_msg.notice,
        structured=StructuredBlock(**assistant_msg.structured) if assistant_msg.structured else None,
    )


# ---------------------------------------------------------------------------
# Conversation Management Endpoints
# ---------------------------------------------------------------------------

@router.get("/conversations", response_model=ConversationListResponse, summary="List conversations")
def list_conversations(
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    user: Optional[User] = Depends(get_current_user_from_token),
    db: Session = Depends(get_db),
) -> ConversationListResponse:
    """Retrieve all conversations ordered by last update with message counts."""
    user_id = user.id if user else None
    items = ChatService.list_conversations(db=db, limit=limit, offset=offset, user_id=user_id)
    return ConversationListResponse(
        conversations=[ConversationResponse(**item) for item in items],
        total=len(items),
    )


# Backwards compatibility alias for existing frontend client
@router.get("/sessions", response_model=ConversationListResponse, include_in_schema=False)
def list_sessions_alias(
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    user: Optional[User] = Depends(get_current_user_from_token),
    db: Session = Depends(get_db),
) -> ConversationListResponse:
    return list_conversations(limit=limit, offset=offset, user=user, db=db)


@router.post(
    "/conversations",
    response_model=ConversationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new conversation",
)
def create_conversation(
    payload: ConversationCreateRequest,
    user: Optional[User] = Depends(get_current_user_from_token),
    db: Session = Depends(get_db),
) -> ConversationResponse:
    """Initialize and persist a clean conversation thread."""
    user_id = user.id if user else "default_user"
    conv = ChatService.create_conversation(db=db, title=payload.title, user_id=user_id)
    return ConversationResponse(
        id=conv.id,
        title=conv.title,
        created_at=conv.created_at,
        updated_at=conv.updated_at,
        message_count=0,
    )


# Backwards compatibility alias for existing frontend client
@router.post("/sessions", response_model=ConversationResponse, include_in_schema=False)
def create_session_alias(
    payload: ConversationCreateRequest = ConversationCreateRequest(),
    user: Optional[User] = Depends(get_current_user_from_token),
    db: Session = Depends(get_db),
) -> ConversationResponse:
    return create_conversation(payload=payload, user=user, db=db)


@router.patch("/conversations/{conversation_id}", response_model=ConversationResponse, summary="Rename conversation")
def rename_conversation(
    conversation_id: str,
    payload: ConversationUpdateRequest,
    db: Session = Depends(get_db),
) -> ConversationResponse:
    """Update conversation title."""
    conv = ChatService.update_conversation_title(db=db, conversation_id=conversation_id, new_title=payload.title)
    messages = ChatService.list_messages(db=db, conversation_id=conversation_id)
    return ConversationResponse(
        id=conv.id,
        title=conv.title,
        created_at=conv.created_at,
        updated_at=conv.updated_at,
        message_count=len(messages),
    )


@router.delete(
    "/conversations/{conversation_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete conversation and its messages",
)
def delete_conversation(
    conversation_id: str,
    db: Session = Depends(get_db),
) -> None:
    """Delete a conversation and all cascaded messages."""
    ChatService.delete_conversation(db=db, conversation_id=conversation_id)


# ---------------------------------------------------------------------------
# Message Retrieval and Persistence Endpoints
# ---------------------------------------------------------------------------

@router.get(
    "/conversations/{conversation_id}/messages",
    response_model=MessageListResponse,
    summary="Retrieve all messages in a conversation",
)
def get_conversation_messages(
    conversation_id: str,
    db: Session = Depends(get_db),
) -> MessageListResponse:
    """Fetch chronological message dialogue for a specific conversation."""
    messages = ChatService.list_messages(db=db, conversation_id=conversation_id)
    return MessageListResponse(
        conversation_id=conversation_id,
        messages=[
            MessageResponse(
                id=m.id,
                conversation_id=m.conversation_id,
                role=m.role,
                content=m.content,
                status=m.status,
                notice=m.notice,
                structured=m.structured,
                created_at=m.created_at,
            )
            for m in messages
        ],
        total=len(messages),
    )


@router.post(
    "/conversations/{conversation_id}/messages",
    response_model=MessageResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Persist a message to a conversation",
)
def persist_message(
    conversation_id: str,
    payload: MessageCreateRequest,
    db: Session = Depends(get_db),
) -> MessageResponse:
    """Explicitly save a user or assistant message to database."""
    msg = ChatService.persist_message(
        db=db,
        conversation_id=conversation_id,
        role=payload.role,
        content=payload.content,
        status=payload.status,
        notice=payload.notice,
        structured=payload.structured,
    )
    return MessageResponse(
        id=msg.id,
        conversation_id=msg.conversation_id,
        role=msg.role,
        content=msg.content,
        status=msg.status,
        notice=msg.notice,
        structured=msg.structured,
        created_at=msg.created_at,
    )


# ---------------------------------------------------------------------------
# User Memory Foundation Endpoints
# ---------------------------------------------------------------------------

@router.post(
    "/memory",
    response_model=UserMemoryResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Record or update a verified user fact",
)
def record_user_memory(
    payload: UserMemoryCreateRequest,
    user_id: str = Query(default="default_user"),
    db: Session = Depends(get_db),
) -> UserMemoryResponse:
    """Store stable user fact with versioning and update tracking."""
    mem = ChatService.upsert_user_memory(
        db=db,
        key=payload.key,
        value=payload.value,
        category=payload.category,
        source=payload.source,
        confidence=payload.confidence,
        user_id=user_id,
    )
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
        created_at=mem.created_at,
        updated_at=mem.updated_at,
    )


@router.get(
    "/memory",
    response_model=List[UserMemoryResponse],
    summary="List active user memory facts",
)
def list_user_memories(
    user_id: str = Query(default="default_user"),
    active_only: bool = Query(default=True),
    db: Session = Depends(get_db),
) -> List[UserMemoryResponse]:
    """Retrieve recorded user facts for personalization foundation."""
    memories = ChatService.list_user_memories(db=db, user_id=user_id, active_only=active_only)
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
            created_at=m.created_at,
            updated_at=m.updated_at,
        )
        for m in memories
    ]
