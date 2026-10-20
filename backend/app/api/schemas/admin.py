from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class DashboardKPICards(BaseModel):
    total_registered_users: int = Field(description="Total registered user accounts")
    active_users: int = Field(description="Unique active users with consultations in period")
    total_conversations: int = Field(description="Total counselling conversations")
    pending_escalations: Optional[int] = Field(default=None, description="Pending human counsellor escalations count")
    pending_escalations_note: str = Field(description="Honest status of escalation queue")
    pending_escalations_available: bool = False
    collected_feedback_count: int = Field(description="Total feedback ratings submitted by students")


class ConversationTrendPoint(BaseModel):
    date: str  # YYYY-MM-DD
    count: int


class ConcernCategoryMetric(BaseModel):
    category: str
    label: str
    count: int
    data_available: bool = True
    source_description: str


class EngagementMetric(BaseModel):
    persona: str
    count: Optional[int] = None
    data_available: bool = False
    note: str


class FeedbackRatingBreakdown(BaseModel):
    helpful: int
    unhelpful: int
    helpful_percentage: Optional[float] = None


class FilterAvailability(BaseModel):
    date_range_available: bool = True
    language_filter_available: bool = False
    language_note: str
    location_filter_available: bool = False
    location_note: str
    available_languages: List[str] = []
    available_locations: List[str] = []


class AdminDashboardResponse(BaseModel):
    kpis: DashboardKPICards
    conversation_trends: List[ConversationTrendPoint]
    engagement_by_persona: List[EngagementMetric]
    concern_categories: List[ConcernCategoryMetric]
    feedback_breakdown: FeedbackRatingBreakdown
    filters: FilterAvailability
    data_sources: List[str]
    missing_metrics: List[str]
