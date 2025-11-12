# app/tasks.py
from celery import shared_task, current_task
from .config import settings
from .database import engine, SessionLocal
from . import crud, models
import csv, io, os, time
import redis, json
from sqlalchemy import text

r = redis.from_url(settings.REDIS_URL)

def publish_progress(job_id: int, message: dict):
    channel = f"import_progress:{job_id}"
    r.publish(channel, json.dumps(message))

@shared_task(bind=True, name="import_csv_task", acks_late=True)
def import_csv_task(self, file_path: str, job_id: int):
    db = SessionLocal()
    try:
        crud.update_job_progress(db, job_id, processed=0, status="running")
        publish_progress(job_id, {"status":"running","processed":0,"message":"Starting import"})

        # count rows quickly (optional but helpful)
        with open(file_path, "r", encoding='utf-8', errors='ignore') as f:
            total = sum(1 for _ in f) - 1  # minus header
        crud.update_job_progress(db, job_id, processed=0, total=total)
        publish_progress(job_id, {"status":"running","processed":0,"total":total,"message":"Parsing CSV"})

        batch = []
        batch_size = settings.CSV_BATCH_SIZE
        inserted = 0

        # fast path: use COPY to load into temp table, then upsert
        conn = engine.raw_connection()
        cur = conn.cursor()

        # create temp table
        cur.execute("""
            CREATE TEMP TABLE tmp_products (
                sku text,
                name text,
                description text,
                price_cents integer
            ) ON COMMIT DROP;
        """)
        conn.commit()

        # open file and copy rows in chunks
        with open(file_path, "r", encoding='utf-8', errors='ignore') as f:
            reader = csv.DictReader(f)
            rows = []
            i = 0
            copy_buffer = io.StringIO()
            for row in reader:
                i += 1
                sku = row.get("sku","").strip()
                name = row.get("name","").strip()
                description = row.get("description","")
                price = row.get("price","")
                price_cents = None
                if price:
                    try:
                        price_cents = int(float(price) * 100)
                    except:
                        price_cents = None
                # normalize and write tab-separated for COPY
                copy_buffer.write(f"{sku}\t{name}\t{description}\t{price_cents or ''}\n")

                if i % batch_size == 0:
                    copy_buffer.seek(0)
                    cur.copy_from(copy_buffer, 'tmp_products', sep="\t", columns=('sku','name','description','price_cents'))
                    conn.commit()
                    copy_buffer = io.StringIO()
                    # upsert tmp_products -> products
                    cur.execute("""
                    INSERT INTO products (sku, sku_lower, name, description, price_cents, active, created_at, updated_at)
                    SELECT sku, lower(sku), name, description, price_cents, true, now(), now()
                    FROM tmp_products
                    ON CONFLICT (sku_lower) DO UPDATE
                    SET sku = EXCLUDED.sku,
                        name = EXCLUDED.name,
                        description = EXCLUDED.description,
                        price_cents = EXCLUDED.price_cents,
                        updated_at = now();
                    """)
                    conn.commit()
                    # clear temp table
                    cur.execute("TRUNCATE tmp_products;")
                    conn.commit()
                    inserted += batch_size
                    publish_progress(job_id, {"status":"running","processed":inserted,"total":total, "message": f"Processed {inserted}/{total}"})
            # final flush
            copy_buffer.seek(0)
            cur.copy_from(copy_buffer, 'tmp_products', sep="\t", columns=('sku','name','description','price_cents'))
            conn.commit()
            cur.execute("""
            INSERT INTO products (sku, sku_lower, name, description, price_cents, active, created_at, updated_at)
            SELECT sku, lower(sku), name, description, price_cents, true, now(), now()
            FROM tmp_products
            ON CONFLICT (sku_lower) DO UPDATE
            SET sku = EXCLUDED.sku,
                name = EXCLUDED.name,
                description = EXCLUDED.description,
                price_cents = EXCLUDED.price_cents,
                updated_at = now();
            """)
            conn.commit()
            # count final processed rows (best-effort)
            inserted += i % batch_size
            publish_progress(job_id, {"status":"complete","processed":inserted,"total":total,"message":"Import complete"})
            crud.update_job_progress(db, job_id, processed=inserted, status="complete")
    except Exception as e:
        crud.update_job_progress(db, job_id, processed=0, status="failed", error=str(e))
        publish_progress(job_id, {"status":"failed","message":str(e)})
        raise
    finally:
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
            except:
                pass
        db.close()
        try:
            cur.close()
            conn.close()
        except:
            pass
