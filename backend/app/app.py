from fastapi import FastAPI, UploadFile, File, WebSocket, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from .database import SessionLocal, engine
from . import models, crud, tasks
import uuid, os, shutil
import redis, json
from .config import settings

app = FastAPI()


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
    with open (dest_path,"wb") as out_f:
        while True:
            chunk = await file.read(4*1024*1024)
            if not chunk:
                break
            out_f.write(chunk)

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

from sqlalchemy import or_, select
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
    items = query.order_by(models.Product.id.desc()).offset((page-1)*per_page).limit(per_page).all()
    return {"total": total, "page": page, "per_page": per_page, "items": items}

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
        return existing
    prod = models.Product(
        sku=payload.sku.strip(),
        sku_lower=sku_lower,
        name=payload.name,
        description=payload.description,
        price_cents=payload.price_cents,
        active=payload.active
    )
    db.add(prod); db.commit(); db.refresh(prod)
    return prod

@app.delete("/products")
def bulk_delete(confirm: bool = False, db: Session = Depends(get_db)):
    if not confirm:
        raise HTTPException(status_code=400, detail="Must provide confirm=true to delete all products")
    deleted = db.query(models.Product).delete()
    db.commit()
    return {"deleted": deleted}
