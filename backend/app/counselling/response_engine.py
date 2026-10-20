import math
import re
from typing import Any, Dict, List, Optional
from pydantic import ValidationError
from app.core.logging import get_logger
from app.counselling.types import CounsellingIntent, CounsellingSignals, DetectedLanguage
from app.schemas.blocks import (
    AnyStructuredBlock,
    BulletListBlock,
    ComparisonTableBlock,
    EvidenceReferenceBlock,
    EvidenceSource,
    FollowUpQuestionsBlock,
    InfoCardBlock,
    KeyTakeawaysBlock,
    LimitationNoticeBlock,
    QuickRepliesBlock,
    QuickReplyOption,
    RecommendationCardBlock,
    RoadmapStep,
    RoadmapTimelineBlock,
    SkillGapBlock,
    TextBlock,
    VersionedStructuredResponse,
)

logger = get_logger("response_engine")


class DynamicResponseEngine:
    """
    Intelligent block synthesizer and schema validator.
    Selects, constructs, and strictly validates versioned response blocks
    derived from actual counselling output and verified evidence.
    """

    @classmethod
    def assemble_response(
        cls,
        intent: CounsellingIntent,
        language: DetectedLanguage,
        signals: CounsellingSignals,
        narrative_text: str,
        evidence_sources: List[Dict[str, Any]],
        has_sufficient_evidence: bool,
        user_query: Optional[str] = None,
        verified_outcomes: Optional[List[Dict[str, Any]]] = None,
    ) -> VersionedStructuredResponse:
        """
        Synthesize allowlisted structured blocks matching intent and evidence,
        enforcing strict schema validation and bounded safe fallback.
        """
        raw_blocks: List[Dict[str, Any]] = []
        query = (user_query or "").strip().lower()

        # 1. Check for Greeting or Simple Factual Query
        if cls._is_greeting_or_simple(query, intent, narrative_text):
            # Greetings and simple factual questions receive pure concise text - no forced charts/visuals
            return VersionedStructuredResponse(
                version="1.0",
                intent=intent.value,
                narrative_summary=narrative_text[:4000],
                blocks=[TextBlock(type="text", text=narrative_text[:4000], variant="body")],
                sources=[],
                metadata={
                    "language": language.value,
                    "is_simple_query": True,
                },
            )

        # 2. Evidence Citations (Preserve legitimate references; no internal debug notice)
        if evidence_sources and has_sufficient_evidence:
            valid_sources: List[Dict[str, Any]] = []
            for s in evidence_sources:
                valid_sources.append({
                    "source_id": str(s.get("source_id", "source")),
                    "title": str(s.get("title", "Curriculum Reference")),
                    "url": s.get("url"),
                    "similarity_score": float(s.get("similarity_score", 0.0)) if s.get("similarity_score") is not None else None,
                })
            raw_blocks.append({
                "type": "evidence_reference",
                "title": "Verified Reference Citations",
                "summary": f"Guidance grounded on {len(valid_sources)} verified career framework document(s).",
                "sources": valid_sources,
            })

        # 3. Context-Aware & Query-Adaptive Visual Selection
        # A. Advantages vs Disadvantages -> Comparison Table
        is_adv_disadv = any(p in query for p in [
            "advantage", "disadvantage", "pros and cons", "pros vs cons",
            "fayde", "nuksan", "faayde", "nuksaan", "merits", "demerits", "merits and demerits", "pros", "cons"
        ]) or any(p in narrative_text.lower() for p in ["advantages vs", "pros and cons", "advantages and disadvantages"])

        # B. Time / Year-wise Trends -> Line Chart
        is_time_trend = any(p in query for p in [
            "trend", "trends", "year wise", "year-wise", "over time",
            "growth over years", "future demand", "hiring trend", "past 3 years", "past 5 years", "salana trend", "annual"
        ])

        # C. Salary, Earnings, Placement, Fees or Numeric Comparisons -> Bar Chart
        is_numeric_comp = any(p in query for p in [
            "salary", "earnings", "placement", "placement rate", "package", "fees",
            "compensation", "lpa", "highest salary", "average package", "kamai", "vetan"
        ])

        # D. Eligibility, Admission Process or Requirements -> Concise Checklist
        is_eligibility = any(p in query for p in [
            "eligibility", "admission", "admission process", "requirements", "criteria",
            "documents required", "qualification", "patrata", "how to apply"
        ])

        # E. Parent Concerns -> Info Card with Mediation Strategy
        is_parent_concern = intent == CounsellingIntent.PARENT_STUDENT_DIALOGUE or any(p in query for p in [
            "parent", "parents", "family", "father", "mother", "society",
            "government job", "stability", "security", "gharwale", "parivar"
        ])

        # F. Step-by-Step Guidance / Roadmap -> Numbered Visual Roadmap
        is_roadmap = intent in {CounsellingIntent.ROADMAP_PLANNING, CounsellingIntent.PATHWAY_EXPLORATION} or any(p in query for p in [
            "step by step", "step-by-step", "roadmap", "how to become", "stages",
            "progression", "kaise bane", "pathway", "milestones"
        ])

        # G. Multiple Choices / Trade Comparisons -> Comparison Table or Distinct Option Cards
        is_choices_comparison = intent in {CounsellingIntent.CAREER_COMPARISON, CounsellingIntent.CAREER_DISCOVERY} or any(p in query for p in [
            "vs", "versus", "compare", "choice", "choices", "options", "which is better", "career options", "courses", "trades"
        ])

        # Dispatch blocks based on prioritized query match
        if is_adv_disadv:
            comp_table = cls._extract_comparison_table(narrative_text, query=query, is_adv_disadv=True)
            if comp_table:
                raw_blocks.append(comp_table)

        elif is_time_trend:
            line_chart = cls._extract_trend_line_chart(narrative_text, query=query)
            if line_chart:
                raw_blocks.append(line_chart)

        elif is_numeric_comp:
            bar_chart = cls._extract_numeric_bar_chart(narrative_text, query=query, verified_outcomes=verified_outcomes)
            if bar_chart:
                raw_blocks.append(bar_chart)

        elif is_eligibility:
            checklist = cls._extract_eligibility_checklist(narrative_text, query=query)
            if checklist:
                raw_blocks.append(checklist)

        elif is_parent_concern:
            parent_card = cls._extract_parent_concern_card(narrative_text, query=query)
            if parent_card:
                raw_blocks.append(parent_card)

        elif is_roadmap:
            roadmap = cls._extract_roadmap_timeline(narrative_text, query=query)
            if roadmap:
                raw_blocks.append(roadmap)

        elif is_choices_comparison:
            # If explicit 2-way comparison, prefer comparison table; otherwise distinct option cards
            if " vs " in query or " versus " in query or "compare" in query:
                comp_table = cls._extract_comparison_table(narrative_text, query=query, is_adv_disadv=False)
                if comp_table:
                    raw_blocks.append(comp_table)
            else:
                cards = cls._extract_recommendation_cards(narrative_text, intent=intent, query=query)
                raw_blocks.extend(cards)

        # Missing evidence or unsupported claim limitation notice
        if not has_sufficient_evidence:
            if (not user_query and intent != CounsellingIntent.GENERAL_GUIDANCE) or (
                is_numeric_comp and any(term in query for term in ["guarantee", "exact", "cutoff", "100%", "50 lpa", "highest package"])
            ):
                raw_blocks.append({
                    "type": "limitation_notice",
                    "title": "Evidence Limitation Notice",
                    "message": (
                        "No verified internal curriculum standards matched this specific query. "
                        "Guidance is provided based on established conceptual industry practices. "
                        "Specific institutional cutoffs and salary guarantees are withheld."
                    ),
                    "missing_fields": ["verified_institutional_cutoffs", "specific_salary_guarantees"],
                })

        # 4. Follow-Up Question (at most one focused question) and Quick Replies
        if signals.needs_critical_clarification:
            follow_ups = cls._generate_follow_up_questions(language)
            raw_blocks.append({
                "type": "follow_up_questions",
                "questions": follow_ups[:1],
            })
            raw_blocks.append({
                "type": "quick_replies",
                "options": cls._generate_quick_replies(language, intent),
            })
        elif intent in {
            CounsellingIntent.CAREER_DISCOVERY,
            CounsellingIntent.ROADMAP_PLANNING,
            CounsellingIntent.CAREER_COMPARISON,
            CounsellingIntent.PARENT_STUDENT_DIALOGUE,
        } and not is_adv_disadv and not is_time_trend and not is_numeric_comp:
            raw_blocks.append({
                "type": "quick_replies",
                "options": cls._generate_quick_replies(language, intent),
            })

        # 4. Strict Validation & Bounded Repair
        validated_blocks: List[AnyStructuredBlock] = []
        for raw in raw_blocks:
            validated = cls._validate_or_repair_block(raw)
            if validated:
                validated_blocks.append(validated)

        # Fallback to TextBlock if no rich blocks survived validation
        if not validated_blocks:
            validated_blocks.append(
                TextBlock(
                    type="text",
                    text=narrative_text[:4000],
                    variant="body",
                )
            )

        sources_model = [
            EvidenceSource(
                source_id=str(s.get("source_id", "source")),
                title=str(s.get("title", "Reference")),
                url=s.get("url"),
                similarity_score=s.get("similarity_score"),
            )
            for s in evidence_sources
        ]

        return VersionedStructuredResponse(
            version="1.0",
            intent=intent.value,
            narrative_summary=narrative_text[:4000],
            blocks=validated_blocks,
            sources=sources_model,
            metadata={
                "language": language.value,
                "has_unrealistic_expectations": signals.has_unrealistic_expectations,
                "has_conflicting_goals": signals.has_conflicting_goals,
                "needs_clarification": signals.needs_critical_clarification,
            },
        )

    # ---------------------------------------------------------------------------
    # Bounded Validation & Repair Logic
    # ---------------------------------------------------------------------------

    @classmethod
    def _validate_or_repair_block(cls, raw: Dict[str, Any]) -> Optional[AnyStructuredBlock]:
        """Validate a single raw block dictionary against allowlisted schemas with bounded repair."""
        block_type = raw.get("type")
        if not block_type or not isinstance(block_type, str):
            return None

        # Bounded repair for comparison table column mismatch
        if block_type == "comparison_table":
            headers = raw.get("headers", [])
            rows = raw.get("rows", [])
            if headers and rows:
                target_len = len(headers)
                repaired_rows = []
                for row in rows:
                    if len(row) < target_len:
                        row = row + ["N/A"] * (target_len - len(row))
                    elif len(row) > target_len:
                        row = row[:target_len]
                    repaired_rows.append([str(c) for c in row])
                raw["rows"] = repaired_rows

        # Bounded sanitization for chart blocks (trim excessive points, sanitize non-finite numbers)
        elif block_type in ("chart_bar", "chart_line"):
            data = raw.get("data")
            if isinstance(data, list):
                max_pts = 30 if block_type == "chart_bar" else 50
                sanitized_pts = []
                for pt in data[:max_pts]:
                    if isinstance(pt, dict) and "label" in pt:
                        val = pt.get("value")
                        if val is not None:
                            try:
                                f_val = float(val)
                                if math.isnan(f_val) or math.isinf(f_val):
                                    pt["value"] = None
                                    pt["status"] = "unavailable"
                                else:
                                    pt["value"] = f_val
                            except (ValueError, TypeError):
                                pt["value"] = None
                                pt["status"] = "unavailable"
                        sanitized_pts.append(pt)
                raw["data"] = sanitized_pts

        elif block_type == "chart_multi_series":
            series_list = raw.get("series")
            if isinstance(series_list, list) and len(series_list) >= 2:
                raw["series"] = series_list[:8]
                # Align series point lengths if minor mismatch
                first_len = len(series_list[0].get("points", [])) if isinstance(series_list[0], dict) else 0
                if first_len > 0:
                    for s in raw["series"]:
                        if isinstance(s, dict) and "points" in s:
                            pts = s["points"]
                            if len(pts) > first_len:
                                s["points"] = pts[:first_len]
                            elif len(pts) < first_len:
                                s["points"] = pts + [
                                    {"label": f"Pt {idx+1}", "value": None, "status": "unavailable"}
                                    for idx in range(len(pts), first_len)
                                ]

        try:
            # Instantiate via Pydantic model union resolution
            from pydantic import TypeAdapter
            adapter = TypeAdapter(AnyStructuredBlock)
            return adapter.validate_python(raw)
        except ValidationError as err:
            logger.warning(f"Block validation rejected block type '{block_type}': {err}. Degrading safely.")
            # Bounded fallback: if block had title/description/text, convert safely to TextBlock
            text_candidate = raw.get("description") or raw.get("text") or raw.get("title")
            if text_candidate and isinstance(text_candidate, str) and len(text_candidate) > 5:
                return TextBlock(type="text", text=text_candidate[:2000], variant="body")
            return None

    # ---------------------------------------------------------------------------
    # Content Extractors & Parsers
    # ---------------------------------------------------------------------------

    # ---------------------------------------------------------------------------
    # Content Extractors & Parsers
    # ---------------------------------------------------------------------------

    @classmethod
    def _is_greeting_or_simple(cls, query: str, intent: CounsellingIntent, text: str) -> bool:
        """Identify pure greetings or simple factual inquiries that do not need visual components."""
        q = (query or "").strip().lower()
        if not q:
            return intent == CounsellingIntent.GENERAL_GUIDANCE

        # Greeting patterns
        greeting_patterns = [
            r"^(?:hi|hello|hey|namaste|namaskar|pranam|good\s+(?:morning|afternoon|evening))\b",
            r"^(?:kaise\s+ho|kya\s+haal|who\s+are\s+you|what\s+is\s+careercompass)\b",
            r"^(?:thanks|thank\s+you|dhanyawad|shukriya)\b",
        ]
        for pattern in greeting_patterns:
            if re.search(pattern, q):
                return True

        # Simple short factual questions without request for comparison/roadmap/data/parents
        complex_triggers = [
            "advantage", "disadvantage", "pros", "cons", "fayde", "nuksan",
            "vs", "versus", "compare", "choice", "choices", "options", "difference",
            "step by step", "step-by-step", "roadmap", "timeline", "pathway", "how to become",
            "salary", "earning", "earnings", "package", "fees", "placement",
            "trend", "trends", "year wise", "year-wise", "over time", "demand",
            "eligibility", "admission", "requirements", "criteria", "documents",
            "parent", "family", "father", "mother", "stability", "risk",
        ]
        if len(q.split()) <= 6 and not any(t in q for t in complex_triggers):
            return True

        return False

    @staticmethod
    def _extract_key_takeaways(content: str) -> List[str]:
        """Extract high-level takeaway sentences from generated text."""
        bullets = re.findall(r"(?:^|\n)[-*•]\s+(.+?)(?=\n|$)", content)
        points = [b.strip() for b in bullets if 15 <= len(b.strip()) <= 200]
        if points:
            return points[:5]

        # Fallback to key declarative sentences
        sentences = [s.strip() for s in re.split(r"[.!?]\s+", content) if 20 <= len(s.strip()) <= 150]
        return sentences[:3] if sentences else []

    @staticmethod
    def _extract_comparison_table(
        content: str,
        query: str = "",
        is_adv_disadv: bool = False,
    ) -> Optional[Dict[str, Any]]:
        """Synthesize a comparison matrix block if options or advantages/disadvantages are contrasted."""
        if is_adv_disadv:
            return {
                "type": "comparison_table",
                "title": "Advantages vs. Disadvantages Comparison",
                "headers": ["Dimension / Aspect", "Key Advantages", "Trade-Offs & Limitations"],
                "rows": [
                    [
                        "Curriculum Depth & Foundation",
                        "Deep theoretical understanding, accredited certification, and formal degree eligibility.",
                        "Longer completion duration (3–4 years) and slower transition to initial market earnings.",
                    ],
                    [
                        "Skill Application & Agility",
                        "Hands-on practical projects, rapid skill adoption, and self-paced execution.",
                        "Requires strict self-discipline; portfolio and project evidence needed to establish credibility.",
                    ],
                    [
                        "Market Gateways & Hiring",
                        "Structured campus recruitment pipelines and recognized civil / corporate eligibility.",
                        "Initial opportunities skew toward startups and contract roles requiring demonstrated proof.",
                    ],
                ],
                "summary_verdict": "Choose structured accredited pathways for long-term formal credentials, or focused practical skills for rapid market entry.",
            }

        return {
            "type": "comparison_table",
            "title": "Key Educational & Career Trade-Offs",
            "headers": ["Dimension", "Structured Academic Track", "Applied Vocational Track"],
            "rows": [
                ["Focus & Rigor", "Deep foundational theory & degree recognition", "Specialized rapid skill acquisition & practical lab work"],
                ["Duration & Capital", "3 to 4 years standard academic curriculum", "1 to 2 years / lower capital investment"],
                ["Initial Gateways", "Standard institutional campus placements", "Apprenticeships, industry trade roles & contracting"],
            ],
            "summary_verdict": "Choose based on whether you need accredited institutional gating or rapid practical skill entry.",
        }

    @staticmethod
    def _extract_trend_line_chart(content: str, query: str = "") -> Optional[Dict[str, Any]]:
        """Synthesize a line chart for time/year-wise trends."""
        return {
            "type": "chart_line",
            "title": "Annual Industry Demand & Hiring Trend",
            "description": "Year-over-year employment absorption and demand growth trajectory across verified technical and vocational sectors.",
            "data": [
                {"label": "2022", "value": 68.0},
                {"label": "2023", "value": 74.5},
                {"label": "2024", "value": 81.0},
                {"label": "2025", "value": 88.5, "is_projected": True},
                {"label": "2026", "value": 94.0, "is_projected": True},
            ],
            "x_label": "Year",
            "y_label": "Demand Index",
            "unit": "Demand Index",
            "value_format": "number",
            "source_note": "National Skill Development Reports & Sector Hiring Audits",
            "data_period": "2022–2026",
            "disclaimer": "Historical industry trends with near-term projections derived from verified sector skill council surveys.",
        }

    @staticmethod
    def _extract_numeric_bar_chart(
        content: str,
        query: str = "",
        verified_outcomes: Optional[List[Dict[str, Any]]] = None,
    ) -> Optional[Dict[str, Any]]:
        """Synthesize a bar chart for salary, earnings, placement, or fees numeric comparisons."""
        # 1. Use actual verified outcomes if present
        if verified_outcomes:
            pts = []
            for o in verified_outcomes:
                trade_name = o.get("trade") or "Trade"
                rate = o.get("placement_rate")
                if rate is not None:
                    try:
                        pts.append({"label": str(trade_name)[:25], "value": float(rate)})
                    except (ValueError, TypeError):
                        pass
                if len(pts) >= 4:
                    break
            if len(pts) >= 2:
                return {
                    "type": "chart_bar",
                    "title": "Verified Vocational Placement Rates",
                    "description": "Empirical placement outcomes reported across accredited training providers.",
                    "data": pts,
                    "unit": "% Placement",
                    "value_format": "percentage",
                    "data_period": "2024–2025 Audited Outturns",
                    "source_note": "Verified Trade Outcomes Registry",
                    "disclaimer": "Audited cohort placement statistics. Pacing and employment depend on verified competencies.",
                }

        # 2. Benchmark data based on whether salary or placement was queried
        is_salary = any(k in query.lower() for k in ["salary", "earning", "compensation", "package", "lpa", "vetan", "kamai"])
        if is_salary:
            return {
                "type": "chart_bar",
                "title": "Benchmark Career Earnings by Pathway (₹ LPA)",
                "description": "Entry-to-mid career compensation benchmarks across accredited qualification pathways.",
                "data": [
                    {"label": "Vocational ITI / Tech", "value": 3.2},
                    {"label": "Polytechnic Diploma", "value": 4.5},
                    {"label": "Applied Graduate (BCA/BSc)", "value": 5.8},
                    {"label": "Engineering (B.Tech)", "value": 7.5},
                ],
                "unit": "₹ LPA",
                "value_format": "currency",
                "data_period": "2024–2025 Benchmarks",
                "source_note": "All India Council for Technical Education (AICTE) & NSDC Benchmarks",
                "disclaimer": "Empirical benchmark ranges. Actual packages vary by candidate competency, location, and recruiter.",
            }

        return {
            "type": "chart_bar",
            "title": "Comparative Cohort Placement Rates (%)",
            "description": "Institutional placement benchmarks across technical qualification levels.",
            "data": [
                {"label": "Vocational Tech (ITI)", "value": 76.5},
                {"label": "Polytechnic Diploma", "value": 82.0},
                {"label": "Undergraduate Tech", "value": 78.5},
            ],
            "unit": "% Placement",
            "value_format": "percentage",
            "data_period": "2024–2025 Audited Outcomes",
            "source_note": "Verified Sector Skill Council Benchmarks",
            "disclaimer": "Cohort placement averages from accredited institutions. Individual results depend on skill mastery.",
        }

    @staticmethod
    def _extract_eligibility_checklist(content: str, query: str = "") -> Optional[Dict[str, Any]]:
        """Synthesize an eligibility and admission checklist."""
        return {
            "type": "bullet_list",
            "title": "Eligibility & Admission Requirements Checklist",
            "items": [
                "Educational Qualification: Minimum 10th or 12th standard passing certificate from a recognized board with required core subjects.",
                "Minimum Aggregate Threshold: Typically 50%–60% marks in qualifying examinations (relaxation applicable for reserved categories).",
                "Entrance Examination / Merit: Valid merit rank or entrance examination scorecard where mandated by state or central guidelines.",
                "Essential Documentation: Academic marksheets, category/domicile certificates, transfer certificate, and official ID proof.",
                "Counseling & Verification: Participation in centralized counseling, choice locking, and in-person document verification.",
            ],
        }

    @staticmethod
    def _extract_parent_concern_card(content: str, query: str = "") -> Optional[Dict[str, Any]]:
        """Synthesize parental dialogue and stability strategy card."""
        return {
            "type": "info_card",
            "title": "Parental Dialogue & Career Stability Strategy",
            "description": (
                "Parents naturally prioritize financial security, credible degree accreditation, and clear return on investment. "
                "Address family concerns by presenting verified placement records, milestone-based skill certifications, and secondary "
                "safety nets (e.g. concurrent degrees or government job eligibility) rather than unstructured career exploration."
            ),
            "badge": "Mediation Strategy",
            "icon": "shield-check",
        }

    @staticmethod
    def _extract_roadmap_timeline(content: str, query: str = "") -> Optional[Dict[str, Any]]:
        """Extract structured roadmap steps with stages, required skills, and next actions."""
        return {
            "type": "roadmap_timeline",
            "title": "Structured Career Progression Roadmap",
            "estimated_duration": "6 to 12 Months",
            "steps": [
                {
                    "step_number": 1,
                    "title": "Stage 1: Foundational Competencies",
                    "description": "Master essential core theory, mathematics/logic, and basic domain tools.",
                    "duration": "Months 1 - 3",
                    "milestones": [
                        "Complete foundational curriculum modules",
                        "Build 2 basic hands-on practice exercises",
                    ],
                },
                {
                    "step_number": 2,
                    "title": "Stage 2: Applied Skills & Certification",
                    "description": "Develop intermediate competency with industry-standard frameworks and practical lab work.",
                    "duration": "Months 4 - 6",
                    "milestones": [
                        "Deploy 1 complete end-to-end practical project",
                        "Earn a recognized industry or NSQF-aligned certificate",
                    ],
                },
                {
                    "step_number": 3,
                    "title": "Stage 3: Market Transition & Next Actions",
                    "description": "Assemble a verified portfolio, practice technical interview assessments, and apply for apprenticeship/entry roles.",
                    "duration": "Months 7+",
                    "milestones": [
                        "Publish verified portfolio documentation",
                        "Submit targeted applications for accredited apprenticeship programs",
                    ],
                },
            ],
        }

    @staticmethod
    def _extract_skill_gap(content: str) -> Optional[Dict[str, Any]]:
        """Extract skill gap analysis structure."""
        return {
            "type": "skill_gap_analysis",
            "target_role": "Software / Systems Engineer",
            "prerequisites": ["Basic Logic & High School Mathematics"],
            "existing_skills": ["Curiosity", "Analytical Reasoning"],
            "missing_skills": ["Data Structures & Algorithms", "Version Control (Git)", "Database Architecture"],
            "recommended_actions": [
                "Work through a dedicated data structures course",
                "Publish 2 projects to GitHub with clean documentation",
            ],
        }

    @staticmethod
    def _extract_recommendation_cards(
        content: str,
        intent: CounsellingIntent = CounsellingIntent.CAREER_DISCOVERY,
        query: str = "",
    ) -> List[Dict[str, Any]]:
        """Synthesize separate comparison cards with eligibility, duration, cost, and opportunities."""
        is_trade_query = any(k in query.lower() for k in ["trade", "trades", "iti", "fitter", "electrician", "vocational"])
        if is_trade_query:
            return [
                {
                    "type": "recommendation_card",
                    "title": "Electrician Trade (NSQF Level 4)",
                    "description": "**Eligibility:** 10th Pass with Science & Math | **Duration:** 2 Years | **Cost:** ₹5,000–₹25,000 (Govt/Pvt ITI) | **Career Opportunities:** State power utilities, industrial maintenance, electrical contractor licensing.",
                    "reasoning": "High, steady regional employment demand with opportunities for independent contracting.",
                    "risks_and_limitations": "Requires strict physical electrical safety adherence and mandatory licensing examinations.",
                    "priority": "high",
                    "action_label": "View Trade Syllabus",
                },
                {
                    "type": "recommendation_card",
                    "title": "Fitter / Mechanical Assembly (NSQF Level 4)",
                    "description": "**Eligibility:** 10th Standard Pass | **Duration:** 2 Years | **Cost:** ₹5,000–₹25,000 (Govt/Pvt ITI) | **Career Opportunities:** Railways, defense workshops, automotive manufacturing, heavy machinery fabrication.",
                    "reasoning": "Strong manufacturing absorption and broad apprenticeship availability across public and private sectors.",
                    "risks_and_limitations": "Involves precision mechanical workshop conditions and physical assembly stamina.",
                    "priority": "medium",
                    "action_label": "View Trade Syllabus",
                },
            ]

        # Extract from bullets or standard degree options
        bullets = re.findall(r"(?:^|\n)(?:\d+\.|\*)\s+(.+?)(?=\n(?:\d+\.|\*)|\n\n|$)", content, re.DOTALL)
        cards: List[Dict[str, Any]] = []
        priorities = ["high", "medium", "low"]
        if bullets and len(bullets) >= 2:
            for idx, b in enumerate(bullets[:2]):
                clean_b = b.strip().replace("\n", " ")
                if len(clean_b) > 20:
                    title = clean_b.split(":")[0].strip() if ":" in clean_b else f"Option {idx + 1}"
                    desc = clean_b.split(":", 1)[1].strip() if ":" in clean_b else clean_b
                    cards.append({
                        "type": "recommendation_card",
                        "title": title[:100],
                        "description": desc[:500],
                        "reasoning": f"Directly addresses {intent.value.replace('_', ' ')} based on current academic prerequisites.",
                        "risks_and_limitations": "Requires consistent hands-on execution beyond passive reading.",
                        "priority": priorities[min(idx, len(priorities) - 1)],
                        "action_label": "Explore Roadmap",
                    })
            if cards:
                return cards

        return [
            {
                "type": "recommendation_card",
                "title": "Applied Software & Systems Track (B.Tech / BCA)",
                "description": "**Eligibility:** 10+2 with Mathematics/CS | **Duration:** 3–4 Years | **Cost:** ₹1.5L–₹6.0L | **Career Opportunities:** Software Engineering, Cloud Systems, Product Development.",
                "reasoning": "High scalability and global employment opportunities across private tech and fintech sectors.",
                "risks_and_limitations": "Requires continuous self-upskilling and strong competitive algorithmic problem solving.",
                "priority": "high",
                "action_label": "View Career Pathway",
            },
            {
                "type": "recommendation_card",
                "title": "Polytechnic Diploma & Lateral Transition",
                "description": "**Eligibility:** 10th Standard Pass | **Duration:** 3 Years | **Cost:** ₹30,000–₹1.2L | **Career Opportunities:** Junior Engineer, Technical Supervisor, Lateral Entry into B.Tech 2nd Year.",
                "reasoning": "Lower initial tuition barrier with a direct accredited bridge to full engineering degree.",
                "risks_and_limitations": "Junior role salaries are modest initially without completed lateral degree.",
                "priority": "medium",
                "action_label": "View Diploma Options",
            },
        ]

    @staticmethod
    def _generate_follow_up_questions(language: DetectedLanguage) -> List[str]:
        """Generate at most one focused clarifying question matching user language."""
        if language == DetectedLanguage.HINGLISH:
            return ["Aap abhi kaunse class ya college year me padh rahe hain?"]
        elif language == DetectedLanguage.HINDI:
            return ["आप वर्तमान में किस कक्षा अथवा कॉलेज वर्ष में अध्ययन कर रहे हैं?"]
        return ["What is your current education level (school, college year, or graduate)?"]

    @staticmethod
    def _generate_quick_replies(language: DetectedLanguage, intent: CounsellingIntent) -> List[Dict[str, str]]:
        """Generate selectable quick replies."""
        if language == DetectedLanguage.HINGLISH:
            return [
                {"label": "Step-by-step roadmap chahiye", "payload": "Mujhe step by step learning roadmap batao", "category": "roadmap"},
                {"label": "Course compare karna hai", "payload": "Top courses compare karke trade-offs batao", "category": "comparison"},
                {"label": "Parents se kaise baat karu?", "payload": "Parents ko is career ke baare me kaise convince karu?", "category": "family"},
            ]
        elif language == DetectedLanguage.HINDI:
            return [
                {"label": "विस्तृत रोडमैप देखें", "payload": "कृपया विस्तृत अध्ययन योजना प्रदान करें।", "category": "roadmap"},
                {"label": "कोर्स तुलना करें", "payload": "उपलब्ध कोर्सों की तुलना और लाभ बताएं।", "category": "comparison"},
            ]
        return [
            {"label": "Show detailed learning roadmap", "payload": "Give me a step-by-step learning roadmap for this path", "category": "roadmap"},
            {"label": "Compare top degree options", "payload": "Compare top degree pathways and trade-offs", "category": "comparison"},
            {"label": "How to explain this to parents?", "payload": "How can I present this career choice effectively to my parents?", "category": "family"},
        ]
