from fastapi import FastAPI, UploadFile, File, WebSocket, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from .database import SessionLocal, engine
from . import models, crud, tasks
import uuid, os, shutil

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


