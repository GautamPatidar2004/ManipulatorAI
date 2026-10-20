from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel, Field


class DatabaseHealth(BaseModel):
    connected: bool = Field(description="Flag indicating live PostgreSQL connectivity")
    error: Optional[str] = Field(default=None, description="Connection error snippet if unreachable")


class HealthResponse(BaseModel):
    status: str = Field(default="ok", description="Overall service status")
    app_name: str = Field(description="Name of the service")
    environment: str = Field(description="Current deployment environment")
    version: str = Field(description="Application semantic version")
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    ai_service_available: bool = Field(default=False, description="Flag indicating if real AI providers are online")
    database: DatabaseHealth = Field(description="PostgreSQL connectivity health status")
