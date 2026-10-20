from datetime import datetime
from typing import List, Literal, Optional
from pydantic import BaseModel, Field

# Approved memory categories for career counselling context
MemoryCategory = Literal[
    "education",
    "career_goals",
    "skills",
    "interests",
    "preferences",
    "constraints",
    "previous_discussions",
    "general",
]


class ExtractedMemoryFact(BaseModel):
    key: str = Field(..., min_length=2, max_length=128)
    value: str = Field(..., min_length=1, max_length=1000)
    category: MemoryCategory = "general"
    confidence: float = Field(default=0.9, ge=0.0, le=1.0)
    is_correction: bool = False
    supersedes_key: Optional[str] = None


class UserMemoryCreateRequest(BaseModel):
    key: str = Field(..., min_length=2, max_length=128)
    value: str = Field(..., min_length=1, max_length=1000)
    category: MemoryCategory = "general"
    confidence: float = Field(default=1.0, ge=0.0, le=1.0)


class UserMemoryUpdateRequest(BaseModel):
    value: str = Field(..., min_length=1, max_length=1000)
    category: Optional[MemoryCategory] = None


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
    source_conversation_id: Optional[str] = None
    source_message_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class MemoryRetrievalResult(BaseModel):
    facts: List[UserMemoryResponse] = Field(default_factory=list)
    prompt_context: Optional[str] = None
    token_count_estimate: int = 0
    has_conflicts: bool = False
    conflict_notes: List[str] = Field(default_factory=list)


class MemoryForgetResponse(BaseModel):
    forgotten_count: int
    message: str
    user_id: str
