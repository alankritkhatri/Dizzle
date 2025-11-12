from celery import Celery
from app.config import settings


celery_app = Celery(
    "worker",
    broker = settings.CELERY_BROKER_URL,
    backend = settings.CELERY_RESULT_BACKEND
)

celery_app.conf.task_serializer = "json"
celery_app.conf.result_serializer = "json"
celery_app.conf.accept_content = ["json"]
celery_app.conf.task_tracking_started = True

celery_app.autodiscover_tasks(["app.tasks"])

