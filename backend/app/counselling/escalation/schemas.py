from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field


class EscalationTriggerType(str, Enum):
    """Categorized triggers for suggesting human career counsellor support."""
    EXPLICIT_REQUEST = "explicit_request"
    UNRESOLVED_COMPLEX_DECISION = "unresolved_complex_decision"
    PROLONGED_UNCERTAINTY = "prolonged_uncertainty"
    CONFLICTING_HIGH_IMPACT_CONSTRAINTS = "conflicting_high_impact_constraints"


class EscalationHandoffStatus(str, Enum):
    """Status of the external human counsellor handoff dispatch."""
    UNCONFIGURED = "unconfigured"
    PENDING = "pending"
    COMPLETED = "completed"
    DECLINED = "declined"
    FAILED = "failed"


class EscalationEvaluationResult(BaseModel):
    """Result of analyzing a dialogue turn for human counsellor escalation appropriateness."""
    should_escalate: bool = False
    trigger_type: Optional[EscalationTriggerType] = None
    reason: Optional[str] = None
    gentle_invitation: Optional[str] = None
    confidence: float = 0.0


class EscalationHandoffResult(BaseModel):
    """
    Result of a human counsellor handoff request.
    Always honestly identifies whether an external counsellor system is actually configured,
    preventing any false pretense of scheduled sessions.
    """
    status: EscalationHandoffStatus
    is_configured: bool
    message: str
    reference_id: Optional[str] = None
    action_suggested: Optional[str] = None


class EscalationActionRequest(BaseModel):
    """Payload for user interaction with an escalation suggestion."""
    action: str = Field(..., pattern=r"^(accept|decline|info)$")
    user_notes: Optional[str] = Field(default=None, max_length=500)
