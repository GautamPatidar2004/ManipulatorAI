import re
from typing import List, Tuple
from app.counselling.types import (
    CounsellingIntent,
    CounsellingSignals,
    DetectedLanguage,
)


# Common Hinglish lexical markers (Roman script)
HINGLISH_KEYWORDS = {
    "kya", "kaise", "karu", "karna", "hai", "mujhe", "batao", "bhai",
    "padhai", "milegi", "darr", "lag", "raha", "rahi", "samajh", "nahi",
    "aa", "hoga", "hogi", "scope", "kisme", "achha", "accha", "ghar",
    "wale", "papa", "mummy", "paisa", "kamana", "kaunsa", "konsa", "chahiye",
    "bataiye", "seekhna", "college", "baad", "pehle", "hona", "wala"
}

# Unrealistic expectation markers (quick riches, impossible timelines)
UNREALISTIC_PATTERNS = [
    (r"(\d+\s*(lpa|crore|lakh)).{0,30}(1|2|3|4|few)\s*(month|week|day)", "High salary expectations within unrealistically short training duration."),
    (r"(zero|no|bina)\s*(coding|math|study|effort|knowledge).{0,30}(faang|google|top\s*tier|highest\s*paying)", "Expectation of elite tier placement without requisite technical/academic foundations."),
    (r"(guarantee|pakka)\s*(placement|job|crore)", "Assumption of guaranteed employment without market risk or evaluation."),
]

# Conflicting goal patterns
CONFLICTING_PATTERNS = [
    (r"(government|govt|upsc|sarkari).{0,100}(startup|equity|unicorn)", "Desire for extreme civil-service job security paired with high-risk startup volatility."),
    (r"(zero\s*stress|chill|relaxed|work\s*life\s*balance).{0,100}(investment\s*banking|hft|top\s*consulting|startup|unicorn)", "Desire for low-stress work-life balance paired with traditionally intense or volatile tracks."),
]

# High uncertainty / anxiety markers
UNCERTAINTY_PATTERNS = [
    r"\b(confused|lost|darr|scared|hopeless|tension|pressure|anxious|blank|directionless)\b",
    r"(samajh\s*nahi\s*aa\s*raha)",
    r"(kuch\s*samajh\s*nahi)",
    r"(parents\s*(forcing|insisting|pressure))",
]


class CounsellingQueryAnalyzer:
    """Analyzes student input for language, intent, emotional uncertainty, and cognitive signals."""

    @staticmethod
    def detect_language(text: str) -> DetectedLanguage:
        """Detect language: Devanagari Hindi, Romanized Hinglish, or English."""
        # Check Devanagari unicode range (0900-097F)
        devanagari_chars = len(re.findall(r"[\u0900-\u097f]", text))
        if devanagari_chars > 3:
            return DetectedLanguage.HINDI

        # Tokenize and match against Hinglish lexicon
        words = re.findall(r"[a-zA-Z]+", text.lower())
        if words:
            hinglish_match_count = sum(1 for w in words if w in HINGLISH_KEYWORDS)
            ratio = hinglish_match_count / len(words)
            if hinglish_match_count >= 2 or (len(words) <= 4 and hinglish_match_count >= 1):
                return DetectedLanguage.HINGLISH
            if ratio > 0.15:
                return DetectedLanguage.HINGLISH

        return DetectedLanguage.ENGLISH

    @staticmethod
    def classify_intent(query: str, history_summary: str = "") -> CounsellingIntent:
        """Determine primary student counselling intent."""
        clean = query.lower()

        # 1. Comparison Intent
        if any(marker in clean for marker in [" vs ", " versus ", "ya fir", "or should i", "which is better", "kaunsa better", "compare"]):
            return CounsellingIntent.CAREER_COMPARISON

        # 2. Parent / Family Dialogue
        if any(marker in clean for marker in ["parent", "papa", "mummy", "family", "ghar wale", "convince", "relative"]):
            return CounsellingIntent.PARENT_STUDENT_DIALOGUE

        # 3. Roadmap & Planning
        if any(marker in clean for marker in ["roadmap", "study plan", "learning path", "schedule", "step by step", "months plan", "syllabus"]):
            return CounsellingIntent.ROADMAP_PLANNING

        # 4. Exam & Credentials
        if any(marker in clean for marker in ["exam", "gate", "cat", "jee", "neet", "upsc", "certification", "degree worth", "cutoff"]):
            return CounsellingIntent.EXAM_AND_CREDENTIALS

        # 5. Pathway & Prerequisites
        if any(marker in clean for marker in ["how to become", "kaise banu", "steps to", "eligibility", "prerequisite", "skill gap"]):
            return CounsellingIntent.PATHWAY_EXPLORATION

        # 6. Discovery
        if any(marker in clean for marker in ["interest", "strength", "skill", "confused about career", "suggest career", "kya choose karu", "options", "suit me", "career path"]):
            return CounsellingIntent.CAREER_DISCOVERY

        return CounsellingIntent.GENERAL_GUIDANCE

    @staticmethod
    def extract_signals(query: str, history_count: int = 0) -> CounsellingSignals:
        """Extract psychological, expectation, and contextual signals."""
        clean = query.lower()
        language = CounsellingQueryAnalyzer.detect_language(query)
        intent = CounsellingQueryAnalyzer.classify_intent(query)

        # 1. Detect unrealistic expectations
        has_unrealistic = False
        unrealistic_details = None
        for pattern, desc in UNREALISTIC_PATTERNS:
            if re.search(pattern, clean):
                has_unrealistic = True
                unrealistic_details = desc
                break

        # 2. Detect conflicting goals
        has_conflicting = False
        conflicting_details = None
        for pattern, desc in CONFLICTING_PATTERNS:
            if re.search(pattern, clean):
                has_conflicting = True
                conflicting_details = desc
                break

        # 3. Detect high uncertainty or anxiety
        has_uncertainty = any(re.search(pat, clean) for pat in UNCERTAINTY_PATTERNS)

        # 4. Determine if missing context materially halts direct recommendation
        # If the student message is extremely sparse (e.g. < 4 words: "suggest me career")
        # and there is zero conversation history, critical clarification is needed.
        words = clean.split()
        needs_clarification = False
        stated_assumptions: List[str] = []

        if len(words) < 5 and history_count == 0 and intent == CounsellingIntent.CAREER_DISCOVERY:
            needs_clarification = True
        else:
            # We can provide a direct structured answer while stating reasonable assumptions
            if "college" not in clean and "degree" not in clean:
                stated_assumptions.append("Assuming undergraduate/early-career student perspective.")
            if "budget" not in clean and "money" not in clean:
                stated_assumptions.append("Focusing on accessible, merit- and skill-based educational pathways.")

        return CounsellingSignals(
            intent=intent,
            language=language,
            has_unrealistic_expectations=has_unrealistic,
            has_conflicting_goals=has_conflicting,
            has_high_uncertainty=has_uncertainty,
            needs_critical_clarification=needs_clarification,
            unrealistic_expectation_details=unrealistic_details,
            conflicting_goal_details=conflicting_details,
            stated_assumptions=stated_assumptions,
        )
