import math
from typing import Annotated, Any, Dict, List, Literal, Optional, Union
from pydantic import BaseModel, Field, field_validator


# ---------------------------------------------------------------------------
# Allowlisted Block Type Registry
# ---------------------------------------------------------------------------

SUPPORTED_BLOCK_TYPES = {
    "text",
    "heading",
    "bullet_list",
    "key_takeaways",
    "info_card",
    "recommendation_card",
    "comparison_table",
    "roadmap_timeline",
    "chart_bar",
    "chart_line",
    "chart_multi_series",
    "skill_gap_analysis",
    "learning_plan",
    "evidence_reference",
    "limitation_notice",
    "follow_up_questions",
    "quick_replies",
}


# ---------------------------------------------------------------------------
# Sub-models for Complex Blocks
# ---------------------------------------------------------------------------

class ChartDataPoint(BaseModel):
    label: str = Field(..., min_length=1, max_length=100)
    value: Optional[float] = None
    category: Optional[str] = Field(default=None, max_length=100)
    is_projected: Optional[bool] = Field(default=False)
    status: Optional[Literal["available", "unavailable", "estimated", "projected"]] = "available"

    @field_validator("value")
    @classmethod
    def validate_finite_number(cls, v: Optional[float]) -> Optional[float]:
        if v is not None:
            if math.isnan(v) or math.isinf(v):
                raise ValueError("Chart data point value must be a finite number; NaN and Inf are not permitted")
        return v


class ChartSeries(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    points: List[ChartDataPoint] = Field(default_factory=list, min_length=1, max_length=50)
    series_type: Optional[Literal["bar", "line"]] = None
    color: Optional[str] = Field(default=None, max_length=30)


class RoadmapStep(BaseModel):
    step_number: int = Field(..., ge=1, le=20)
    title: str = Field(..., min_length=1, max_length=200)
    description: str = Field(..., min_length=1, max_length=1000)
    duration: Optional[str] = Field(default=None, max_length=100)
    milestones: List[str] = Field(default_factory=list)


class LearningModule(BaseModel):
    module_index: int = Field(..., ge=1, le=50)
    title: str = Field(..., min_length=1, max_length=200)
    topics: List[str] = Field(default_factory=list, min_length=1)
    duration: Optional[str] = Field(default=None, max_length=100)
    recommended_resources: List[str] = Field(default_factory=list)


class EvidenceSource(BaseModel):
    source_id: str = Field(..., min_length=1, max_length=128)
    title: str = Field(..., min_length=1, max_length=255)
    url: Optional[str] = Field(default=None, max_length=512)
    similarity_score: Optional[float] = Field(default=None, ge=0.0, le=1.0)


class QuickReplyOption(BaseModel):
    label: str = Field(..., min_length=1, max_length=100)
    payload: str = Field(..., min_length=1, max_length=500)
    category: Optional[str] = Field(default=None, max_length=50)


# ---------------------------------------------------------------------------
# Individual Typed Block Models
# ---------------------------------------------------------------------------

class TextBlock(BaseModel):
    type: Literal["text"] = "text"
    text: str = Field(..., min_length=1, max_length=5000)
    variant: Literal["body", "callout", "quote"] = "body"


class HeadingBlock(BaseModel):
    type: Literal["heading"] = "heading"
    level: int = Field(default=2, ge=1, le=4)
    text: str = Field(..., min_length=1, max_length=255)


class BulletListBlock(BaseModel):
    type: Literal["bullet_list"] = "bullet_list"
    title: Optional[str] = Field(default=None, max_length=200)
    items: List[str] = Field(..., min_length=1, max_length=50)


class KeyTakeawaysBlock(BaseModel):
    type: Literal["key_takeaways"] = "key_takeaways"
    title: str = Field(default="Key Takeaways", max_length=200)
    points: List[str] = Field(..., min_length=1, max_length=10)


class InfoCardBlock(BaseModel):
    type: Literal["info_card"] = "info_card"
    title: str = Field(..., min_length=1, max_length=200)
    description: str = Field(..., min_length=1, max_length=2000)
    badge: Optional[str] = Field(default=None, max_length=50)
    icon: Optional[str] = Field(default=None, max_length=50)


class RecommendationCardBlock(BaseModel):
    type: Literal["recommendation_card"] = "recommendation_card"
    title: str = Field(..., min_length=1, max_length=200)
    description: str = Field(..., min_length=1, max_length=2000)
    reasoning: str = Field(..., min_length=1, max_length=1000)
    risks_and_limitations: str = Field(..., min_length=1, max_length=1000)
    priority: Literal["high", "medium", "low"] = "medium"
    action_label: Optional[str] = Field(default=None, max_length=100)


class ComparisonTableBlock(BaseModel):
    type: Literal["comparison_table"] = "comparison_table"
    title: str = Field(..., min_length=1, max_length=200)
    headers: List[str] = Field(..., min_length=2, max_length=10)
    rows: List[List[str]] = Field(..., min_length=1, max_length=30)
    summary_verdict: Optional[str] = Field(default=None, max_length=1000)

    @field_validator("rows")
    @classmethod
    def validate_row_lengths(cls, rows: List[List[str]], info) -> List[List[str]]:
        headers = info.data.get("headers")
        if headers:
            for idx, row in enumerate(rows):
                if len(row) != len(headers):
                    raise ValueError(f"Row {idx} length ({len(row)}) does not match headers count ({len(headers)})")
        return rows


class RoadmapTimelineBlock(BaseModel):
    type: Literal["roadmap_timeline"] = "roadmap_timeline"
    title: str = Field(..., min_length=1, max_length=200)
    steps: List[RoadmapStep] = Field(..., min_length=1, max_length=15)
    estimated_duration: Optional[str] = Field(default=None, max_length=100)


class BarChartBlock(BaseModel):
    type: Literal["chart_bar"] = "chart_bar"
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, max_length=500)
    data: List[ChartDataPoint] = Field(..., min_length=1, max_length=30)
    unit: Optional[str] = Field(default=None, max_length=50)
    value_format: Literal["number", "currency", "percentage"] = "number"
    source_note: Optional[str] = Field(default=None, max_length=255)
    data_period: Optional[str] = Field(default=None, max_length=100)
    disclaimer: Optional[str] = Field(default=None, max_length=500)


class LineChartBlock(BaseModel):
    type: Literal["chart_line"] = "chart_line"
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, max_length=500)
    data: List[ChartDataPoint] = Field(..., min_length=2, max_length=50)
    x_label: Optional[str] = Field(default=None, max_length=50)
    y_label: Optional[str] = Field(default=None, max_length=50)
    unit: Optional[str] = Field(default=None, max_length=50)
    value_format: Literal["number", "currency", "percentage"] = "number"
    source_note: Optional[str] = Field(default=None, max_length=255)
    data_period: Optional[str] = Field(default=None, max_length=100)
    disclaimer: Optional[str] = Field(default=None, max_length=500)


class MultiSeriesChartBlock(BaseModel):
    type: Literal["chart_multi_series"] = "chart_multi_series"
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, max_length=500)
    chart_variant: Literal["bar", "line"] = "bar"
    series: List[ChartSeries] = Field(..., min_length=2, max_length=8)
    unit: Optional[str] = Field(default=None, max_length=50)
    value_format: Literal["number", "currency", "percentage"] = "number"
    x_label: Optional[str] = Field(default=None, max_length=50)
    y_label: Optional[str] = Field(default=None, max_length=50)
    source_note: Optional[str] = Field(default=None, max_length=255)
    data_period: Optional[str] = Field(default=None, max_length=100)
    disclaimer: Optional[str] = Field(default=None, max_length=500)

    @field_validator("series")
    @classmethod
    def validate_series_consistency(cls, series: List[ChartSeries]) -> List[ChartSeries]:
        if not series:
            return series
        first_labels = [p.label for p in series[0].points]
        for s in series[1:]:
            s_labels = [p.label for p in s.points]
            if len(s_labels) != len(first_labels):
                raise ValueError(
                    f"Series '{s.name}' has {len(s_labels)} points, but '{series[0].name}' has {len(first_labels)} points"
                )
        return series


class SkillGapBlock(BaseModel):
    type: Literal["skill_gap_analysis"] = "skill_gap_analysis"
    target_role: str = Field(..., min_length=1, max_length=200)
    prerequisites: List[str] = Field(default_factory=list)
    existing_skills: List[str] = Field(default_factory=list)
    missing_skills: List[str] = Field(..., min_length=1)
    recommended_actions: List[str] = Field(..., min_length=1)


class LearningPlanBlock(BaseModel):
    type: Literal["learning_plan"] = "learning_plan"
    title: str = Field(..., min_length=1, max_length=200)
    modules: List[LearningModule] = Field(..., min_length=1, max_length=15)
    prerequisites: List[str] = Field(default_factory=list)
    level: Literal["beginner", "intermediate", "advanced"] = "beginner"


class EvidenceReferenceBlock(BaseModel):
    type: Literal["evidence_reference"] = "evidence_reference"
    title: str = Field(default="Verified Reference Citations", max_length=200)
    summary: Optional[str] = Field(default=None, max_length=500)
    sources: List[EvidenceSource] = Field(..., min_length=1)


class LimitationNoticeBlock(BaseModel):
    type: Literal["limitation_notice"] = "limitation_notice"
    title: str = Field(default="Evidence Limitation Notice", max_length=200)
    message: str = Field(..., min_length=1, max_length=1000)
    missing_fields: List[str] = Field(default_factory=list)


class FollowUpQuestionsBlock(BaseModel):
    type: Literal["follow_up_questions"] = "follow_up_questions"
    questions: List[str] = Field(..., min_length=1, max_length=5)


class QuickRepliesBlock(BaseModel):
    type: Literal["quick_replies"] = "quick_replies"
    options: List[QuickReplyOption] = Field(..., min_length=1, max_length=8)


# ---------------------------------------------------------------------------
# Discriminated Union of Allowlisted Blocks
# ---------------------------------------------------------------------------

AnyStructuredBlock = Annotated[
    Union[
        TextBlock,
        HeadingBlock,
        BulletListBlock,
        KeyTakeawaysBlock,
        InfoCardBlock,
        RecommendationCardBlock,
        ComparisonTableBlock,
        RoadmapTimelineBlock,
        BarChartBlock,
        LineChartBlock,
        MultiSeriesChartBlock,
        SkillGapBlock,
        LearningPlanBlock,
        EvidenceReferenceBlock,
        LimitationNoticeBlock,
        FollowUpQuestionsBlock,
        QuickRepliesBlock,
    ],
    Field(discriminator="type"),
]


# ---------------------------------------------------------------------------
# Versioned Top-Level Container Schema
# ---------------------------------------------------------------------------

class VersionedStructuredResponse(BaseModel):
    """
    Shared versioned schema contract for dynamic structured responses.
    Strictly separates narrative explanation, verified sources, and validated blocks.
    """
    version: str = Field(default="1.0", pattern=r"^\d+\.\d+$")
    intent: str = Field(default="general_guidance", max_length=64)
    narrative_summary: Optional[str] = Field(default=None, max_length=4000)
    blocks: List[AnyStructuredBlock] = Field(default_factory=list)
    sources: List[EvidenceSource] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)
