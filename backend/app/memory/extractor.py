import re
from typing import List, Optional
from app.memory.schemas import ExtractedMemoryFact

# Patterns for sensitive data that MUST NEVER be stored in memory
SENSITIVE_PATTERNS = [
    re.compile(r"(?:api[_-]?key|secret|token|password|passwd|auth)\s*[:=is ]+\S+", re.IGNORECASE),
    re.compile(r"\b\d{4}[ -]?\d{4}[ -]?\d{4}[ -]?\d{4}\b"),  # Credit card numbers
    re.compile(r"\b(?:\+?\d{1,3}[ -]?)?\d{10,12}\b"),  # Phone / Aadhaar numbers
    re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b"),  # Email
]

# Patterns for transient conversational noise
TRANSIENT_PATTERNS = [
    re.compile(r"^(?:hi|hello|hey|bhai|sir|mam|thanks|thank you|ok|okay|cool|nice|good morning|bye|acha|thik hai)\b", re.IGNORECASE),
]

# Prompt injection filters
INJECTION_KEYWORDS = [
    "ignore previous instructions",
    "system prompt",
    "system override",
    "you are now dan",
    "you are now a pirate",
    "forget all rules",
    "developer mode",
    "jailbreak",
]


class MemoryExtractor:
    """
    Intelligent extraction service that identifies stable, verified career context facts
    and explicit corrections while rejecting transient noise, secrets, and injections.
    """

    @classmethod
    def is_explicit_correction(cls, text: str) -> bool:
        """Detect whether the user is explicitly correcting prior information."""
        lower = text.lower()
        return bool(
            re.search(
                r"\b(?:actually|correction|correct that|no that is wrong|changed my mind|not\s+\w+,\s+i want|instead of|rather than)\b",
                lower,
            )
        )

    @classmethod
    def extract_facts_from_turn(
        cls,
        user_message: str,
        dialogue_context: Optional[str] = None,
    ) -> List[ExtractedMemoryFact]:
        """
        Extract structured user facts from the current turn.
        """
        clean_text = user_message.strip()
        if len(clean_text) < 5:
            return []

        # 1. Reject if sensitive secrets or prompt injection patterns detected
        for pattern in SENSITIVE_PATTERNS:
            if pattern.search(clean_text):
                return []

        lower_text = clean_text.lower()
        for inj in INJECTION_KEYWORDS:
            if inj in lower_text:
                return []

        # 2. Check if text is just transient conversational greeting
        for trans in TRANSIENT_PATTERNS:
            if trans.match(clean_text) and len(clean_text.split()) <= 4:
                return []

        facts: List[ExtractedMemoryFact] = []

        # 3. Detect Explicit Corrections First
        is_corr = cls.is_explicit_correction(clean_text)

        # A. Education Level Detection
        edu_match = re.search(
            r"\b(?:i am in|i'm in|currently in|completed|studying in|passed|done with|background is)\s+([1-9]{1,2}(?:th)?(?:\s+standard)?\s*(?:pcm|pcb|commerce|arts|science)?(?:\s+with\s+[a-zA-Z\s]+)?|b\.?tech|bca|mca|b\.?sc|m\.?sc|b\.?com|bba|diploma|engineering)\b",
            lower_text,
        )
        if edu_match:
            edu_val = edu_match.group(1).upper()
            facts.append(
                ExtractedMemoryFact(
                    key="education_level",
                    value=edu_val,
                    category="education",
                    confidence=0.95,
                    is_correction=is_corr,
                )
            )
        elif re.search(r"\b12th\s+(pcm|pcb|commerce|arts)\b", lower_text):
            stream = re.search(r"\b12th\s+(pcm|pcb|commerce|arts)\b", lower_text).group(0).upper()
            facts.append(
                ExtractedMemoryFact(
                    key="education_level",
                    value=stream,
                    category="education",
                    confidence=0.92,
                    is_correction=is_corr,
                )
            )

        # B. Target Role & Career Goals Detection
        role_match = re.search(
            r"\b(?:i want to become|aiming for|target role is|dream is to be|career in|aspire to be|goal is|interested in becoming)\s+([a-zA-Z\s]{3,35}?)(?=[.,\n]|$|and|with)",
            lower_text,
        )
        if role_match:
            role_val = role_match.group(1).strip().title()
            if len(role_val) > 2 and role_val.lower() not in ("a", "an", "the", "something"):
                facts.append(
                    ExtractedMemoryFact(
                        key="target_role",
                        value=role_val,
                        category="career_goals",
                        confidence=0.90,
                        is_correction=is_corr,
                    )
                )

        # C. Skills Detection
        skills_match = re.search(
            r"\b(?:i know|skilled in|experience with|proficient in|learned|hands-on with)\s+([a-zA-Z0-9,\s\+/]{3,60}?)(?=[.,\n]|$|and i)",
            lower_text,
        )
        if skills_match:
            skills_val = skills_match.group(1).strip()
            if len(skills_val) > 2 and skills_val.lower() not in ("nothing", "everything", "some"):
                facts.append(
                    ExtractedMemoryFact(
                        key="technical_skills",
                        value=skills_val,
                        category="skills",
                        confidence=0.88,
                        is_correction=is_corr,
                    )
                )

        # D. Constraints Detection (Budget, Location, Timeline)
        budget_match = re.search(
            r"\b(?:budget|fees?|cost|afford|financial limit)\b.*?\b([0-9]+(?:\.[0-9]+)?\s*(?:lakhs?|lpa|k|cr|inr|rupees)?)\b",
            lower_text,
        )
        if budget_match:
            budget_val = budget_match.group(1).strip()
            facts.append(
                ExtractedMemoryFact(
                    key="financial_budget_constraint",
                    value=f"Maximum {budget_val}",
                    category="constraints",
                    confidence=0.92,
                    is_correction=is_corr,
                )
            )

        location_match = re.search(
            r"\b(?:cannot relocate from|cannot relocate|prefer|only in|based in|relocate to|location preference)\s*(?:is|from|only)?\s*([a-zA-Z\s]{3,25}?)(?=[.,\n]|$)",
            lower_text,
        )
        if location_match:
            loc_val = location_match.group(1).strip().title()
            facts.append(
                ExtractedMemoryFact(
                    key="location_constraint",
                    value=loc_val,
                    category="constraints",
                    confidence=0.85,
                    is_correction=is_corr,
                )
            )

        # E. Interests Detection
        interest_match = re.search(
            r"\b(?:passionate about|deep interest in|love working with|fascinated by)\s+([a-zA-Z\s]{3,40}?)(?=[.,\n]|$)",
            lower_text,
        )
        if interest_match:
            interest_val = interest_match.group(1).strip().title()
            facts.append(
                ExtractedMemoryFact(
                    key="core_interest",
                    value=interest_val,
                    category="interests",
                    confidence=0.85,
                    is_correction=is_corr,
                )
            )

        return facts
