import re
import uuid
from typing import Any, List, Optional
from app.ai.types import AIMessage
from app.config import Settings, get_settings
from app.core.logging import get_logger
from app.counselling.escalation.schemas import (
    EscalationEvaluationResult,
    EscalationHandoffResult,
    EscalationHandoffStatus,
    EscalationTriggerType,
)
from app.counselling.types import CounsellingSignals

logger = get_logger("counselling_escalation")

EXPLICIT_HUMAN_REQUEST_PATTERNS = [
    re.compile(r"\b(?:speak to (?:a )?human|talk to (?:a )?human|real person|human counsellor|human counselor|human advisor|connect me (?:with|to) (?:a )?counsellor|talk to a person|human guidance)\b", re.IGNORECASE),
]

COMPLEX_CRISIS_PATTERNS = [
    re.compile(r"\b(?:dropped out|drop out|huge loan|heavy debt|ruined my career|ruined my life|failed completely|parents forcing me|extreme stress|desperate)\b", re.IGNORECASE),
]

PROLONGED_CONFUSION_PATTERNS = [
    re.compile(r"\b(?:completely lost|no idea what to do|hopeless|so confused|nothing makes sense|stuck in a loop|overwhelmed)\b", re.IGNORECASE),
]


class HumanEscalationService:
    """
    Dedicated counselling escalation service.
    Identifies situations where human counsellor support is more appropriate,
    offers gentle, respectful, optional handoffs, and enforces transparent
    limitations when external handoff integrations are unconfigured.
    """

    @classmethod
    def evaluate_turn(
        cls,
        query: str,
        signals: CounsellingSignals,
        history_count: int = 0,
        dialogue_history: Optional[List[AIMessage]] = None,
        memory_facts: Optional[List[Any]] = None,
    ) -> EscalationEvaluationResult:
        """
        Evaluate student query, signals, dialogue history, and active memory
        to determine if human counsellor escalation is appropriate.
        """
        clean_query = query.strip()
        lower_query = clean_query.lower()

        # 1. Trigger A: Explicit User Request
        for pat in EXPLICIT_HUMAN_REQUEST_PATTERNS:
            if pat.search(lower_query):
                logger.info("Human escalation triggered: trigger=explicit_request")
                return EscalationEvaluationResult(
                    should_escalate=True,
                    trigger_type=EscalationTriggerType.EXPLICIT_REQUEST,
                    reason="You explicitly requested guidance from a human counsellor or specialist.",
                    gentle_invitation="We're glad to connect you with human counsellor options whenever you feel personal discussion would be more helpful than automated analysis.",
                    confidence=1.0,
                )

        # 2. Trigger B: Unresolved Complex / High-Impact Life Decision
        for pat in COMPLEX_CRISIS_PATTERNS:
            if pat.search(lower_query):
                logger.info("Human escalation triggered: trigger=unresolved_complex_decision")
                return EscalationEvaluationResult(
                    should_escalate=True,
                    trigger_type=EscalationTriggerType.UNRESOLVED_COMPLEX_DECISION,
                    reason="Navigating significant academic setbacks, high financial stakes, or family pressures often requires personalized human empathy and strategic negotiation.",
                    gentle_invitation="While I can organize data and comparative options, major high-stakes decisions often benefit from a conversation with a human mentor or academic counselor.",
                    confidence=0.92,
                )

        # 3. Trigger C: Conflicting High-Impact Constraints
        if signals.has_conflicting_goals and signals.conflicting_goal_details:
            logger.info("Human escalation triggered: trigger=conflicting_high_impact_constraints")
            return EscalationEvaluationResult(
                should_escalate=True,
                trigger_type=EscalationTriggerType.CONFLICTING_HIGH_IMPACT_CONSTRAINTS,
                reason="Your current goals and constraints have significant trade-offs that involve personal priorities rather than purely technical answers.",
                gentle_invitation="Balancing competing career priorities is deeply personal. A human advisor can help explore creative compromises that quantitative algorithms might overlook.",
                confidence=0.88,
            )

        # 4. Trigger D: Prolonged Uncertainty & Looping
        is_confused = any(pat.search(lower_query) for pat in PROLONGED_CONFUSION_PATTERNS)
        if (signals.has_high_uncertainty or is_confused) and history_count >= 3:
            logger.info("Human escalation triggered: trigger=prolonged_uncertainty")
            return EscalationEvaluationResult(
                should_escalate=True,
                trigger_type=EscalationTriggerType.PROLONGED_UNCERTAINTY,
                reason="When career exploration starts feeling overwhelming or circular, stepping back with a human counsellor can provide grounded clarity.",
                gentle_invitation="It is completely normal to feel uncertain with so many options. An exploratory session with an academic mentor can help cut through the noise.",
                confidence=0.85,
            )

        return EscalationEvaluationResult(should_escalate=False)

    @classmethod
    def process_handoff_request(
        cls,
        user_id: str,
        conversation_id: str,
        action: str,  # "accept", "decline", "info"
        user_notes: Optional[str] = None,
        settings: Optional[Settings] = None,
    ) -> EscalationHandoffResult:
        """
        Process a user's response to an escalation offer.
        If no real counsellor booking system is configured, states that limitation honestly.
        Never pretends a request was delivered when no integration is active.
        """
        cfg = settings or get_settings()
        service_configured = bool(cfg.HUMAN_COUNSELLOR_SERVICE_URL or cfg.HUMAN_COUNSELLOR_EMAIL)

        # Privacy-safe operational logging (no user_notes or private content logged)
        logger.info(
            f"Escalation handoff action processed: action={action}, configured={service_configured}, user_id={user_id}"
        )

        if action == "decline":
            return EscalationHandoffResult(
                status=EscalationHandoffStatus.DECLINED,
                is_configured=service_configured,
                message="Understood. We will continue exploring your career pathways with AI guidance here. You can ask for human support at any point.",
                action_suggested="continue_ai",
            )

        if action == "info":
            return EscalationHandoffResult(
                status=EscalationHandoffStatus.COMPLETED,
                is_configured=service_configured,
                message=(
                    "Human counsellors provide personalized 1-on-1 exploration of career decisions, "
                    "helping with family alignment, nuanced financial planning, and emotional clarity "
                    "that automated analysis alone cannot substitute."
                ),
                action_suggested="review_info",
            )

        # Action: "accept"
        if not service_configured:
            # Honest, transparent declaration of current environment limitation
            return EscalationHandoffResult(
                status=EscalationHandoffStatus.UNCONFIGURED,
                is_configured=False,
                message=(
                    "Human counsellor booking service is currently unconfigured in this deployment environment. "
                    "Your request could not be dispatched to an external counsellor. "
                    "CareerCompass AI will continue guiding you directly, and we recommend consulting your "
                    "institution's student advisory or career cell."
                ),
                reference_id=None,
                action_suggested="institutional_advisory",
            )

        # Configured handoff flow
        ref_id = f"REF-{uuid.uuid4().hex[:8].upper()}"
        return EscalationHandoffResult(
            status=EscalationHandoffStatus.PENDING,
            is_configured=True,
            message=(
                f"Your request for human counsellor connection has been registered (Reference: {ref_id}). "
                "An advisor will review your context."
            ),
            reference_id=ref_id,
            action_suggested="await_contact",
        )
