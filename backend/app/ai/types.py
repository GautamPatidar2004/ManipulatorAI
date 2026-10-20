from typing import Any, Dict, Literal, Optional
from pydantic import BaseModel, Field


class AIMessage(BaseModel):
    """Normalized internal message model."""
    role: Literal["user", "assistant", "system"]
    content: str = Field(..., min_length=1)


class AIResponse(BaseModel):
    """Normalized internal AI response model."""
    content: str
    model: str
    provider: str
    finish_reason: Optional[str] = None
    tokens_used: Optional[Dict[str, int]] = None
    raw_metadata: Optional[Dict[str, Any]] = None
