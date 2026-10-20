from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field


class EscalationCaseBrief(BaseModel):
    """Brief overview of an escalation case."""
    id: str
    conversation_id: str
    conversation_title: Optional[str] = None
    user_id: str
    user_email: Optional[str] = None
    user_name: Optional[str] = None
    trigger_type: str
    reason: str
    priority: str  # 'high' | 'medium' | 'low'
    status: str    # 'pending' | 'assigned' | 'in_progress' | 'resolved'
    user_notes: Optional[str] = None
    assigned_to: Optional[str] = None
    assigned_to_name: Optional[str] = None
    assigned_at: Optional[datetime] = None
    resolution_notes: Optional[str] = None
    resolved_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class PaginatedEscalationsResponse(BaseModel):
    """Paginated list of escalation cases with triage status breakdown."""
    items: List[EscalationCaseBrief]
    total: int
    pending_count: int
    assigned_count: int
    in_progress_count: int
    resolved_count: int
    page: int
    limit: int
    total_pages: int


class EscalationCaseUpdateRequest(BaseModel):
    """Payload for updating an escalation case (status, priority, assignment, resolution notes)."""
    status: Optional[str] = Field(default=None, pattern=r"^(pending|assigned|in_progress|resolved)$")
    priority: Optional[str] = Field(default=None, pattern=r"^(high|medium|low)$")
    assigned_to: Optional[str] = Field(default=None, description="User ID of authorized admin/counsellor")
    resolution_notes: Optional[str] = Field(default=None, max_length=2000)


class EscalationCaseCreateRequest(BaseModel):
    """Payload for manual escalation case creation."""
    conversation_id: str = Field(..., min_length=1)
    trigger_type: str = Field(default="explicit_request")
    reason: str = Field(default="Human counsellor support requested")
    priority: str = Field(default="medium", pattern=r"^(high|medium|low)$")
    user_notes: Optional[str] = Field(default=None, max_length=1000)
