import os
from pydantic import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@db:5432/postgres")
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://redis:6379/0")
    CELERY_BROKER_URL: str = REDIS_URL
    CELERY_RESULT_BACKEND: str = REDIS_URL
    SECRET_KEY: str = os.getenv("SECRET_KEY", "dev-secret")
    MAX_UPLOAD_BYTES: int = 5 * 1024 * 1024 * 1024  # 5GB, configurable
    CSV_BATCH_SIZE: int = int(os.getenv("CSV_BATCH_SIZE", "5000"))  # tuneable

    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()
