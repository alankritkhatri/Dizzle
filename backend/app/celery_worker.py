from celery import Celery
from app.config import settings
import ssl


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

# Upstash/Redis over TLS: disable cert validation if using rediss and no CA provided
try:
    if (broker_url and broker_url.startswith("rediss://")):
        celery_app.conf.broker_use_ssl = {"ssl_cert_reqs": ssl.CERT_NONE}
    if (result_backend and result_backend.startswith("rediss://")):
        celery_app.conf.redis_backend_use_ssl = {"ssl_cert_reqs": ssl.CERT_NONE}
except Exception:
    pass

# Reasonable defaults
celery_app.conf.broker_transport_options = {"visibility_timeout": 3600}
celery_app.conf.worker_prefetch_multiplier = 1

celery_app.autodiscover_tasks(["app.tasks"])

