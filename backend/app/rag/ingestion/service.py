import hashlib
import os
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.config import Settings, get_settings
from app.core.logging import get_logger
from app.rag.embeddings.factory import get_embedding_provider
from app.rag.ingestion.chunker import chunk_document_pages
from app.rag.ingestion.exceptions import FileTooLargeError
from app.rag.ingestion.extractors import extract_document, sanitize_filename
from app.rag.vector_store import VectorStore

logger = get_logger("ingestion")


class IngestionResult(BaseModel):
    """Result summary of a document ingestion run."""

    source_id: str
    source_title: str
    filename: str
    doc_hash: str
    status: str  # "created" | "updated" | "skipped_unchanged"
    chunks_created: int
    total_chunks: int
    embedding_model: str
    embedding_dim: int


def generate_source_id_from_filename(filename: str) -> str:
    """Generate a clean URL/identifier-safe source_id slug from a filename."""
    base, _ = os.path.splitext(filename)
    slug = re.sub(r"[^\w\s-]", "", base).strip().lower()
    slug = re.sub(r"[-\s]+", "_", slug)
    if not slug:
        slug = "doc"
    # Append short 6-char hash of original filename to avoid collisions
    suffix = hashlib.sha1(filename.encode("utf-8")).hexdigest()[:6]
    return f"{slug}_{suffix}"


class IngestionService:
    """Core service orchestrating document extraction, chunking, embedding, and storage."""

    @staticmethod
    async def ingest_document(
        db: Session,
        file_bytes: bytes,
        filename: str,
        source_id: Optional[str] = None,
        source_title: Optional[str] = None,
        source_url: Optional[str] = None,
        extra_metadata: Optional[Dict[str, Any]] = None,
        settings: Optional[Settings] = None,
    ) -> IngestionResult:
        """
        Ingest a document from raw bytes.
        Validates size, sanitizes filename, extracts text, checks content hash idempotency,
        splits into overlapping chunks, generates embeddings, and persists to pgvector.
        """
        cfg = settings or get_settings()

        # 1. Enforce file size limit
        file_size = len(file_bytes)
        if file_size > cfg.MAX_UPLOAD_SIZE_BYTES:
            raise FileTooLargeError(
                filename=filename,
                size_bytes=file_size,
                max_bytes=cfg.MAX_UPLOAD_SIZE_BYTES,
            )

        # 2. Sanitize filename
        safe_filename = sanitize_filename(filename)
        _, ext = os.path.splitext(safe_filename)

        # 3. Resolve identifiers
        eff_source_id = source_id.strip() if source_id and source_id.strip() else generate_source_id_from_filename(safe_filename)
        eff_source_title = source_title.strip() if source_title and source_title.strip() else os.path.splitext(safe_filename)[0].replace("_", " ").title()

        # 4. Compute full document SHA-256 hash
        doc_hash = hashlib.sha256(file_bytes).hexdigest()

        # 5. Extract text pages
        pages = extract_document(file_bytes=file_bytes, filename=safe_filename)

        # 6. Check existing chunks for idempotency / change detection
        existing_chunks = VectorStore.get_chunks_by_source(db=db, source_id=eff_source_id)

        if existing_chunks:
            # Check if doc_hash of existing chunks matches current document hash
            stored_doc_hash = existing_chunks[0].source_metadata.get("doc_hash")
            if stored_doc_hash == doc_hash:
                logger.info(
                    f"Document '{safe_filename}' (source_id={eff_source_id}) has not changed (hash={doc_hash[:8]}). "
                    f"Skipping ingestion (idempotent)."
                )
                return IngestionResult(
                    source_id=eff_source_id,
                    source_title=eff_source_title,
                    filename=safe_filename,
                    doc_hash=doc_hash,
                    status="skipped_unchanged",
                    chunks_created=0,
                    total_chunks=len(existing_chunks),
                    embedding_model=cfg.EMBEDDING_MODEL,
                    embedding_dim=cfg.EMBEDDING_DIM,
                )

            # Document has changed: purge old chunks to prevent stale remnants
            deleted_count = VectorStore.delete_chunks_by_source(db=db, source_id=eff_source_id)
            logger.info(
                f"Document '{safe_filename}' (source_id={eff_source_id}) was modified. "
                f"Purged {deleted_count} stale chunk(s)."
            )
            ingest_status = "updated"
        else:
            ingest_status = "created"

        # 7. Split into overlapping chunks
        chunks = chunk_document_pages(
            pages=pages,
            chunk_size=cfg.INGESTION_CHUNK_SIZE,
            chunk_overlap=cfg.INGESTION_CHUNK_OVERLAP,
        )

        if not chunks:
            # Fallback single chunk if split returned empty
            full_text = "\n\n".join(t for _, t in pages).strip()
            from app.rag.ingestion.chunker import IngestionChunk
            chunks = [
                IngestionChunk(
                    chunk_index=0,
                    chunk_text=full_text,
                    page_number=pages[0][0] if pages else 1,
                    char_start=0,
                    char_end=len(full_text),
                )
            ]

        # 8. Generate embeddings
        embedding_provider = get_embedding_provider(cfg)
        chunk_texts = [c.chunk_text for c in chunks]
        embeddings = await embedding_provider.embed_batch(chunk_texts)

        # 9. Persist chunks in vector store
        now_iso = datetime.now(timezone.utc).isoformat()
        for chunk, emb in zip(chunks, embeddings):
            chunk_meta: Dict[str, Any] = {
                "doc_hash": doc_hash,
                "file_name": safe_filename,
                "file_type": ext.lstrip(".").lower(),
                "file_size_bytes": file_size,
                "chunk_index": chunk.chunk_index,
                "total_chunks": len(chunks),
                "page_number": chunk.page_number,
                "char_start": chunk.char_start,
                "char_end": chunk.char_end,
                "ingested_at": now_iso,
            }
            if extra_metadata:
                chunk_meta.update(extra_metadata)

            VectorStore.store_chunk(
                db=db,
                chunk_text=chunk.chunk_text,
                source_id=eff_source_id,
                source_title=eff_source_title,
                source_url=source_url,
                embedding=emb,
                embedding_model=cfg.EMBEDDING_MODEL,
                embedding_dim=cfg.EMBEDDING_DIM,
                source_metadata=chunk_meta,
            )

        logger.info(
            f"Successfully ingested '{safe_filename}' (source_id={eff_source_id}): "
            f"{len(chunks)} chunks embedded and persisted (model={cfg.EMBEDDING_MODEL})."
        )

        return IngestionResult(
            source_id=eff_source_id,
            source_title=eff_source_title,
            filename=safe_filename,
            doc_hash=doc_hash,
            status=ingest_status,
            chunks_created=len(chunks),
            total_chunks=len(chunks),
            embedding_model=cfg.EMBEDDING_MODEL,
            embedding_dim=cfg.EMBEDDING_DIM,
        )
