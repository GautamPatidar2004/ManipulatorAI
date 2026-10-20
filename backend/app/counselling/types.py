from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class CounsellingIntent(str, Enum):
    """Core student counselling intents."""
    CAREER_DISCOVERY = "career_discovery"
    CAREER_COMPARISON = "career_comparison"
    PATHWAY_EXPLORATION = "pathway_exploration"
    ROADMAP_PLANNING = "roadmap_planning"
    EXAM_AND_CREDENTIALS = "exam_and_credentials"
    PARENT_STUDENT_DIALOGUE = "parent_student_dialogue"
    GENERAL_GUIDANCE = "general_guidance"


class DetectedLanguage(str, Enum):
    """Supported interaction languages."""
    ENGLISH = "english"
    HINDI = "hindi"
    HINGLISH = "hinglish"


class CounsellingSignals(BaseModel):
    """Cognitive and psychological cues extracted from user query."""
    intent: CounsellingIntent = CounsellingIntent.GENERAL_GUIDANCE
    language: DetectedLanguage = DetectedLanguage.ENGLISH
    has_unrealistic_expectations: bool = False
    has_conflicting_goals: bool = False
    has_high_uncertainty: bool = False
    needs_critical_clarification: bool = False
    unrealistic_expectation_details: Optional[str] = None
    conflicting_goal_details: Optional[str] = None
    stated_assumptions: List[str] = Field(default_factory=list)


class RecommendationItem(BaseModel):
    """Individual career or learning recommendation with rationale and limitations."""
    title: str
    description: str
    reasoning: str
    limitations_and_risks: str


class CounsellingStructuredData(BaseModel):
    """
    Structured breakdown separating factual evidence, market estimates,
    and personalized recommendations.
    """
    intent: str
    language: str
    verified_facts: List[str] = Field(default_factory=list)
    estimates_and_ranges: List[str] = Field(default_factory=list)
    recommendations: List[RecommendationItem] = Field(default_factory=list)
    trade_offs: List[str] = Field(default_factory=list)
    follow_up_questions: List[str] = Field(default_factory=list)
    evidence_sources: List[Dict[str, Any]] = Field(default_factory=list)
    evidence_status: str = "sufficient"  # "sufficient" | "insufficient" | "none"


from app.schemas.blocks import VersionedStructuredResponse


class CounsellingResponse(BaseModel):
    """Complete response returned by the counselling intelligence layer."""
    content: str
    structured: CounsellingStructuredData
    signals: CounsellingSignals
    notice: Optional[str] = None
    versioned: Optional[VersionedStructuredResponse] = None

