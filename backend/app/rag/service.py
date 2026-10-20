from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session
from app.config import Settings, get_settings
from app.rag.embeddings.factory import get_embedding_provider
from app.rag.types import RAGChunkResult, RAGRetrievalResult
from app.rag.vector_store import VectorStore


class RAGService:
    """Service orchestrating query embedding, similarity retrieval, and evidence formatting."""

    @staticmethod
    async def retrieve(
        db: Session,
        query: str,
        limit: Optional[int] = None,
        min_score: Optional[float] = None,
        metadata_filter: Optional[Dict[str, Any]] = None,
        settings: Optional[Settings] = None,
    ) -> RAGRetrievalResult:
        """
        Embed user query, retrieve relevant knowledge chunks, and assemble evidence context.
        """
        cfg = settings or get_settings()
        top_k = limit or cfg.RAG_TOP_K
        threshold = min_score if min_score is not None else cfg.RAG_MIN_SIMILARITY

        embedding_provider = get_embedding_provider(cfg)
        query_vector = await embedding_provider.embed_text(query)

        matched_tuples = VectorStore.search_similar_chunks(
            db=db,
            query_vector=query_vector,
            embedding_model=embedding_provider.model_name,
            embedding_dim=embedding_provider.dimension,
            limit=top_k,
            score_threshold=threshold,
            metadata_filter=metadata_filter,
        )

        chunk_results: List[RAGChunkResult] = []
        evidence_lines: List[str] = []
        sources: List[Dict[str, Any]] = []

        for chunk, score in matched_tuples:
            chunk_res = RAGChunkResult(
                chunk_id=chunk.id,
                source_id=chunk.source_id,
                source_title=chunk.source_title,
                source_url=chunk.source_url,
                source_metadata=chunk.source_metadata,
                text=chunk.chunk_text,
                score=round(score, 4),
            )
            chunk_results.append(chunk_res)

            evidence_lines.append(
                f"[Source: {chunk.source_title} (ID: {chunk.source_id}, Match: {score:.2f})]\n"
                f"{chunk.chunk_text}\n"
            )

            sources.append({
                "title": chunk.source_title,
                "source_id": chunk.source_id,
                "url": chunk.source_url,
                "similarity_score": round(score, 4),
            })

        has_evidence = len(chunk_results) > 0
        evidence_text = "\n---\n".join(evidence_lines) if has_evidence else ""

        return RAGRetrievalResult(
            query=query,
            chunks=chunk_results,
            has_sufficient_evidence=has_evidence,
            evidence_text=evidence_text,
            sources=sources,
        )
