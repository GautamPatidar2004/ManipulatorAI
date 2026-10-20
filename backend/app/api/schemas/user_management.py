from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field
from app.api.schemas.auth import UserProfileResponse


class UserSummaryResponse(BaseModel):
    """User summary for searchable roster."""
    id: str
    email: str
    full_name: str
    role: str
    is_active: bool
    created_at: datetime
    conversation_count: int = 0
    feedback_count: int = 0
    last_active_at: Optional[datetime] = None


class PaginatedUsersResponse(BaseModel):
    """Paginated user roster."""
    items: List[UserSummaryResponse]
    users: List[UserSummaryResponse] = Field(default=[], description="Alias for items for backward compatibility")
    total: int
    page: int
    limit: int
    total_pages: int



class UserConversationBrief(BaseModel):
    id: str
    title: str
    created_at: datetime
    updated_at: datetime
    message_count: int


class UserFeedbackBrief(BaseModel):
    id: str
    message_id: str
    conversation_id: str
    rating: str
    category: Optional[str] = None
    created_at: datetime


class UserDetailResponse(BaseModel):
    """Detailed user profile with consultation activity and privacy-safe history."""
    user: UserProfileResponse
    conversations: List[UserConversationBrief]
    feedback: List[UserFeedbackBrief]
    active_memories_count: int = 0
    escalation_cases_count: int = 0


class UserStatusUpdateRequest(BaseModel):
    """Payload for activating or deactivating an account."""
    is_active: bool = Field(description="Target account active status")
