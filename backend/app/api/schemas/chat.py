from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Conversation Schemas
# ---------------------------------------------------------------------------

class ConversationCreateRequest(BaseModel):
    title: Optional[str] = Field(default="New Consultation", max_length=255, description="Initial conversation title")


class ConversationUpdateRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=255, description="Updated conversation title")


class ConversationResponse(BaseModel):
    id: str = Field(description="Conversation ID")
    title: str = Field(description="Conversation title")
    created_at: datetime = Field(description="Creation timestamp")
    updated_at: datetime = Field(description="Last update timestamp")
    message_count: int = Field(default=0, description="Total messages in conversation")


class ConversationListResponse(BaseModel):
    conversations: List[ConversationResponse]
    total: int = 0


# Backwards compatibility alias for existing frontend
ConversationSession = ConversationResponse


# ---------------------------------------------------------------------------
# Message Schemas
# ---------------------------------------------------------------------------

class StructuredBlock(BaseModel):
    """Placeholder schema for future structured responses (e.g., roadmaps, skill matrices)."""
    type: str = Field(description="Structured block type identifier, e.g. 'career_roadmap', 'skill_analysis'")
    title: Optional[str] = Field(default=None, description="Section title")
    data: Optional[Dict[str, Any]] = Field(default=None, description="Structured attributes payload")


class MessageCreateRequest(BaseModel):
    role: str = Field(default="user", pattern="^(user|assistant|system)$", description="Message role")
    content: str = Field(..., min_length=1, max_length=4000, description="Message content body")
    status: str = Field(default="ready", description="Status identifier")
    notice: Optional[str] = Field(default=None, description="Optional system notice")
    structured: Optional[Dict[str, Any]] = Field(default=None, description="Optional structured payload")


class MessageResponse(BaseModel):
    id: str = Field(description="Message unique ID")
    conversation_id: str = Field(description="Associated conversation ID")
    role: str = Field(description="Message role: user | assistant | system")
    content: str = Field(description="Message body text")
    status: str = Field(default="ready", description="Message status: ready | unavailable | error")
    notice: Optional[str] = Field(default=None, description="Notice text")
    structured: Optional[Dict[str, Any]] = Field(default=None, description="Structured payload")
    created_at: datetime = Field(description="Timestamp message was recorded")


class MessageListResponse(BaseModel):
    conversation_id: str
    messages: List[MessageResponse]
    total: int


# ---------------------------------------------------------------------------
# Chat Turn Endpoint Schemas (Compatible with existing frontend chat contract)
# ---------------------------------------------------------------------------

class ChatMessageRequest(BaseModel):
    session_id: Optional[str] = Field(default=None, description="Optional active conversation session ID")
    conversation_id: Optional[str] = Field(default=None, description="Alias for session_id")
    message: str = Field(..., min_length=1, max_length=4000, description="User query prompt text")

    @property
    def effective_conversation_id(self) -> Optional[str]:
        return self.conversation_id or self.session_id


class ChatMessageResponse(BaseModel):
    id: str = Field(description="Unique message identifier")
    session_id: str = Field(description="Conversation session identifier")
    role: str = Field(default="assistant", description="Message sender role: 'user' | 'assistant'")
    content: str = Field(description="Message body text")
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    status: str = Field(
        default="unavailable",
        description="Response status: 'unavailable' (AI engine pending setup), 'ready', or 'error'"
    )
    structured: Optional[StructuredBlock] = Field(
        default=None,
        description="Optional structured response payload for career recommendations"
    )
    notice: Optional[str] = Field(
        default=None,
        description="Explicit system notice regarding AI availability status"
    )


# ---------------------------------------------------------------------------
# User Memory Schemas (User memory foundation)
# ---------------------------------------------------------------------------

class UserMemoryCreateRequest(BaseModel):
    key: str = Field(..., min_length=1, max_length=128, description="Semantic key for fact")
    value: str = Field(..., min_length=1, description="Fact content")
    category: str = Field(default="general", max_length=64, description="Fact category")
    source: str = Field(default="chat_dialogue", max_length=64, description="Provenance source")
    confidence: float = Field(default=1.0, ge=0.0, le=1.0, description="Confidence rating")


class UserMemoryResponse(BaseModel):
    id: str
    user_id: str
    key: str
    value: str
    category: str
    source: str
    confidence: float
    version: int
    is_active: bool
    created_at: datetime
    updated_at: datetime
