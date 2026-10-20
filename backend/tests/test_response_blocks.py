from unittest.mock import AsyncMock, patch
import pytest
from pydantic import TypeAdapter, ValidationError
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.ai.types import AIMessage, AIResponse
from app.config import Settings
from app.counselling.orchestrator import CounsellingOrchestrator
from app.counselling.response_engine import DynamicResponseEngine
from app.counselling.types import CounsellingIntent, CounsellingSignals, DetectedLanguage
from app.db.base import Base
from app.models.conversation import Conversation
from app.models.message import Message
from app.schemas.blocks import (
    AnyStructuredBlock,
    BarChartBlock,
    BulletListBlock,
    ChartDataPoint,
    ChartSeries,
    ComparisonTableBlock,
    EvidenceReferenceBlock,
    EvidenceSource,
    FollowUpQuestionsBlock,
    HeadingBlock,
    InfoCardBlock,
    KeyTakeawaysBlock,
    LearningModule,
    LearningPlanBlock,
    LimitationNoticeBlock,
    LineChartBlock,
    MultiSeriesChartBlock,
    QuickRepliesBlock,
    QuickReplyOption,
    RecommendationCardBlock,
    RoadmapStep,
    RoadmapTimelineBlock,
    SkillGapBlock,
    TextBlock,
    VersionedStructuredResponse,
)
from app.services.chat_service import ChatService

# In-memory test database
test_engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)
Base.metadata.create_all(bind=test_engine)


@pytest.fixture
def db_session():
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


# ---------------------------------------------------------------------------
# 1. Verification of all 17 Distinct Block Types
# ---------------------------------------------------------------------------

def test_all_seventeen_block_types_instantiation():
    adapter = TypeAdapter(AnyStructuredBlock)

    # 1. TextBlock
    b1 = TextBlock(type="text", text="Career guidance overview.", variant="body")
    assert adapter.validate_python(b1.model_dump()).type == "text"

    # 2. HeadingBlock
    b2 = HeadingBlock(type="heading", level=2, text="Educational Pathways")
    assert adapter.validate_python(b2.model_dump()).type == "heading"

    # 3. BulletListBlock
    b3 = BulletListBlock(type="bullet_list", title="Prerequisites", items=["Python", "SQL", "Git"])
    assert adapter.validate_python(b3.model_dump()).type == "bullet_list"

    # 4. KeyTakeawaysBlock
    b4 = KeyTakeawaysBlock(type="key_takeaways", title="Summary", points=["Strong math foundation is essential."])
    assert adapter.validate_python(b4.model_dump()).type == "key_takeaways"

    # 5. InfoCardBlock
    b5 = InfoCardBlock(type="info_card", title="Notice", description="Admissions begin in July.", badge="Official")
    assert adapter.validate_python(b5.model_dump()).type == "info_card"

    # 6. RecommendationCardBlock
    b6 = RecommendationCardBlock(
        type="recommendation_card",
        title="B.Tech Computer Science",
        description="Comprehensive 4-year undergraduate curriculum.",
        reasoning="Aligns with stated interest in systems engineering.",
        risks_and_limitations="Requires competitive entrance rank.",
        priority="high",
        action_label="Review Curriculum",
    )
    assert adapter.validate_python(b6.model_dump()).type == "recommendation_card"

    # 7. ComparisonTableBlock
    b7 = ComparisonTableBlock(
        type="comparison_table",
        title="Degree vs Bootcamp",
        headers=["Dimension", "Degree", "Bootcamp"],
        rows=[["Duration", "4 Years", "6 Months"], ["Depth", "High Theory", "Applied Only"]],
        summary_verdict="Choose degree for academic foundation.",
    )
    assert adapter.validate_python(b7.model_dump()).type == "comparison_table"

    # 8. RoadmapTimelineBlock
    b8 = RoadmapTimelineBlock(
        type="roadmap_timeline",
        title="Full Stack Track",
        steps=[
            RoadmapStep(
                step_number=1,
                title="Frontend",
                description="HTML, CSS, TypeScript",
                duration="Months 1-3",
                milestones=["Build portfolio"],
            )
        ],
        estimated_duration="6 Months",
    )
    assert adapter.validate_python(b8.model_dump()).type == "roadmap_timeline"

    # 9. BarChartBlock
    b9 = BarChartBlock(
        type="chart_bar",
        title="Placement Distribution",
        data=[ChartDataPoint(label="Software", value=85.0), ChartDataPoint(label="Data", value=65.0)],
        unit="Percentage",
        source_note="Official Placement Report 2024",
    )
    assert adapter.validate_python(b9.model_dump()).type == "chart_bar"

    # 10. LineChartBlock
    b10 = LineChartBlock(
        type="chart_line",
        title="Hiring Demand Index",
        data=[ChartDataPoint(label="2022", value=70.0), ChartDataPoint(label="2023", value=85.0)],
        x_label="Year",
        y_label="Index",
    )
    assert adapter.validate_python(b10.model_dump()).type == "chart_line"

    # 11. MultiSeriesChartBlock
    b11 = MultiSeriesChartBlock(
        type="chart_multi_series",
        title="Industry Trends",
        series=[
            ChartSeries(name="Cloud", points=[ChartDataPoint(label="Q1", value=40.0), ChartDataPoint(label="Q2", value=55.0)]),
            ChartSeries(name="AI", points=[ChartDataPoint(label="Q1", value=50.0), ChartDataPoint(label="Q2", value=75.0)]),
        ],
    )
    assert adapter.validate_python(b11.model_dump()).type == "chart_multi_series"

    # 12. SkillGapBlock
    b12 = SkillGapBlock(
        type="skill_gap_analysis",
        target_role="Data Scientist",
        prerequisites=["Python", "Linear Algebra"],
        existing_skills=["Python"],
        missing_skills=["Statistics", "Machine Learning"],
        recommended_actions=["Take Applied Statistics course"],
    )
    assert adapter.validate_python(b12.model_dump()).type == "skill_gap_analysis"

    # 13. LearningPlanBlock
    b13 = LearningPlanBlock(
        type="learning_plan",
        title="Python Mastery",
        modules=[
            LearningModule(
                module_index=1,
                title="Basics",
                topics=["Syntax", "Control Flow"],
                duration="2 Weeks",
                recommended_resources=["Official Python Docs"],
            )
        ],
        level="beginner",
    )
    assert adapter.validate_python(b13.model_dump()).type == "learning_plan"

    # 14. EvidenceReferenceBlock
    b14 = EvidenceReferenceBlock(
        type="evidence_reference",
        sources=[EvidenceSource(source_id="src_1", title="AICTE Norms", url="https://aicte-india.org", similarity_score=0.92)],
    )
    assert adapter.validate_python(b14.model_dump()).type == "evidence_reference"

    # 15. LimitationNoticeBlock
    b15 = LimitationNoticeBlock(
        type="limitation_notice",
        message="Specific salary cutoffs are unavailable.",
        missing_fields=["salary_cutoffs"],
    )
    assert adapter.validate_python(b15.model_dump()).type == "limitation_notice"

    # 16. FollowUpQuestionsBlock
    b16 = FollowUpQuestionsBlock(
        type="follow_up_questions",
        questions=["Do you prefer remote or on-site roles?", "Are you willing to relocate?"],
    )
    assert adapter.validate_python(b16.model_dump()).type == "follow_up_questions"

    # 17. QuickRepliesBlock
    b17 = QuickRepliesBlock(
        type="quick_replies",
        options=[QuickReplyOption(label="Yes, open to relocate", payload="relocate_yes")],
    )
    assert adapter.validate_python(b17.model_dump()).type == "quick_replies"


# ---------------------------------------------------------------------------
# 2. Unsupported & Executable Block Types Rejection
# ---------------------------------------------------------------------------

def test_unsupported_and_executable_blocks_rejected():
    adapter = TypeAdapter(AnyStructuredBlock)

    # Malicious or arbitrary component execution attempt
    malicious_blocks = [
        {"type": "executable_script", "code": "<script>alert(1)</script>"},
        {"type": "react_component", "component": "ArbitraryRenderer"},
        {"type": "custom_widget", "data": "dummy"},
        {"type": "html_markup", "html": "<div>Injected</div>"},
    ]

    for raw in malicious_blocks:
        with pytest.raises(ValidationError):
            adapter.validate_python(raw)


# ---------------------------------------------------------------------------
# 3. Schema Validation & Bounded Repair
# ---------------------------------------------------------------------------

def test_comparison_table_row_length_validation_and_repair():
    adapter = TypeAdapter(AnyStructuredBlock)

    # Directly invalid: row length (2) mismatch with headers length (3)
    invalid_raw = {
        "type": "comparison_table",
        "title": "Mismatched Matrix",
        "headers": ["Col A", "Col B", "Col C"],
        "rows": [["Val A", "Val B"]],  # Missing Col C
    }

    with pytest.raises(ValidationError):
        adapter.validate_python(invalid_raw)

    # DynamicResponseEngine repairs the mismatch cleanly by padding with N/A
    repaired = DynamicResponseEngine._validate_or_repair_block(invalid_raw)
    assert repaired is not None
    assert repaired.type == "comparison_table"
    assert len(repaired.rows[0]) == 3
    assert repaired.rows[0][2] == "N/A"

    # Long row is truncated to match headers length
    overlong_raw = {
        "type": "comparison_table",
        "title": "Overlong Row Matrix",
        "headers": ["Col 1", "Col 2"],
        "rows": [["Val 1", "Val 2", "Val 3", "Val 4"]],
    }
    repaired_overlong = DynamicResponseEngine._validate_or_repair_block(overlong_raw)
    assert repaired_overlong is not None
    assert len(repaired_overlong.rows[0]) == 2


def test_malformed_block_bounded_degradation_to_text():
    # A block with unknown/invalid structure but containing meaningful text
    malformed = {
        "type": "chart_bar",  # chart_bar requires list of ChartDataPoint
        "title": "Misconfigured Chart",
        "data": "Not A List",  # triggers ValidationError
        "description": "Foundational programming concepts are critical.",
    }

    result = DynamicResponseEngine._validate_or_repair_block(malformed)
    assert result is not None
    assert result.type == "text"
    assert "Foundational programming concepts" in result.text


def test_totally_corrupt_block_rejected():
    corrupt = {
        "type": "unknown_type_xyz",
        "random_field": 12345,
    }
    result = DynamicResponseEngine._validate_or_repair_block(corrupt)
    assert result is None


# ---------------------------------------------------------------------------
# 4. Missing Evidence & Truthfulness (No Hallucinated Figures)
# ---------------------------------------------------------------------------

def test_missing_evidence_creates_limitation_notice():
    """
    When no verified evidence is available, the engine MUST emit a
    LimitationNoticeBlock and MUST NOT fabricate fake salaries, charts, or placements.
    """
    signals = CounsellingSignals(has_unrealistic_expectations=False, has_conflicting_goals=False, needs_critical_clarification=False)
    response = DynamicResponseEngine.assemble_response(
        intent=CounsellingIntent.CAREER_DISCOVERY,
        language=DetectedLanguage.ENGLISH,
        signals=signals,
        narrative_text="Data science is an evolving interdisciplinary domain.",
        evidence_sources=[],
        has_sufficient_evidence=False,
    )

    assert response.version == "1.0"
    block_types = [b.type for b in response.blocks]
    assert "limitation_notice" in block_types
    assert "evidence_reference" not in block_types

    limitation_block = next(b for b in response.blocks if b.type == "limitation_notice")
    assert "Specific institutional cutoffs and salary guarantees are withheld" in limitation_block.message
    assert "verified_institutional_cutoffs" in limitation_block.missing_fields

    # Verify no fabricated chart blocks were generated
    assert not any("chart" in b.type for b in response.blocks)


def test_verified_evidence_creates_evidence_reference_block():
    signals = CounsellingSignals(has_unrealistic_expectations=False, has_conflicting_goals=False, needs_critical_clarification=False)
    evidence = [
        {"source_id": "curric_1", "title": "National Curriculum Framework 2024", "url": "https://education.gov.in", "similarity_score": 0.89}
    ]
    response = DynamicResponseEngine.assemble_response(
        intent=CounsellingIntent.CAREER_DISCOVERY,
        language=DetectedLanguage.ENGLISH,
        signals=signals,
        narrative_text="Engineering disciplines follow standard UGC/AICTE norms.",
        evidence_sources=evidence,
        has_sufficient_evidence=True,
    )

    block_types = [b.type for b in response.blocks]
    assert "evidence_reference" in block_types
    assert "limitation_notice" not in block_types

    ev_block = next(b for b in response.blocks if b.type == "evidence_reference")
    assert len(ev_block.sources) == 1
    assert ev_block.sources[0].source_id == "curric_1"


# ---------------------------------------------------------------------------
# 5. Version Compatibility & Text-Only Fallback
# ---------------------------------------------------------------------------

def test_version_validation():
    # Valid semantic version
    v_valid = VersionedStructuredResponse(version="1.0", intent="test", blocks=[])
    assert v_valid.version == "1.0"

    # Invalid version pattern
    with pytest.raises(ValidationError):
        VersionedStructuredResponse(version="v1.0", intent="test", blocks=[])

    with pytest.raises(ValidationError):
        VersionedStructuredResponse(version="version_one", intent="test", blocks=[])


def test_text_only_fallback():
    signals = CounsellingSignals(has_unrealistic_expectations=False, has_conflicting_goals=False, needs_critical_clarification=False)
    # Patch extractors to return nothing, ensuring text-only fallback activates
    with patch.object(DynamicResponseEngine, "_extract_key_takeaways", return_value=[]), \
         patch.object(DynamicResponseEngine, "_extract_recommendation_cards", return_value=[]), \
         patch.object(DynamicResponseEngine, "_validate_or_repair_block", return_value=None):

        response = DynamicResponseEngine.assemble_response(
            intent=CounsellingIntent.GENERAL_GUIDANCE,
            language=DetectedLanguage.ENGLISH,
            signals=signals,
            narrative_text="A simple response explaining career exploration.",
            evidence_sources=[],
            has_sufficient_evidence=False,
        )

        assert len(response.blocks) == 1
        assert response.blocks[0].type == "text"
        assert response.blocks[0].text == "A simple response explaining career exploration."


# ---------------------------------------------------------------------------
# 6. End-to-End Orchestrator and Message Persistence Integration
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_orchestrator_returns_versioned_blocks(db_session):
    mock_provider = AsyncMock()
    mock_provider.generate_reply.return_value = AIResponse(
        content="Here are the trade-offs between BTech CSE and BCA.\n- BTech offers deeper hardware and systems foundation.\n- BCA is faster and application-oriented.",
        provider="mock",
        model="mock-v1",
        finish_reason="STOP",
    )

    settings = Settings(ai_primary_provider="gemini", gemini_api_key="test-key", RAG_ENABLED=False)

    response = await CounsellingOrchestrator.process_counselling_turn(
        db=db_session,
        user_message="BTech CSE vs BCA: which is better?",
        dialogue_history=[],
        settings=settings,
        provider=mock_provider,
    )

    assert response.versioned is not None
    assert response.versioned.version == "1.0"
    assert response.versioned.intent == "career_comparison"
    assert len(response.versioned.blocks) >= 1

    block_types = [b.type for b in response.versioned.blocks]
    assert "comparison_table" in block_types or "key_takeaways" in block_types


@pytest.mark.anyio
async def test_chat_service_persists_versioned_response(db_session):
    mock_provider = AsyncMock()
    mock_provider.generate_reply.return_value = AIResponse(
        content="Mastering software development requires a systematic roadmap.\n- Learn data structures.\n- Build full stack projects.",
        provider="mock",
        model="mock-v1",
        finish_reason="STOP",
    )

    settings = Settings(ai_primary_provider="gemini", gemini_api_key="test-key", RAG_ENABLED=False)

    with patch("app.services.chat_service.get_ai_provider", return_value=mock_provider):
        user_msg, assistant_msg = await ChatService.process_chat_turn(
            db=db_session,
            conversation_id=None,
            user_message_text="Give me a 6 month roadmap for web development.",
            settings=settings,
        )

        # Inspect persisted message
        assert assistant_msg.id.startswith("msg_")
        assert assistant_msg.structured is not None
        assert assistant_msg.structured.get("version") == "1.0"
        assert "blocks" in assistant_msg.structured
        assert len(assistant_msg.structured["blocks"]) > 0

        # Check database reload
        db_session.expire_all()
        persisted = db_session.get(Message, assistant_msg.id)
        assert persisted is not None
        assert persisted.structured["version"] == "1.0"
        assert len(persisted.structured["blocks"]) > 0
        assert persisted.content.startswith("Mastering software development")


# ---------------------------------------------------------------------------
# 7. Chart Data Validation & Missing Value Tests
# ---------------------------------------------------------------------------

def test_chart_schema_finite_numbers_and_missing_values():
    import math

    # 1. Valid finite number
    p1 = ChartDataPoint(label="Valid Data", value=42.5)
    assert p1.value == 42.5

    # 2. Honest missing value (None)
    p2 = ChartDataPoint(label="Unavailable Metric", value=None, status="unavailable")
    assert p2.value is None
    assert p2.status == "unavailable"

    # 3. Reject NaN
    with pytest.raises(ValidationError):
        ChartDataPoint(label="Invalid NaN", value=float("nan"))

    # 4. Reject Inf
    with pytest.raises(ValidationError):
        ChartDataPoint(label="Invalid Inf", value=float("inf"))


def test_multi_series_chart_length_consistency():
    # Valid matching points
    s1 = ChartSeries(name="Series 1", points=[ChartDataPoint(label="Q1", value=10.0), ChartDataPoint(label="Q2", value=20.0)])
    s2 = ChartSeries(name="Series 2", points=[ChartDataPoint(label="Q1", value=15.0), ChartDataPoint(label="Q2", value=25.0)])
    valid_multi = MultiSeriesChartBlock(title="Matching Series", series=[s1, s2])
    assert len(valid_multi.series) == 2

    # Mismatched points count triggers validation failure
    s3 = ChartSeries(name="Mismatched Series", points=[ChartDataPoint(label="Q1", value=30.0)])
    with pytest.raises(ValidationError):
        MultiSeriesChartBlock(title="Mismatched Multi-Series", series=[s1, s3])


def test_response_engine_repairs_chart_nan_values():
    raw_chart = {
        "type": "chart_bar",
        "title": "Sanitized Bar Chart",
        "data": [
            {"label": "Valid Point", "value": 50.0},
            {"label": "Corrupted Point", "value": float("nan")},
        ],
    }

    repaired = DynamicResponseEngine._validate_or_repair_block(raw_chart)
    assert repaired is not None
    assert repaired.type == "chart_bar"
    assert repaired.data[0].value == 50.0
    assert repaired.data[1].value is None
    assert repaired.data[1].status == "unavailable"


# ---------------------------------------------------------------------------
# 8. Targeted AI Response System Tests (Prompt Requirements)
# ---------------------------------------------------------------------------

def test_concise_narrative_length_and_direct_answer():
    long_verbose_text = (
        "Hello! As a career counsellor, I would be happy to help you with that! "
        "That is a great question. "
        "B.Tech Computer Science offers accredited degree depth with foundational theoretical coursework and campus recruitment pipelines. "
        "Conversely, specialized web development bootcamps accelerate hands-on project creation within six months at lower capital investment. "
        "Your ultimate decision should depend on whether institutional campus placement gating or rapid market entry fits your current financial constraints. "
        "Entry salaries range from 4 to 8 LPA depending on portfolio proof and technical interview problem solving. "
        "I hope this helps you choose the right path! Feel free to ask more questions if you need any other assistance!"
    )

    condensed = CounsellingOrchestrator._condense_counselling_narrative(
        text=long_verbose_text,
        intent=CounsellingIntent.CAREER_COMPARISON,
        has_visuals=True,
        user_query="BTech vs Bootcamp",
    )

    words = condensed.split()
    assert 20 <= len(words) <= 75, f"Word count {len(words)} is outside concise bounds"
    assert "Hello!" not in condensed
    assert "As a career counsellor" not in condensed
    assert "Feel free to ask" not in condensed
    assert "I hope this helps" not in condensed
    # Direct answer starts immediately
    assert condensed.startswith("B.Tech Computer Science")


def test_advantages_disadvantages_comparison_table():
    signals = CounsellingSignals(has_unrealistic_expectations=False, has_conflicting_goals=False, needs_critical_clarification=False)
    res = DynamicResponseEngine.assemble_response(
        intent=CounsellingIntent.CAREER_COMPARISON,
        language=DetectedLanguage.ENGLISH,
        signals=signals,
        narrative_text="Comparison between formal academic track and self-directed learning.",
        evidence_sources=[],
        has_sufficient_evidence=False,
        user_query="What are the advantages and disadvantages of online vs offline degree?",
    )

    table_blocks = [b for b in res.blocks if b.type == "comparison_table"]
    assert len(table_blocks) == 1
    table = table_blocks[0]
    assert "Advantages" in table.title or "Disadvantages" in table.title
    assert len(table.headers) >= 3
    assert any("advantage" in h.lower() for h in table.headers)
    assert any("trade-off" in h.lower() or "disadvantage" in h.lower() for h in table.headers)
    assert len(table.rows) >= 2


def test_options_cards_with_eligibility_duration_cost():
    signals = CounsellingSignals(has_unrealistic_expectations=False, has_conflicting_goals=False, needs_critical_clarification=False)
    res = DynamicResponseEngine.assemble_response(
        intent=CounsellingIntent.CAREER_DISCOVERY,
        language=DetectedLanguage.ENGLISH,
        signals=signals,
        narrative_text="Here are vocational trade pathways available after 10th standard.",
        evidence_sources=[],
        has_sufficient_evidence=False,
        user_query="What vocational trades can I choose after 10th?",
    )

    card_blocks = [b for b in res.blocks if b.type == "recommendation_card"]
    assert len(card_blocks) >= 2
    for card in card_blocks:
        assert "Eligibility:" in card.description
        assert "Duration:" in card.description
        assert "Cost:" in card.description
        assert "Career Opportunities:" in card.description


def test_step_by_step_roadmap_timeline():
    signals = CounsellingSignals(has_unrealistic_expectations=False, has_conflicting_goals=False, needs_critical_clarification=False)
    res = DynamicResponseEngine.assemble_response(
        intent=CounsellingIntent.ROADMAP_PLANNING,
        language=DetectedLanguage.ENGLISH,
        signals=signals,
        narrative_text="Follow this phased progression to become a software engineer.",
        evidence_sources=[],
        has_sufficient_evidence=False,
        user_query="Give me a step by step roadmap to become a cloud engineer",
    )

    roadmap_blocks = [b for b in res.blocks if b.type == "roadmap_timeline"]
    assert len(roadmap_blocks) == 1
    roadmap = roadmap_blocks[0]
    assert len(roadmap.steps) >= 3
    assert roadmap.steps[0].step_number == 1
    assert "Foundational" in roadmap.steps[0].title
    assert len(roadmap.steps[0].milestones) >= 1


def test_numeric_salary_and_placement_bar_chart():
    signals = CounsellingSignals(has_unrealistic_expectations=False, has_conflicting_goals=False, needs_critical_clarification=False)
    res = DynamicResponseEngine.assemble_response(
        intent=CounsellingIntent.GENERAL_GUIDANCE,
        language=DetectedLanguage.ENGLISH,
        signals=signals,
        narrative_text="Placement statistics across polytechnic and vocational trades.",
        evidence_sources=[],
        has_sufficient_evidence=False,
        user_query="What is the average placement rate comparison across trades?",
    )

    bar_blocks = [b for b in res.blocks if b.type == "chart_bar"]
    assert len(bar_blocks) == 1
    bar = bar_blocks[0]
    assert bar.unit in ("% Placement", "₹ LPA")
    assert len(bar.data) >= 3
    for pt in bar.data:
        assert pt.value is not None
        assert pt.value > 0


def test_year_wise_trend_line_chart():
    signals = CounsellingSignals(has_unrealistic_expectations=False, has_conflicting_goals=False, needs_critical_clarification=False)
    res = DynamicResponseEngine.assemble_response(
        intent=CounsellingIntent.GENERAL_GUIDANCE,
        language=DetectedLanguage.ENGLISH,
        signals=signals,
        narrative_text="Industry demand growth trends over recent calendar years.",
        evidence_sources=[],
        has_sufficient_evidence=False,
        user_query="What are the year wise hiring trends over time?",
    )

    line_blocks = [b for b in res.blocks if b.type == "chart_line"]
    assert len(line_blocks) == 1
    line = line_blocks[0]
    labels = [pt.label for pt in line.data]
    assert "2022" in labels
    assert "2024" in labels
    assert "2026" in labels
    assert line.unit == "Demand Index"


def test_simple_greeting_receives_simple_text_without_forced_charts():
    signals = CounsellingSignals(has_unrealistic_expectations=False, has_conflicting_goals=False, needs_critical_clarification=False)
    res = DynamicResponseEngine.assemble_response(
        intent=CounsellingIntent.GENERAL_GUIDANCE,
        language=DetectedLanguage.ENGLISH,
        signals=signals,
        narrative_text="Hello! I am CareerCompass AI. How can I assist your career planning today?",
        evidence_sources=[],
        has_sufficient_evidence=False,
        user_query="Hello",
    )

    # Simple greeting: strictly 1 text block, NO charts, NO limitation notice
    assert len(res.blocks) == 1
    assert res.blocks[0].type == "text"
    assert not any(b.type in ("chart_bar", "chart_line", "limitation_notice", "comparison_table") for b in res.blocks)


def test_missing_data_limitation_notice_and_no_fabricated_chart():
    signals = CounsellingSignals(has_unrealistic_expectations=False, has_conflicting_goals=False, needs_critical_clarification=False)
    res = DynamicResponseEngine.assemble_response(
        intent=CounsellingIntent.GENERAL_GUIDANCE,
        language=DetectedLanguage.ENGLISH,
        signals=signals,
        narrative_text="Exact institutional cutoffs and 100% salary guarantees cannot be verified without audit.",
        evidence_sources=[],
        has_sufficient_evidence=False,
        user_query="Can you give me the exact 100% cutoff and salary guarantee at XYZ Private College?",
    )

    block_types = [b.type for b in res.blocks]
    assert "limitation_notice" in block_types
    limitation = next(b for b in res.blocks if b.type == "limitation_notice")
    assert "Specific institutional cutoffs and salary guarantees are withheld" in limitation.message or "withheld" in limitation.message


@pytest.mark.anyio
async def test_orchestrator_hides_technical_provider_metadata_from_notice(db_session):
    mock_provider = AsyncMock()
    mock_provider.generate_reply.return_value = AIResponse(
        content="Mechanical engineers develop thermal and manufacturing systems with practical applications.",
        provider="openai",
        model="gpt-4o-mini",
        finish_reason="STOP",
    )

    settings = Settings(ai_primary_provider="openai", openai_api_key="test-key", RAG_ENABLED=False)

    response = await CounsellingOrchestrator.process_counselling_turn(
        db=db_session,
        user_message="Tell me about mechanical engineering roles",
        dialogue_history=[],
        settings=settings,
        provider=mock_provider,
    )

    # Technical metadata must NOT be rendered in user-facing notice
    assert response.notice is None or "Generated via" not in response.notice
    assert "openai" not in (response.notice or "")
    assert "gpt-4o-mini" not in (response.notice or "")


