from datetime import datetime
from typing import Literal, Optional
from pydantic import BaseModel, Field


class MessageFeedbackCreateRequest(BaseModel):
    """Payload for submitting message-level feedback."""
    rating: Literal["helpful", "unhelpful"] = Field(
        ...,
        description="User rating indicating whether the counselling response was helpful or unhelpful",
    )
    comment: Optional[str] = Field(
        default=None,
        max_length=500,
        description="Optional short user comment or feedback reason",
    )
    category: Optional[str] = Field(
        default=None,
        max_length=64,
        description="Optional category (e.g. clarity, accuracy, realism, tone)",
    )


class MessageFeedbackResponse(BaseModel):
    """Response containing persisted feedback details."""
    id: str
    message_id: str
    conversation_id: str
    user_id: str
    rating: str
    comment: Optional[str] = None
    category: Optional[str] = None
    created_at: datetime
