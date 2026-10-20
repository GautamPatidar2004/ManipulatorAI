from typing import List, Optional
from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.memory.schemas import (
    ExtractedMemoryFact,
    MemoryForgetResponse,
    UserMemoryCreateRequest,
    UserMemoryResponse,
    UserMemoryUpdateRequest,
)
from app.memory.service import MemoryService

router = APIRouter(prefix="/memory", tags=["memory"])


from app.api.dependencies import get_current_user_from_token
from app.models.user import User


def get_current_user_id(
    x_user_id: Optional[str] = Header(default="default_user"),
    user: Optional[User] = Depends(get_current_user_from_token),
) -> str:
    """Resolve current user identifier for multi-tenant isolation."""
    if user:
        return user.id
    return x_user_id or "default_user"


@router.get("", response_model=List[UserMemoryResponse], summary="List active conversational memories")
def list_user_memories(
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    """Retrieve all active persistent facts and preferences recorded for the user."""
    return MemoryService.list_active_memories(db=db, user_id=user_id)


@router.post("", response_model=UserMemoryResponse, status_code=status.HTTP_201_CREATED, summary="Create or declare a memory fact")
def create_memory_fact(
    payload: UserMemoryCreateRequest,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    """Explicitly declare or update a stable career context fact."""
    fact = ExtractedMemoryFact(
        key=payload.key,
        value=payload.value,
        category=payload.category,
        confidence=payload.confidence,
        is_correction=False,
    )
    saved = MemoryService.upsert_fact(db=db, user_id=user_id, fact=fact)
    return UserMemoryResponse(
        id=saved.id,
        user_id=saved.user_id,
        key=saved.key,
        value=saved.value,
        category=saved.category,
        source=saved.source,
        confidence=saved.confidence,
        version=saved.version,
        is_active=saved.is_active,
        source_conversation_id=saved.source_conversation_id,
        source_message_id=saved.source_message_id,
        created_at=saved.created_at,
        updated_at=saved.updated_at,
    )


@router.put("/{memory_id}", response_model=UserMemoryResponse, summary="Correct or update an existing memory fact")
def update_memory_fact(
    memory_id: str,
    payload: UserMemoryUpdateRequest,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    """Update or correct a previously saved memory fact, enforcing ownership."""
    updated = MemoryService.update_memory(
        db=db,
        user_id=user_id,
        memory_id=memory_id,
        new_value=payload.value,
        new_category=payload.category,
    )
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Memory record '{memory_id}' not found for user.",
        )
    return updated


@router.delete("/{memory_id}", status_code=status.HTTP_200_OK, summary="Forget a specific memory fact")
def delete_memory_fact(
    memory_id: str,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    """Forget/deactivate a specific memory fact."""
    success = MemoryService.delete_memory(db=db, user_id=user_id, memory_id=memory_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Memory record '{memory_id}' not found or already deleted.",
        )
    return {"message": "Memory fact successfully forgotten.", "memory_id": memory_id}


@router.delete("", response_model=MemoryForgetResponse, summary="Forget all memory facts (Right to be forgotten)")
def forget_all_memories(
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    """Forget all persistent profile facts and career preferences for the user."""
    count = MemoryService.forget_all(db=db, user_id=user_id)
    return MemoryForgetResponse(
        forgotten_count=count,
        message=f"Successfully cleared {count} remembered profile facts.",
        user_id=user_id,
    )
