from pydantic_settings import BaseSettings
from pydantic import Field
from pathlib import Path

class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://postgres:postgres@db:5432/postgres"

    # Upstash Redis REST API credentials (for pub/sub messaging)
    UPSTASH_REDIS_REST_URL: str = ""
    UPSTASH_REDIS_REST_TOKEN: str = ""

    # Upstash Redis URL (redis:// protocol for Celery)
    # Format: redis://default:<password>@<host>:<port>
    # You can find this in your Upstash console under "Redis Connect" > "redis-cli"
    REDIS_URL: str = "redis://redis:6379/0"
    CELERY_BROKER_URL: str = ""
    CELERY_RESULT_BACKEND: str = ""

    SECRET_KEY: str = "dev-secret"
    MAX_UPLOAD_BYTES: int = 5 * 1024 * 1024 * 1024  # 5GB, configurable
    CSV_BATCH_SIZE: int = 5000  # tuneable
    WEBHOOK_TIMEOUT_SECONDS: int = 5
    WEBHOOK_MAX_RETRIES: int = 6
    WEBHOOK_SECRET: str = ""  # if set, we sign payloads with HMAC-SHA256

    class Config:
        # Load env from backend/.env regardless of current working directory
        env_file = str((Path(__file__).resolve().parents[1] / ".env").resolve())
        case_sensitive = False
        extra = "ignore"


settings = Settings()
