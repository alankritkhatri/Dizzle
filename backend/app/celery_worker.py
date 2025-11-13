from celery import Celery
from app.config import settings


# Fallback to REDIS_URL if explicit Celery URLs are not provided
broker_url = settings.CELERY_BROKER_URL or settings.REDIS_URL
result_backend = settings.CELERY_RESULT_BACKEND or settings.REDIS_URL

celery_app = Celery(
    "worker",
    broker=broker_url,
    backend=result_backend,
)

celery_app.conf.task_serializer = "json"
celery_app.conf.result_serializer = "json"
celery_app.conf.accept_content = ["json"]
celery_app.conf.task_tracking_started = True

celery_app.autodiscover_tasks(["app.tasks"])

