from functools import lru_cache
from typing import List, Optional
from pathlib import Path
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_BACKEND_DIR = Path(__file__).resolve().parent.parent
_ENV_PATH = _BACKEND_DIR / ".env"

DEFAULT_SYSTEM_PROMPT = (
    "You are CareerCompass AI, an empathetic, concise, and structured career counsellor. "
    "Provide short replies (2 to 4 short sentences, roughly 40-70 words maximum). For simple questions, answer in 1-3 sentences. "
    "Avoid long introductions and essay-style walls of text; practical breakdowns are rendered visually as interactive UI blocks."
)


class Settings(BaseSettings):
    """Application settings and environment configuration."""

    model_config = SettingsConfigDict(
        env_file=(_ENV_PATH, ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    APP_NAME: str = "CareerCompass AI Backend"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    PORT: int = 8000
    HOST: str = "0.0.0.0"

    # CORS origins as comma-separated string or list
    CORS_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173"

    # Database Configuration (PostgreSQL)
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "postgres"
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_DB: str = "careercompass"
    DATABASE_URL: Optional[str] = None

    # Database Connection Pool Settings
    DB_POOL_SIZE: int = 10
    DB_MAX_OVERFLOW: int = 20
    DB_POOL_TIMEOUT: int = 30

    # Multi-Provider AI Configuration
    # Supported values: "none", "gemini", "groq", "openai"
    AI_PROVIDER: str = "none"
    AI_TIMEOUT_SECONDS: float = 30.0
    AI_SYSTEM_PROMPT: str = DEFAULT_SYSTEM_PROMPT

    # Google Gemini
    GEMINI_API_KEY: Optional[str] = None
    GEMINI_MODEL: str = "gemini-1.5-flash"

    # Groq
    GROQ_API_KEY: Optional[str] = None
    GROQ_MODEL: str = "llama-3.3-70b-versatile"

    # OpenAI
    OPENAI_API_KEY: Optional[str] = None
    OPENAI_MODEL: str = "gpt-4o-mini"

    # Embeddings and RAG Configuration
    # Supported values: "mock", "gemini", "openai"
    EMBEDDING_PROVIDER: str = "mock"
    EMBEDDING_MODEL: str = "career-embed-384"
    EMBEDDING_DIM: int = 384
    RAG_ENABLED: bool = True
    RAG_TOP_K: int = 3
    RAG_MIN_SIMILARITY: float = 0.65

    # Knowledge Ingestion Pipeline Configuration
    MAX_UPLOAD_SIZE_BYTES: int = 10 * 1024 * 1024  # 10 MB limit
    INGESTION_CHUNK_SIZE: int = 800                 # Characters per chunk
    INGESTION_CHUNK_OVERLAP: int = 150              # Overlap characters
    INGESTION_API_KEY: Optional[str] = None         # Secret key for authorized ingestion endpoint

    # Human Counsellor Escalation & Handoff Configuration (Prompt 11)
    HUMAN_COUNSELLOR_SERVICE_URL: Optional[str] = None
    HUMAN_COUNSELLOR_EMAIL: Optional[str] = None
    HUMAN_COUNSELLOR_AUTO_ESCALATE: bool = True

    # Authentication & JWT Configuration
    JWT_SECRET_KEY: str = "careercompass-super-secret-jwt-key-2026-production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    FIRST_ADMIN_EMAIL: Optional[str] = None
    FIRST_ADMIN_PASSWORD: Optional[str] = None
    FIRST_ADMIN_NAME: str = "System Admin"

    # Legacy/explicit flag override (if False, AI stays disabled even if provider key is set)
    AI_SERVICE_ENABLED: Optional[bool] = None

    @field_validator("POSTGRES_PORT", "PORT")
    @classmethod
    def validate_port(cls, v: int) -> int:
        if v < 1 or v > 65535:
            raise ValueError("Port must be between 1 and 65535")
        return v

    @field_validator("AI_PROVIDER")
    @classmethod
    def validate_ai_provider(cls, v: str) -> str:
        clean = v.strip().lower()
        allowed = {"none", "gemini", "groq", "openai"}
        if clean not in allowed:
            raise ValueError(f"AI_PROVIDER must be one of {allowed}, got '{v}'")
        return clean

    @field_validator("EMBEDDING_PROVIDER")
    @classmethod
    def validate_embedding_provider(cls, v: str) -> str:
        clean = v.strip().lower()
        allowed = {"mock", "gemini", "openai"}
        if clean not in allowed:
            raise ValueError(f"EMBEDDING_PROVIDER must be one of {allowed}, got '{v}'")
        return clean

    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    @property
    def sqlalchemy_database_uri(self) -> str:
        """Return explicit DATABASE_URL if configured, otherwise synthesize PostgreSQL URI."""
        if self.DATABASE_URL:
            if self.DATABASE_URL.startswith("postgres://"):
                return self.DATABASE_URL.replace("postgres://", "postgresql+psycopg2://", 1)
            if self.DATABASE_URL.startswith("postgresql://"):
                return self.DATABASE_URL.replace("postgresql://", "postgresql+psycopg2://", 1)
            return self.DATABASE_URL

        return (
            f"postgresql+psycopg2://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@"
            f"{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    @property
    def is_ai_configured(self) -> bool:
        """Check whether the active AI provider is properly configured with an API key."""
        if self.AI_SERVICE_ENABLED is False:
            return False

        provider = self.AI_PROVIDER.lower()
        if provider == "gemini":
            return bool(self.GEMINI_API_KEY and self.GEMINI_API_KEY.strip())
        elif provider == "groq":
            return bool(self.GROQ_API_KEY and self.GROQ_API_KEY.strip())
        elif provider == "openai":
            return bool(self.OPENAI_API_KEY and self.OPENAI_API_KEY.strip())
        return False

    @property
    def active_model_name(self) -> str:
        """Return the active model name based on selected provider."""
        provider = self.AI_PROVIDER.lower()
        if provider == "gemini":
            return self.GEMINI_MODEL
        elif provider == "groq":
            return self.GROQ_MODEL
        elif provider == "openai":
            return self.OPENAI_MODEL
        return "none"


@lru_cache
def get_settings() -> Settings:
    """Return cached application settings."""
    return Settings()
