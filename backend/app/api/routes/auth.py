from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.api.dependencies import require_authenticated_user
from app.api.schemas.auth import (
    TokenResponse,
    UserLoginRequest,
    UserProfileResponse,
    UserSignupRequest,
)
from app.core.security import create_access_token, hash_password, verify_password
from app.db.session import get_db
from app.models.user import User

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post(
    "/signup",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user account (role strictly defaulted to 'user')",
)
def signup(
    payload: UserSignupRequest,
    db: Session = Depends(get_db),
) -> TokenResponse:
    """
    Register a new parent or student account.
    Server-side invariant: Any account created through public signup is strictly assigned role='user'.
    """
    clean_email = payload.email.strip().lower()

    # Check for duplicate email
    existing_user = db.scalar(select(User).where(User.email == clean_email))
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email address already exists. Please sign in instead.",
        )

    hashed_pw = hash_password(payload.password)
    user = User(
        email=clean_email,
        hashed_password=hashed_pw,
        full_name=payload.full_name.strip(),
        role="user",  # Strict server-side assignment; no external payload can override this
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(
        subject=user.id,
        claims={"email": user.email, "role": user.role, "name": user.full_name},
    )

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserProfileResponse(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            role=user.role,
            is_active=user.is_active,
            created_at=user.created_at,
        ),
    )


@router.post(
    "/login",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
    summary="Authenticate with email and password",
)
def login(
    payload: UserLoginRequest,
    db: Session = Depends(get_db),
) -> TokenResponse:
    """Authenticate registered users and return a signed JWT token."""
    clean_email = payload.email.strip().lower()
    user = db.scalar(select(User).where(User.email == clean_email))

    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is currently deactivated. Please contact support.",
        )

    token = create_access_token(
        subject=user.id,
        claims={"email": user.email, "role": user.role, "name": user.full_name},
    )

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserProfileResponse(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            role=user.role,
            is_active=user.is_active,
            created_at=user.created_at,
        ),
    )


@router.get(
    "/me",
    response_model=UserProfileResponse,
    status_code=status.HTTP_200_OK,
    summary="Retrieve current authenticated user profile",
)
def get_me(
    user: User = Depends(require_authenticated_user),
) -> UserProfileResponse:
    """Return identity and role of current authenticated session."""
    return UserProfileResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        is_active=user.is_active,
        created_at=user.created_at,
    )


@router.post(
    "/logout",
    status_code=status.HTTP_200_OK,
    summary="Sign out current session",
)
def logout(
    _user: User = Depends(require_authenticated_user),
) -> dict:
    """Acknowledge session sign-out."""
    return {"message": "Session terminated successfully."}
