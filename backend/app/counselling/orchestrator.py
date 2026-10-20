import re
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session
from app.ai import AIMessage, BaseAIProvider, get_ai_provider
from app.config import Settings, get_settings
from app.core.logging import get_logger
from app.counselling.analyzer import CounsellingQueryAnalyzer
from app.counselling.prompts import build_counselling_system_prompt
from app.counselling.types import (
    CounsellingIntent,
    CounsellingResponse,
    CounsellingSignals,
    CounsellingStructuredData,
    DetectedLanguage,
    RecommendationItem,
)
from app.rag.service import RAGService

logger = get_logger("counselling")


class CounsellingOrchestrator:
    """Dedicated career counselling orchestration service layer."""

    @staticmethod
    def _extract_recommendation_items(content: str, intent: CounsellingIntent) -> List[RecommendationItem]:
        """
        Synthesize structured recommendations with reasoning and trade-offs/limitations
        from the generated counselling content.
        """
        items: List[RecommendationItem] = []

        # Find bullet points or numbered recommendations in content
        bullets = re.findall(r"(?:^|\n)(?:[-*•]|\d+\.)\s+(.+?)(?=\n(?:[-*•]|\d+\.)|\n\n|$)", content, re.DOTALL)
        for b in bullets[:4]:
            clean_b = b.strip().replace("\n", " ")
            if len(clean_b) > 20:
                title = clean_b.split(":")[0].strip() if ":" in clean_b else clean_b[:40].strip()
                desc = clean_b.split(":", 1)[1].strip() if ":" in clean_b else clean_b
                items.append(
                    RecommendationItem(
                        title=title,
                        description=desc,
                        reasoning=f"Tailored for {intent.value.replace('_', ' ').title()} based on student profile and curriculum prerequisites.",
                        limitations_and_risks="Requires dedicated self-study consistency and hands-on project validation.",
                    )
                )

        if not items:
            items.append(
                RecommendationItem(
                    title=f"Structured {intent.value.replace('_', ' ').title()}",
                    description="Follow the phased guidance outlined in the counselling assessment.",
                    reasoning="Aligns with foundational academic and industry transition milestones.",
                    limitations_and_risks="Subject to individual pacing and regional educational criteria.",
                )
            )

        return items

    @staticmethod
    def _condense_counselling_narrative(
        text: str,
        intent: CounsellingIntent,
        has_visuals: bool = False,
        max_sentences: int = 4,
        max_words: int = 70,
        user_query: Optional[str] = None,
    ) -> str:
        """
        Enforce short replies by default (2-4 sentences, roughly 40-70 words max).
        For simple questions or greetings, answer in 1-2 short sentences.
        Avoid long intros and essay-style walls of text while preserving safety/caution details.
        """
        if not text or not text.strip():
            return text

        lines = text.strip().split("\n")
        cleaned_lines: List[str] = []
        for line in lines:
            stripped = line.strip()
            # Drop markdown headers
            if stripped.startswith("#"):
                continue
            # Drop markdown horizontal rules
            if stripped in ("---", "***", "___"):
                continue
            # Strip bullet prefixes if visual blocks handle structure
            if has_visuals and (stripped.startswith("- ") or stripped.startswith("* ") or re.match(r"^\d+\.\s+", stripped)):
                clean_pt = re.sub(r"^(?:[-*•]|\d+\.)\s+", "", stripped).strip()
                if clean_pt and len(clean_pt) > 15:
                    cleaned_lines.append(clean_pt)
                continue
            if stripped:
                cleaned_lines.append(stripped)

        merged = " ".join(cleaned_lines)

        # Strip conversational fluff, greetings, and preambles
        merged = re.sub(
            r"^(?:Certainly|Sure|Hello|Hi|Greetings|Namaste|Namaskar)!\s*(?:As an? (?:career counsellor|AI|counsellor)[^,.]*[,.]\s*)?",
            "",
            merged,
            flags=re.IGNORECASE,
        ).strip()
        merged = re.sub(
            r"^(?:I(?:'d| would) be (?:happy|glad) to help(?: you)? with that[.!]\s*)",
            "",
            merged,
            flags=re.IGNORECASE,
        ).strip()
        merged = re.sub(
            r"^(?:That(?:'s| is) a (?:great|very good|wonderful) question[.!]\s*)",
            "",
            merged,
            flags=re.IGNORECASE,
        ).strip()

        # Split sentences
        sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", merged) if s.strip()]
        if not sentences:
            return text.strip()

        # Strip trailing conversational sign-offs or repeated conclusions
        conclusion_patterns = [
            r"feel free to ask",
            r"let me know if you",
            r"hope this helps",
            r"best of luck",
            r"wishing you all the best",
            r"agar aapko aur koi sawal",
            r"kisi bhi sahayata ke liye",
        ]
        while sentences and any(re.search(p, sentences[-1], re.IGNORECASE) for p in conclusion_patterns):
            sentences.pop()

        if not sentences:
            return merged.strip()

        # Check for safety keywords
        safety_keywords = ("salary", "guarantee", "cutoff", "unrealistic", "risk", "trade-off", "tradeoff", "pressure")
        safety_sentence = next((s for s in sentences if any(k in s.lower() for k in safety_keywords)), None)

        # Determine target count based on query complexity
        q = (user_query or "").strip().lower()
        is_greeting = bool(re.search(r"^(?:hi|hello|hey|namaste|good\s+(?:morning|afternoon|evening))\b", q)) if q else False
        is_simple = is_greeting or intent == CounsellingIntent.GENERAL_GUIDANCE or (not has_visuals and len(sentences) <= 2)

        target_count = 1 if is_greeting else (2 if is_simple else 3)
        selected = sentences[:target_count]

        if safety_sentence and safety_sentence not in selected and len(selected) < max_sentences:
            selected.append(safety_sentence)

        result = " ".join(selected).strip()
        words = result.split()

        # Strictly enforce approximately 40-70 words maximum
        if len(words) > max_words and len(selected) > 2:
            shorter = " ".join(selected[:2]).strip()
            if len(shorter.split()) <= max_words:
                result = shorter
            elif len(shorter.split()) <= 75:
                result = shorter
            else:
                result = selected[0]

        return result

    @staticmethod
    def _extract_follow_up_questions(content: str, signals: CounsellingSignals) -> List[str]:
        """Extract or formulate targeted follow-up questions when clarification is needed."""
        # Find explicit question sentences in the content
        questions = [q.strip() + "?" for q in re.findall(r"([A-Z\u0900-\u097f][^.!?\n]*\?)", content)]
        valid_questions = [q for q in questions if len(q) > 15 and ("you" in q.lower() or "aap" in q.lower() or "your" in q.lower() or "kya" in q.lower())]

        if valid_questions:
            return valid_questions[:3]

        if signals.needs_critical_clarification:
            if signals.language.value == "hinglish":
                return [
                    "Aap abhi kaunse standard/year me hain (10th/12th/College)?",
                    "Aapka primary interest coding, design, business, ya management me se kisme zyada hai?",
                ]
            elif signals.language.value == "hindi":
                return [
                    "आप वर्तमान में किस कक्षा या कॉलेज वर्ष में अध्ययनरत हैं?",
                    "आपकी मुख्य रुचि तकनीकी (Technical) क्षेत्र में है या गैर-तकनीकी (Non-technical) में?",
                ]
            else:
                return [
                    "What is your current education level (high school, undergraduate, or working professional)?",
                    "Which specific subjects or work styles do you enjoy the most?",
                ]

        return []

    @classmethod
    async def process_counselling_turn(
        cls,
        db: Session,
        user_message: str,
        dialogue_history: List[AIMessage],
        settings: Optional[Settings] = None,
        provider: Optional[BaseAIProvider] = None,
        user_id: str = "default_user",
        conversation_id: Optional[str] = None,
        message_id: Optional[str] = None,
    ) -> CounsellingResponse:
        """
        Execute full counselling pipeline:
        1. Linguistic, cognitive, and intent signal extraction.
        2. Persistent memory context retrieval and deduplication.
        3. RAG evidence retrieval from verified repository.
        4. Dynamic system prompt generation with strict guardrails, memory grounding, and language matching.
        5. Provider execution.
        6. Extract facts and update conversational memory.
        7. Internal structured representation separation.
        """
        cfg = settings or get_settings()

        # 1. Check for Direct Escalation Commands (Accept / Decline / Info)
        clean_msg = user_message.strip().lower()
        if clean_msg.startswith("escalation:"):
            from app.counselling.escalation.service import HumanEscalationService
            from app.schemas.blocks import (
                InfoCardBlock,
                LimitationNoticeBlock,
                QuickRepliesBlock,
                QuickReplyOption,
                VersionedStructuredResponse,
            )
            action = clean_msg.split(":", 1)[1].strip()
            handoff_res = HumanEscalationService.process_handoff_request(
                user_id=user_id,
                conversation_id=conversation_id or "default",
                action=action,
                settings=cfg,
            )

            blocks: List[Any] = []
            if action == "accept":
                blocks = [
                    LimitationNoticeBlock(
                        type="limitation_notice",
                        title="Human Counsellor Service Status",
                        message=handoff_res.message,
                        missing_fields=["live_booking_gateway"],
                    ),
                    QuickRepliesBlock(
                        type="quick_replies",
                        options=[
                            QuickReplyOption(label="Continue with AI Guidance", payload="continue", category="navigation"),
                            QuickReplyOption(label="What questions can I ask?", payload="help", category="discovery"),
                        ],
                    ),
                ]
            elif action == "decline":
                blocks = [
                    InfoCardBlock(
                        type="info_card",
                        title="Continuing with AI Guidance",
                        description=handoff_res.message,
                        badge="Active Session",
                    ),
                    QuickRepliesBlock(
                        type="quick_replies",
                        options=[
                            QuickReplyOption(label="Explore Career Options", payload="explore career options", category="discovery"),
                            QuickReplyOption(label="Skill Gap Analysis", payload="skill gap analysis", category="learning"),
                        ],
                    ),
                ]
            else:  # info
                blocks = [
                    InfoCardBlock(
                        type="info_card",
                        title="Role of Human Career Counsellors",
                        description=handoff_res.message,
                        badge="Guidance Info",
                    ),
                    QuickRepliesBlock(
                        type="quick_replies",
                        options=[
                            QuickReplyOption(label="Talk to Human Counsellor", payload="escalation:accept", category="support"),
                            QuickReplyOption(label="Continue with AI Guidance", payload="escalation:decline", category="guidance"),
                        ],
                    ),
                ]

            versioned = VersionedStructuredResponse(
                version="1.0",
                intent=CounsellingIntent.GENERAL_GUIDANCE.value,
                narrative_summary=handoff_res.message,
                blocks=blocks,
                sources=[],
                metadata={"escalation_handled": True, "status": handoff_res.status.value},
            )
            return CounsellingResponse(
                content=handoff_res.message,
                structured=CounsellingStructuredData(
                    intent=CounsellingIntent.GENERAL_GUIDANCE.value,
                    language=DetectedLanguage.ENGLISH.value,
                    verified_facts=[],
                    estimates_and_ranges=[],
                    recommendations=[],
                    trade_offs=[],
                    follow_up_questions=[],
                    evidence_sources=[],
                    evidence_status="none",
                ),
                signals=CounsellingSignals(intent=CounsellingIntent.GENERAL_GUIDANCE),
                notice="Escalation Gateway Interaction",
                versioned=versioned,
            )

        # 1. Linguistic & Cognitive Signal Extraction
        signals = CounsellingQueryAnalyzer.extract_signals(
            query=user_message,
            history_count=len(dialogue_history),
        )

        # 2. Persistent Conversational Memory Retrieval
        from app.memory.service import MemoryService
        from app.memory.extractor import MemoryExtractor

        mem_result = MemoryService.get_relevant_memories(
            db=db,
            user_id=user_id,
            query_text=user_message,
            max_facts=8,
            max_tokens=400,
        )

        # If education level or target role is already known in memory, avoid repeated clarification questions
        if signals.needs_critical_clarification and mem_result.facts:
            has_core_context = any(
                f.key in ("education_level", "target_role", "technical_skills")
                for f in mem_result.facts
            )
            if has_core_context:
                signals.needs_critical_clarification = False

        if mem_result.has_conflicts:
            signals.has_conflicting_goals = True
            signals.conflicting_goal_details = "; ".join(mem_result.conflict_notes)

        logger.info(
            f"Counselling turn analyzed: intent={signals.intent.value}, language={signals.language.value}, "
            f"memories_count={len(mem_result.facts)}, needs_clarification={signals.needs_critical_clarification}"
        )

        # 3. RAG Evidence Retrieval
        rag_evidence_text = None
        has_sufficient_evidence = False
        evidence_sources: List[Dict[str, Any]] = []

        if cfg.RAG_ENABLED:
            rag_result = await RAGService.retrieve(db=db, query=user_message, settings=cfg)
            has_sufficient_evidence = rag_result.has_sufficient_evidence
            rag_evidence_text = rag_result.evidence_text
            evidence_sources = rag_result.sources

        # 4. Dynamic System Prompt Generation with Untrusted Memory Context
        system_prompt = build_counselling_system_prompt(
            signals=signals,
            rag_evidence_text=rag_evidence_text,
            has_sufficient_evidence=has_sufficient_evidence,
            user_memory_context=mem_result.prompt_context,
        )

        # 5. Extract and persist facts from the user's latest statement
        extracted_facts = MemoryExtractor.extract_facts_from_turn(user_message=user_message)
        for fact in extracted_facts:
            MemoryService.upsert_fact(
                db=db,
                user_id=user_id,
                fact=fact,
                source_conversation_id=conversation_id,
                source_message_id=message_id,
            )

        # 6. AI Provider Invocation
        active_provider: Optional[BaseAIProvider] = provider if provider is not None else get_ai_provider(cfg)

        if active_provider is None:
            # Unconfigured provider fallback
            fallback_content = (
                "The AI Career Counsellor engine is currently awaiting configuration. "
                "Please configure AI_PROVIDER (gemini, groq, or openai) with a valid API key in backend/.env."
            )
            structured_data = CounsellingStructuredData(
                intent=signals.intent.value,
                language=signals.language.value,
                verified_facts=[],
                estimates_and_ranges=[],
                recommendations=[],
                trade_offs=[],
                follow_up_questions=[],
                evidence_sources=evidence_sources,
                evidence_status="none",
            )
            return CounsellingResponse(
                content=fallback_content,
                structured=structured_data,
                signals=signals,
                notice="AI Service Pending Configuration (No mock data returned)",
            )

        ai_response = await active_provider.generate_reply(
            messages=dialogue_history,
            system_prompt=system_prompt,
        )

        # 5. Extract Structured Elements (Separating facts, estimates, recommendations)
        raw_text = ai_response.content
        recommendation_items = cls._extract_recommendation_items(raw_text, signals.intent)
        follow_up_qs = cls._extract_follow_up_questions(raw_text, signals)

        # Verified facts based on RAG sources or explicit knowledge
        verified_facts = [
            s.get("title", "Curriculum Reference") + (f" (Verified standard)" if s.get("source_id") else "")
            for s in evidence_sources
        ] if evidence_sources else []

        # Trade-offs identification
        trade_offs: List[str] = []
        if signals.has_conflicting_goals:
            trade_offs.append(signals.conflicting_goal_details or "Conflicting priorities require phased pacing.")
        if signals.has_unrealistic_expectations:
            trade_offs.append("High reward pathways require multi-month foundational skill building vs quick shortcuts.")
        if signals.intent == CounsellingIntent.CAREER_COMPARISON:
            trade_offs.append("Comparison involves weighing theoretical depth vs immediate practical employability.")

        # Estimate flags
        estimates_and_ranges: List[str] = []
        if any(term in raw_text.lower() for term in ["lpa", "salary", "compensation", "package", "range"]):
            estimates_and_ranges.append("Compensation figures and hiring packages mentioned are industry benchmark ranges, not fixed guarantees.")
        if any(term in raw_text.lower() for term in ["months", "duration", "timeline"]):
            estimates_and_ranges.append("Learning timelines depend heavily on individual prior exposure and daily practice hours.")

        evidence_status = "sufficient" if has_sufficient_evidence else ("insufficient" if evidence_sources else "none")

        structured_data = CounsellingStructuredData(
            intent=signals.intent.value,
            language=signals.language.value,
            verified_facts=verified_facts,
            estimates_and_ranges=estimates_and_ranges,
            recommendations=recommendation_items,
            trade_offs=trade_offs,
            follow_up_questions=follow_up_qs,
            evidence_sources=evidence_sources,
            evidence_status=evidence_status,
        )

        # Technical provider/model metadata is logged on the backend only; do not expose internal details in user chat
        logger.info(
            f"Generated via {ai_response.provider} ({ai_response.model}) • Counselling Intelligence ({signals.language.value}) • Grounded on {len(evidence_sources)} source(s)"
        )
        notice_text: Optional[str] = None

        # Retrieve verified outcomes from database when query touches outcomes, trades, salary, or placement
        verified_outcomes_data: List[Dict[str, Any]] = []
        try:
            from app.models.outcome import VerifiedOutcome
            from sqlalchemy import select
            q_lower = user_message.lower()
            if any(term in q_lower for term in ["placement", "salary", "earnings", "package", "fees", "trade", "outcome", "rate", "iti"]):
                stmt = select(VerifiedOutcome).where(VerifiedOutcome.verification_status == "verified").limit(10)
                outcomes = db.execute(stmt).scalars().all()
                for o in outcomes:
                    verified_outcomes_data.append({
                        "trade": o.trade,
                        "training_provider": o.training_provider,
                        "location": o.location,
                        "nsqf_level": o.nsqf_level,
                        "placement_rate": o.placement_rate,
                        "earnings_range": o.post_training_earnings_range,
                        "reporting_period": o.reporting_period,
                        "sample_size": o.sample_size,
                        "source_url": o.source_url,
                        "progression_pathways": o.progression_pathways,
                    })
        except Exception as err:
            logger.debug(f"Could not load verified trade outcomes: {err}")

        from app.counselling.response_engine import DynamicResponseEngine
        versioned_response = DynamicResponseEngine.assemble_response(
            intent=signals.intent,
            language=signals.language,
            signals=signals,
            narrative_text=raw_text,
            evidence_sources=evidence_sources,
            has_sufficient_evidence=has_sufficient_evidence,
            user_query=user_message,
            verified_outcomes=verified_outcomes_data,
        )

        # 6. Evaluate Human Counsellor Escalation Trigger
        from app.counselling.escalation.service import HumanEscalationService
        escalation_eval = HumanEscalationService.evaluate_turn(
            query=user_message,
            signals=signals,
            history_count=len(dialogue_history),
            dialogue_history=dialogue_history,
            memory_facts=mem_result.facts,
        )

        if escalation_eval.should_escalate and versioned_response:
            from app.schemas.blocks import QuickRepliesBlock, QuickReplyOption, RecommendationCardBlock
            escalation_card = RecommendationCardBlock(
                type="recommendation_card",
                title="Human Counsellor Consultation (Optional Support)",
                description=escalation_eval.gentle_invitation or "A human counsellor can offer 1-on-1 personalized guidance for complex decisions.",
                reasoning=escalation_eval.reason or "High-stakes or complex decisions benefit from personalized human guidance.",
                risks_and_limitations="External live booking integration is currently unconfigured in this deployment.",
                priority="medium",
                action_label="Explore Human Support",
            )
            escalation_quick_replies = QuickRepliesBlock(
                type="quick_replies",
                options=[
                    QuickReplyOption(label="Talk to Human Counsellor", payload="escalation:accept", category="support"),
                    QuickReplyOption(label="Continue with AI Guidance", payload="escalation:decline", category="guidance"),
                    QuickReplyOption(label="Why a Human Counsellor?", payload="escalation:info", category="info"),
                ],
            )
            versioned_response.blocks.append(escalation_card)
            versioned_response.blocks.append(escalation_quick_replies)
            versioned_response.metadata["escalation_suggested"] = True
            versioned_response.metadata["escalation_trigger"] = (
                escalation_eval.trigger_type.value if escalation_eval.trigger_type else None
            )

        # Condense narrative to short 2-4 sentences / 40-70 words maximum
        has_rich_blocks = bool(
            versioned_response and any(b.type != "text" for b in versioned_response.blocks)
        )
        condensed_text = cls._condense_counselling_narrative(
            raw_text,
            intent=signals.intent,
            has_visuals=has_rich_blocks,
            user_query=user_message,
        )

        return CounsellingResponse(
            content=condensed_text,
            structured=structured_data,
            signals=signals,
            notice=notice_text,
            versioned=versioned_response,
        )
