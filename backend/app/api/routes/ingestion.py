from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, File, Form, Header, UploadFile, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.config import Settings, get_settings
from app.db.session import get_db
from app.rag.ingestion.exceptions import IngestionAuthError
from app.rag.ingestion.service import IngestionResult, IngestionService
from app.rag.vector_store import VectorStore

router = APIRouter(prefix="/ingestion", tags=["Ingestion"])


class IngestionUploadResponse(BaseModel):
    """Response structure for document ingestion uploads."""

    source_id: str
    source_title: str
    filename: str
    doc_hash: str
    status: str
    chunks_created: int
    total_chunks: int
    embedding_model: str
    embedding_dim: int


class SourceDetailsResponse(BaseModel):
    """Metadata response for an indexed document source."""

    source_id: str
    source_title: str
    chunk_count: int
    embedding_model: str
    created_at: str
    updated_at: str


from app.api.dependencies import get_current_user_from_token
from app.models.user import User


def verify_ingestion_auth(
    x_ingestion_key: Optional[str] = Header(None, alias="X-Ingestion-Key"),
    user: Optional[User] = Depends(get_current_user_from_token),
    settings: Settings = Depends(get_settings),
) -> None:
    """
    Enforce authorization for document ingestion.
    Allows authenticated administrators, or callers providing valid X-Ingestion-Key.
    """
    if user and user.role == "admin":
        return

    if settings.INGESTION_API_KEY and settings.INGESTION_API_KEY.strip():
        if x_ingestion_key and x_ingestion_key.strip() == settings.INGESTION_API_KEY.strip():
            return
        raise IngestionAuthError("Invalid or missing X-Ingestion-Key header for ingestion.")


@router.post(
    "/upload",
    response_model=IngestionUploadResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload and ingest a verified knowledge document",
    dependencies=[Depends(verify_ingestion_auth)],
)
async def upload_document(
    file: UploadFile = File(..., description="Document file (.pdf, .docx, .txt, .md)"),
    source_id: Optional[str] = Form(None, description="Optional custom source identifier"),
    source_title: Optional[str] = Form(None, description="Optional document title"),
    source_url: Optional[str] = Form(None, description="Optional canonical reference URL"),
    settings: Settings = Depends(get_settings),
    db: Session = Depends(get_db),
) -> IngestionUploadResponse:
    """
    Upload and index a verified document into vector storage.
    Validates file size, file format, extracts text, handles hash idempotency,
    generates embeddings, and persists knowledge chunks.
    """
    file_bytes = await file.read()

    result: IngestionResult = await IngestionService.ingest_document(
        db=db,
        file_bytes=file_bytes,
        filename=file.filename or "uploaded_document.txt",
        source_id=source_id,
        source_title=source_title,
        source_url=source_url,
        settings=settings,
    )

    return IngestionUploadResponse(
        source_id=result.source_id,
        source_title=result.source_title,
        filename=result.filename,
        doc_hash=result.doc_hash,
        status=result.status,
        chunks_created=result.chunks_created,
        total_chunks=result.total_chunks,
        embedding_model=result.embedding_model,
        embedding_dim=result.embedding_dim,
    )


@router.get(
    "/sources/{source_id}",
    response_model=SourceDetailsResponse,
    summary="Retrieve indexing metadata for a source ID",
    dependencies=[Depends(verify_ingestion_auth)],
)
def get_source_details(
    source_id: str,
    db: Session = Depends(get_db),
) -> SourceDetailsResponse:
    """Inspect metadata and chunk count for a previously indexed source."""
    chunks = VectorStore.get_chunks_by_source(db=db, source_id=source_id)
    if not chunks:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail=f"Source ID '{source_id}' not found.")

    first = chunks[0]
    return SourceDetailsResponse(
        source_id=first.source_id,
        source_title=first.source_title,
        chunk_count=len(chunks),
        embedding_model=first.embedding_model,
        created_at=first.created_at.isoformat(),
        updated_at=first.updated_at.isoformat(),
    )


@router.delete(
    "/sources/{source_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete all knowledge chunks associated with a source ID",
    dependencies=[Depends(verify_ingestion_auth)],
)
def delete_source(
    source_id: str,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Purge an indexed document source from the knowledge store."""
    count = VectorStore.delete_chunks_by_source(db=db, source_id=source_id)
    return {"deleted_chunks": count, "source_id": source_id}
