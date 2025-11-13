from fastapi import FastAPI, UploadFile, File, WebSocket, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from .database import SessionLocal, engine
from sqlalchemy import text
from . import models, crud, tasks
import uuid, os, requests, json, asyncio
from .config import settings
from .upstash_redis import get_upstash_client

app = FastAPI()

# Enable CORS for the Next.js dev server and Vercel deployment
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://dizzle.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


models.Base.metadata.create_all(bind=engine)

# Ensure Postgres trigram extension and GIN indexes for faster ILIKE search
def ensure_search_indexes():
    try:
        with engine.begin() as conn:
            # Create extension if available (Postgres only)
            conn.execute(text("CREATE EXTENSION IF NOT EXISTS pg_trgm"))
            # Create GIN trigram indexes to accelerate ILIKE on name/description
            conn.execute(text(
                "CREATE INDEX IF NOT EXISTS idx_products_name_trgm ON products USING gin (name gin_trgm_ops)"
            ))
            conn.execute(text(
                "CREATE INDEX IF NOT EXISTS idx_products_description_trgm ON products USING gin (description gin_trgm_ops)"
            ))
    except Exception as _:
        # If running on non-Postgres or without permissions, ignore gracefully
        pass

ensure_search_indexes()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Cross-platform upload directory (works on Windows and Unix)
UPLOAD_DIR = os.path.join(os.getcwd(), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)


@app.get("/")
def root():
    """Root endpoint - API health check"""
    return {
        "status": "ok",
        "app": "Dizzle Product Importer",
        "version": "1.0.0",
        "endpoints": {
            "docs": "/docs",
            "upload": "/upload-csv",
            "products": "/products",
            "webhooks": "/webhooks",
            "stats": "/stats"
        }
    }


@app.post("/upload-csv")
async def upload_csv(file:UploadFile = File(...),db:Session = Depends(get_db)):
    """
    Upload and process a CSV file containing product data.
    Maximum file size: 5GB (configurable via MAX_UPLOAD_BYTES)
    Required columns: sku, name, description, price
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    if not file.filename.endswith(".csv"):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Expected .csv file, got: {file.filename}"
        )

    job  = crud.create_import_job(db, original_filename=file.filename)
    file_id = f"{job.id}_{uuid.uuid4().hex}_{file.filename}"
    dest_path = os.path.join(UPLOAD_DIR,file_id)
    size = 0
    with open(dest_path, "wb") as out_f:
        while True:
            chunk = await file.read(4 * 1024 * 1024)
            if not chunk:
                break
            size += len(chunk)
            if size > settings.MAX_UPLOAD_BYTES:
                out_f.close()
                try:
                    os.remove(dest_path)
                except:
                    pass
                max_size_mb = settings.MAX_UPLOAD_BYTES / (1024 * 1024)
                raise HTTPException(
                    status_code=413,
                    detail=f"File too large. Maximum size: {max_size_mb:.0f}MB"
                )
            out_f.write(chunk)

    # update job with file path for potential retry
    crud.update_job_progress(db, job.id, processed=0, status="queued", file_path=dest_path)
    tasks.import_csv_task.delay(dest_path, job.id)
    return {"job_id": job.id}

# Initialize Upstash Redis client for pub/sub messaging
upstash_client = get_upstash_client()

@app.websocket("/ws/import-progress/{job_id}")
async def ws_import_progress(websocket: WebSocket, job_id: int):
    """
    WebSocket endpoint for real-time import progress updates
    Uses Upstash Redis with polling mechanism since REST API doesn't support traditional pub/sub
    """
    await websocket.accept()
    channel = f"import_progress:{job_id}"
    last_message_id = 0

    try:
        # Poll for messages stored in Redis
        while True:
            # Try to get the latest message
            latest_message = upstash_client.get(f"{channel}:latest")

            if latest_message:
                try:
                    data = json.loads(latest_message)
                    # Only send if it's a new message (check status or use a counter)
                    message_id = data.get("_msg_id", 0)
                    if message_id > last_message_id:
                        await websocket.send_json(data)
                        last_message_id = message_id

                        # Check if import is complete or failed
                        if data.get("status") in ["complete", "failed"]:
                            break
                except json.JSONDecodeError:
                    pass

            # Wait before next poll (adjust interval as needed)
            await asyncio.sleep(0.5)

    except Exception as e:
        print(f"WebSocket error: {e}")
        await websocket.close()
    finally:
        # Cleanup: optionally delete the message after completion
        upstash_client.delete(f"{channel}:latest")

# app/main.py (continued)

from sqlalchemy import or_
from pydantic import BaseModel

class ProductCreate(BaseModel):
    sku: str
    name: str
    description: str = None
    price_cents: int = None
    active: bool = True

@app.get("/products")
def list_products(q: str = None, sku: str = None, active: bool = None, page: int = 1, per_page: int = 50, db: Session = Depends(get_db)):
    # Clamp per_page to protect DB
    per_page = max(1, min(per_page, 200))
    page = max(1, page)
    query = db.query(models.Product)
    if sku:
        query = query.filter(models.Product.sku_lower == sku.lower())
    if q:
        qlike = f"%{q}%"
        query = query.filter(or_(models.Product.name.ilike(qlike), models.Product.description.ilike(qlike)))
    if active is not None:
        query = query.filter(models.Product.active == active)
    total = query.count()
    items = (
        query.order_by(models.Product.id.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )
    def to_dict(p):
        return {
            "id": p.id,
            "sku": p.sku,
            "sku_lower": p.sku_lower,
            "name": p.name,
            "description": p.description,
            "price_cents": p.price_cents,
            "active": p.active,
            "created_at": p.created_at,
            "updated_at": p.updated_at,
        }
    return {"total": total, "page": page, "per_page": per_page, "items": [to_dict(p) for p in items]}

@app.post("/products")
def create_product(payload: ProductCreate, db: Session = Depends(get_db)):
    sku_lower = payload.sku.strip().lower()
    existing = db.query(models.Product).filter(models.Product.sku_lower == sku_lower).first()
    if existing:
        existing.sku = payload.sku.strip()
        existing.name = payload.name
        existing.description = payload.description
        existing.price_cents = payload.price_cents
        existing.active = payload.active
        db.add(existing); db.commit(); db.refresh(existing)
        return {
            "id": existing.id,
            "sku": existing.sku,
            "sku_lower": existing.sku_lower,
            "name": existing.name,
            "description": existing.description,
            "price_cents": existing.price_cents,
            "active": existing.active,
            "created_at": existing.created_at,
            "updated_at": existing.updated_at,
        }
    prod = models.Product(
        sku=payload.sku.strip(),
        sku_lower=sku_lower,
        name=payload.name,
        description=payload.description,
        price_cents=payload.price_cents,
        active=payload.active
    )
    db.add(prod); db.commit(); db.refresh(prod)
    return {
        "id": prod.id,
        "sku": prod.sku,
        "sku_lower": prod.sku_lower,
        "name": prod.name,
        "description": prod.description,
        "price_cents": prod.price_cents,
        "active": prod.active,
        "created_at": prod.created_at,
        "updated_at": prod.updated_at,
    }

@app.delete("/products")
def bulk_delete(confirm: bool = False, db: Session = Depends(get_db)):
    if not confirm:
        raise HTTPException(status_code=400, detail="Must provide confirm=true to delete all products")
    deleted = db.query(models.Product).delete()
    db.commit()
    return {"deleted": deleted}

@app.get("/stats")
def get_stats(db: Session = Depends(get_db)):
    total_products = db.query(models.Product).count()
    recent_uploads = db.query(models.ImportJob).filter(models.ImportJob.status == "complete").count()
    active_webhooks = db.query(models.Webhook).filter(models.Webhook.enabled == True).count()
    return {
        "total_products": total_products,
        "recent_uploads": recent_uploads,
        "active_webhooks": active_webhooks
    }

@app.get("/import-jobs")
def list_import_jobs(limit: int = 10, db: Session = Depends(get_db)):
    limit = max(1, min(limit, 50))
    jobs = db.query(models.ImportJob).order_by(models.ImportJob.created_at.desc()).limit(limit).all()
    def to_dict(j):
        pct = 0
        if j.total_rows:
            pct = round((j.processed_rows / j.total_rows) * 100, 2)
        return {
            "id": j.id,
            "status": j.status,
            "processed_rows": j.processed_rows,
            "total_rows": j.total_rows,
            "percent": pct,
            "error": j.error,
            "original_filename": j.original_filename,
            "created_at": j.created_at,
            "updated_at": j.updated_at,
        }
    return {"jobs": [to_dict(j) for j in jobs]}

@app.post("/import-jobs/{job_id}/retry")
def retry_import_job(job_id: int, db: Session = Depends(get_db)):
    from datetime import datetime
    job = db.get(models.ImportJob, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.status not in ["failed", "complete"]:
        raise HTTPException(status_code=400, detail="Job is still running or queued")
    if not job.file_path or not os.path.exists(job.file_path):
        raise HTTPException(status_code=400, detail="Original file not available for retry")
    # reset job for retry
    job.status = "queued"
    job.processed_rows = 0
    job.error = None
    job.updated_at = datetime.utcnow()
    db.add(job); db.commit(); db.refresh(job)
    tasks.import_csv_task.delay(job.file_path, job.id)
    return {"job_id": job.id, "status": job.status}

class WebhookCreate(BaseModel):
    url: str
    events: list[str]
    enabled: bool = True

class WebhookUpdate(BaseModel):
    url: str = None
    event: str = None
    enabled: bool = None

@app.get("/webhooks")
def list_webhooks(db: Session = Depends(get_db)):
    webhooks = db.query(models.Webhook).all()
    return [{"id": w.id, "url": w.url, "event": w.event, "enabled": w.enabled, "created_at": w.created_at} for w in webhooks]

@app.post("/webhooks")
def create_webhook(payload: WebhookCreate, db: Session = Depends(get_db)):
    webhooks = []
    for event in payload.events:
        wh = models.Webhook(url=payload.url, event=event, enabled=payload.enabled)
        db.add(wh)
        webhooks.append(wh)
    db.commit()
    return [{"id": w.id, "url": w.url, "event": w.event, "enabled": w.enabled, "created_at": w.created_at} for w in webhooks]

@app.put("/webhooks/{webhook_id}")
def update_webhook(webhook_id: int, payload: WebhookUpdate, db: Session = Depends(get_db)):
    wh = db.query(models.Webhook).filter(models.Webhook.id == webhook_id).first()
    if not wh:
        raise HTTPException(status_code=404, detail="Webhook not found")
    if payload.url is not None:
        wh.url = payload.url
    if payload.event is not None:
        wh.event = payload.event
    if payload.enabled is not None:
        wh.enabled = payload.enabled
    db.commit()
    db.refresh(wh)
    return {"id": wh.id, "url": wh.url, "event": wh.event, "enabled": wh.enabled, "created_at": wh.created_at}

@app.delete("/webhooks/{webhook_id}")
def delete_webhook(webhook_id: int, db: Session = Depends(get_db)):
    wh = db.query(models.Webhook).filter(models.Webhook.id == webhook_id).first()
    if not wh:
        raise HTTPException(status_code=404, detail="Webhook not found")
    db.delete(wh)
    db.commit()
    return {"deleted": True}

@app.post("/webhooks/{webhook_id}/test")
def test_webhook(webhook_id: int, db: Session = Depends(get_db)):
    wh = db.query(models.Webhook).filter(models.Webhook.id == webhook_id).first()
    if not wh:
        raise HTTPException(status_code=404, detail="Webhook not found")
    try:
        res = requests.post(wh.url, json={"event": wh.event, "test": True}, timeout=5)
        return {"status": res.status_code, "success": res.ok}
    except Exception as e:
        return {"status": 0, "success": False, "error": str(e)}

@app.put("/products/{product_id}")
def update_product(product_id: int, payload: ProductCreate, db: Session = Depends(get_db)):
    prod = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not prod:
        raise HTTPException(status_code=404, detail="Product not found")
    sku_lower = payload.sku.strip().lower()
    existing = db.query(models.Product).filter(models.Product.sku_lower == sku_lower, models.Product.id != product_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="SKU already exists")
    prod.sku = payload.sku.strip()
    prod.sku_lower = sku_lower
    prod.name = payload.name
    prod.description = payload.description
    prod.price_cents = payload.price_cents
    prod.active = payload.active
    db.commit()
    db.refresh(prod)
    return {"id": prod.id, "sku": prod.sku, "sku_lower": prod.sku_lower, "name": prod.name, "description": prod.description, "price_cents": prod.price_cents, "active": prod.active, "created_at": prod.created_at, "updated_at": prod.updated_at}

@app.delete("/products/{product_id}")
def delete_product(product_id: int, db: Session = Depends(get_db)):
    prod = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not prod:
        raise HTTPException(status_code=404, detail="Product not found")
    db.delete(prod)
    db.commit()
    return {"deleted": True}
