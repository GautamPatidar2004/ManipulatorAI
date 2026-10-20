from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, field_validator

EMAIL_REGEX = r"^[^@\s]+@[^@\s]+\.[^@\s]+$"


class UserSignupRequest(BaseModel):
    """Payload for user registration. Role is strictly assigned server-side as 'user'."""

    email: str = Field(..., pattern=EMAIL_REGEX, description="User email address")
    password: str = Field(..., min_length=8, max_length=128, description="Password (min 8 chars)")
    full_name: str = Field(..., min_length=2, max_length=128, description="Full name or display name")

    @field_validator("email")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        return v.strip().lower()

    @field_validator("password")
    @classmethod
    def validate_password_complexity(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters long.")
        return v


class UserLoginRequest(BaseModel):
    """Payload for user login."""

    email: str = Field(..., pattern=EMAIL_REGEX, description="Registered email address")
    password: str = Field(..., min_length=1, description="Account password")

    @field_validator("email")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        return v.strip().lower()


class UserProfileResponse(BaseModel):
    """Public user profile response."""

    id: str
    email: str
    full_name: str
    role: str  # 'admin' or 'user'
    is_active: bool
    created_at: datetime


class TokenResponse(BaseModel):
    """Access token payload returned on successful authentication."""

    access_token: str
    token_type: str = "bearer"
    user: UserProfileResponse


class AdminUserListResponse(BaseModel):
    """Admin-only listing of registered accounts."""

    users: list[UserProfileResponse]
    total: int
