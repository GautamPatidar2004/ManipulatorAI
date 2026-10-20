import hashlib
import math
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.models.knowledge import KnowledgeChunk
from app.rag.exceptions import IncompatibleEmbeddingDimensionError


def cosine_similarity(v1: List[float], v2: List[float]) -> float:
    """Compute cosine similarity between two float vectors."""
    dot = sum(a * b for a, b in zip(v1, v2))
    norm1 = math.sqrt(sum(a * a for a in v1))
    norm2 = math.sqrt(sum(b * b for b in v2))
    if norm1 == 0 or norm2 == 0:
        return 0.0
    return dot / (norm1 * norm2)


class VectorStore:
    """Repository service managing persistence and cosine similarity retrieval of knowledge vectors."""

    @staticmethod
    def store_chunk(
        db: Session,
        chunk_text: str,
        source_id: str,
        source_title: str,
        embedding: List[float],
        embedding_model: str,
        embedding_dim: int,
        source_metadata: Optional[Dict[str, Any]] = None,
        source_url: Optional[str] = None,
    ) -> KnowledgeChunk:
        """
        Store or update an embedded knowledge chunk.
        Validates embedding dimensions and enforces deduplication via content hash.
        """
        if len(embedding) != embedding_dim:
            raise IncompatibleEmbeddingDimensionError(
                expected_dim=embedding_dim,
                actual_dim=len(embedding),
                model=embedding_model,
            )

        content_hash = hashlib.sha256(chunk_text.encode("utf-8")).hexdigest()
        metadata = source_metadata or {}
        now = datetime.now(timezone.utc)

        # Check existing chunk for idempotent update
        stmt = select(KnowledgeChunk).where(
            KnowledgeChunk.source_id == source_id,
            KnowledgeChunk.content_hash == content_hash,
        )
        existing = db.scalars(stmt).first()

        if existing:
            existing.chunk_text = chunk_text
            existing.source_title = source_title
            existing.source_url = source_url
            existing.source_metadata = metadata
            existing.embedding = embedding
            existing.embedding_model = embedding_model
            existing.embedding_dim = embedding_dim
            existing.updated_at = now
            db.commit()
            db.refresh(existing)
            return existing

        chunk = KnowledgeChunk(
            source_id=source_id,
            source_title=source_title,
            source_url=source_url,
            source_metadata=metadata,
            chunk_text=chunk_text,
            content_hash=content_hash,
            embedding=embedding,
            embedding_model=embedding_model,
            embedding_dim=embedding_dim,
            created_at=now,
            updated_at=now,
        )
        db.add(chunk)
        db.commit()
        db.refresh(chunk)
        return chunk

    @staticmethod
    def search_similar_chunks(
        db: Session,
        query_vector: List[float],
        embedding_model: str,
        embedding_dim: int,
        limit: int = 5,
        score_threshold: float = 0.0,
        metadata_filter: Optional[Dict[str, Any]] = None,
    ) -> List[Tuple[KnowledgeChunk, float]]:
        """
        Retrieve chunks matching the query vector by cosine similarity.
        Restricts candidate search strictly to chunks sharing the same embedding_model
        and embedding_dim to avoid mixing incompatible models in vector space.
        """
        if len(query_vector) != embedding_dim:
            raise IncompatibleEmbeddingDimensionError(
                expected_dim=embedding_dim,
                actual_dim=len(query_vector),
                model=embedding_model,
            )

        # Restrict strictly to matching model and dimension
        stmt = select(KnowledgeChunk).where(
            KnowledgeChunk.embedding_model == embedding_model,
            KnowledgeChunk.embedding_dim == embedding_dim,
        )

        all_candidates = list(db.scalars(stmt).all())

        results: List[Tuple[KnowledgeChunk, float]] = []
        for chunk in all_candidates:
            # Metadata filter check (if requested)
            if metadata_filter:
                match = True
                for k, v in metadata_filter.items():
                    if chunk.source_metadata.get(k) != v:
                        match = False
                        break
                if not match:
                    continue

            # Compute cosine similarity
            # chunk.embedding can be a list or numpy/pgvector array
            chunk_vec = list(chunk.embedding)
            sim = cosine_similarity(query_vector, chunk_vec)

            if sim >= score_threshold:
                results.append((chunk, sim))

        # Sort by similarity score descending
        results.sort(key=lambda x: x[1], reverse=True)
        return results[:limit]

    @staticmethod
    def get_chunks_by_source(db: Session, source_id: str) -> List[KnowledgeChunk]:
        """Retrieve all knowledge chunks associated with a specific source ID."""
        stmt = select(KnowledgeChunk).where(KnowledgeChunk.source_id == source_id).order_by(KnowledgeChunk.created_at.asc())
        return list(db.scalars(stmt).all())

    @staticmethod
    def delete_chunks_by_source(db: Session, source_id: str) -> int:
        """
        Delete all existing chunks for a given source ID.
        Used to cleanly supersede outdated documents without leaving stale chunks.
        Returns the count of deleted chunks.
        """
        from sqlalchemy import delete
        stmt = delete(KnowledgeChunk).where(KnowledgeChunk.source_id == source_id)
        result = db.execute(stmt)
        db.commit()
        return result.rowcount or 0
