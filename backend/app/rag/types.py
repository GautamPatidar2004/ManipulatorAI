from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class RAGChunkResult(BaseModel):
    """Result item representing a single matched knowledge passage."""
    chunk_id: str
    source_id: str
    source_title: str
    source_url: Optional[str] = None
    source_metadata: Dict[str, Any] = Field(default_factory=dict)
    text: str
    score: float = Field(..., ge=-1.0, le=1.0, description="Cosine similarity score")


class RAGRetrievalResult(BaseModel):
    """Aggregated retrieval outcome for a user query."""
    query: str
    chunks: List[RAGChunkResult] = Field(default_factory=list)
    has_sufficient_evidence: bool = Field(
        default=False,
        description="True if at least one retrieved chunk satisfies the minimum similarity threshold"
    )
    evidence_text: str = Field(
        default="",
        description="Formatted context passages labeled with source attribution for model injection"
    )
    sources: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="Clean list of source citations for UI display"
    )
