from datetime import datetime
from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field


class VerifiedOutcomeCreateRequest(BaseModel):
    """Schema for creating a verified vocational / training outcome record."""

    trade: str = Field(..., min_length=2, max_length=128, description="Vocational trade or occupation title")
    training_provider: str = Field(..., min_length=2, max_length=255, description="Training institute or provider")
    location: str = Field(..., min_length=2, max_length=128, description="Geographic location or city/state")
    nsqf_level: str = Field(..., min_length=1, max_length=64, description="NSQF Qualification Level, e.g. 'Level 4'")
    placement_rate: float = Field(..., ge=0.0, le=100.0, description="Placement rate percentage (0 - 100)")
    post_training_earnings_range: str = Field(..., min_length=2, max_length=128, description="Earnings bracket")
    reporting_period: str = Field(..., min_length=2, max_length=64, description="Reporting timeframe, e.g. '2023-2024'")
    sample_size: int = Field(..., gt=0, description="Sample size of surveyed cohort")
    progression_pathways: Optional[str] = Field(None, description="Career vertical progression pathway description")
    source_url: str = Field(..., min_length=4, max_length=512, description="Required audit source / citation link")
    verification_status: Literal["verified", "unverified", "pending_review"] = Field(
        default="unverified",
        description="Data verification status. Unverified data is excluded from AI factual claims.",
    )
    notes: Optional[str] = Field(None, description="Administrative provenance notes")


class VerifiedOutcomeUpdateRequest(BaseModel):
    """Schema for updating an existing outcome record."""

    trade: Optional[str] = Field(None, min_length=2, max_length=128)
    training_provider: Optional[str] = Field(None, min_length=2, max_length=255)
    location: Optional[str] = Field(None, min_length=2, max_length=128)
    nsqf_level: Optional[str] = Field(None, min_length=1, max_length=64)
    placement_rate: Optional[float] = Field(None, ge=0.0, le=100.0)
    post_training_earnings_range: Optional[str] = Field(None, min_length=2, max_length=128)
    reporting_period: Optional[str] = Field(None, min_length=2, max_length=64)
    sample_size: Optional[int] = Field(None, gt=0)
    progression_pathways: Optional[str] = None
    source_url: Optional[str] = Field(None, min_length=4, max_length=512)
    verification_status: Optional[Literal["verified", "unverified", "pending_review"]] = None
    notes: Optional[str] = None


class VerifiedOutcomeResponse(BaseModel):
    """Complete representation of a verified outcome record."""

    id: str
    trade: str
    training_provider: str
    location: str
    nsqf_level: str
    placement_rate: float
    post_training_earnings_range: str
    reporting_period: str
    sample_size: int
    progression_pathways: Optional[str]
    source_url: str
    verification_status: str
    last_verified_date: datetime
    verified_by: Optional[str]
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime


class PaginatedOutcomesResponse(BaseModel):
    """Paginated collection of verified outcome records with audit counters."""

    items: List[VerifiedOutcomeResponse]
    total: int
    page: int
    limit: int
    total_pages: int
    verified_count: int
    unverified_count: int
    pending_review_count: int


class KnowledgeSourceBrief(BaseModel):
    """Overview of an indexed knowledge document source with chunk counts and feedback."""

    source_id: str
    source_title: str
    source_url: Optional[str]
    chunk_count: int
    embedding_model: str
    embedding_dim: int
    created_at: datetime
    updated_at: datetime
    helpful_feedback_count: int
    unhelpful_feedback_count: int


class KnowledgeQualityOverviewResponse(BaseModel):
    """System-wide summary of knowledge corpus quality and source coverage."""

    total_sources: int
    total_chunks: int
    embedding_model: str
    sources: List[KnowledgeSourceBrief]


class ProgrammeAnalyticsConcernChange(BaseModel):
    """Comparison of student concern shifts and outcome resolutions."""

    category: str
    initial_signals: int
    resolved_or_assisted_signals: int
    shift_percentage: float
    data_sufficient: bool
    note: str


class ProgrammeAnalyticsResponse(BaseModel):
    """Aggregated programme-level career consultation analytics."""

    total_consultations: int
    concern_distribution: List[Dict[str, Any]]
    escalation_resolution_rate: float
    escalation_summary: Dict[str, int]
    concern_shifts: List[ProgrammeAnalyticsConcernChange]
    data_sources: List[str]
    filters_applied: Dict[str, Any]
