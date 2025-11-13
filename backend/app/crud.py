from sqlalchemy.orm import Session
from . import models
from datetime import datetime

def create_import_job(db: Session, original_filename: str | None = None, file_path: str | None = None):
    job = models.ImportJob(status="queued", original_filename=original_filename, file_path=file_path)
    db.add(job)
    db.commit()
    db.refresh(job)
    return job

def update_job_progress(db: Session, job_id: int, processed: int, total: int = None, status: str = None, error: str = None, file_path: str | None = None):
    job = db.get(models.ImportJob, job_id)
    if not job:
        return None
    if total is not None:
        job.total_rows = total
    job.processed_rows = processed
    if status:
        job.status = status
    if error:
        job.error = error
    if file_path is not None:
        job.file_path = file_path
    job.updated_at = datetime.utcnow()
    db.add(job); db.commit(); db.refresh(job)
    return job
