from fastapi import FastAPI, UploadFile, File, WebSocket, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from .database import SessionLocal, engine
from . import models, crud, tasks
import uuid, os
import redis, json
from .config import settings

app = FastAPI()

# Enable CORS for the Next.js dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


models.Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

UPLOAD_DIR = "/tmp/uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


@app.post("/upload-csv")
async def upload_csv(file:UploadFile = File(...),db:Session = Depends(get_db)):
    if not file.filename.endswith((".csv")):
        raise HTTPException(status_code=400,detail = "please upload a csv file")

    job  = crud.create_import_job(db)
    file_id = f"{job.id}_{uuid.uuidv4().hex}_{file.filename}"
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
                finally:
                    pass
                raise HTTPException(status_code=413, detail="File too large")
            out_f.write(chunk)

    # enqueue async import
    tasks.import_csv_task.delay(dest_path, job.id)
    return {"job_id": job.id}

r = redis.from_url(settings.REDIS_URL)

@app.websocket("/ws/import-progress/{job_id}")
async def ws_import_progress(websocket: WebSocket, job_id: int):
    await websocket.accept()
    pubsub = r.pubsub()
    channel = f"import_progress:{job_id}"
    pubsub.subscribe(channel)
    try:
        # listen to redis messages in a loop
        while True:
            message = pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
            if message:
                data = json.loads(message['data'])
                await websocket.send_json(data)
            # keep alive/ping
    except Exception as e:
        await websocket.close()
    finally:
        pubsub.unsubscribe(channel)
        pubsub.close()

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
