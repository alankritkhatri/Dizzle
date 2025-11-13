# app/tasks.py
from .celery_worker import celery_app

# app/tasks.py
from celery import shared_task, current_task
from .config import settings
from .database import engine, SessionLocal
from . import crud, models
import csv, io, os, time, json, uuid, requests, hmac, hashlib
from sqlalchemy import text
from .upstash_redis import get_upstash_client

# Initialize Upstash Redis client
upstash_client = get_upstash_client()

# Message ID counter for tracking message order
_message_counters = {}

def publish_progress(job_id: int, message: dict):
    """
    Publish progress update to Upstash Redis
    Stores the latest message with a message ID for tracking
    """
    channel = f"import_progress:{job_id}"

    # Add message ID for tracking
    if job_id not in _message_counters:
        _message_counters[job_id] = 0
    _message_counters[job_id] += 1
    message["_msg_id"] = _message_counters[job_id]

    # Store as the latest message (with expiration to auto-cleanup)
    upstash_client.set(
        f"{channel}:latest",
        json.dumps(message),
        ex=3600  # Expire after 1 hour
    )


def _sign_payload(payload: dict) -> str | None:
    """Return hex HMAC-SHA256 signature of JSON payload if WEBHOOK_SECRET is set."""
    secret = (settings.WEBHOOK_SECRET or "").encode("utf-8")
    if not secret:
        return None
    body = json.dumps(payload, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    return hmac.new(secret, body, hashlib.sha256).hexdigest()


@celery_app.task(bind=True, name="deliver_webhook", autoretry_for=(Exception,), retry_backoff=True, retry_kwargs={"max_retries": 6})
def deliver_webhook(self, webhook_id: int, url: str, event: str, payload: dict):
    """Deliver a single webhook with retries and timeout."""
    headers = {
        "Content-Type": "application/json",
        "X-Event": event,
    }
    sig = _sign_payload(payload)
    if sig:
        headers["X-Signature"] = sig
        headers["X-Signature-Alg"] = "HMAC-SHA256"
    timeout = max(1, int(settings.WEBHOOK_TIMEOUT_SECONDS or 5))
    start = time.perf_counter()
    resp = requests.post(url, json={"event": event, "data": payload}, headers=headers, timeout=timeout)
    # Consider 2xx as success; otherwise raise to trigger retry
    if not (200 <= resp.status_code < 300):
        raise RuntimeError(f"webhook {webhook_id} returned {resp.status_code}")
    return {"status": resp.status_code, "duration_ms": int((time.perf_counter() - start) * 1000)}


@celery_app.task(name="fire_event")
def fire_event(event: str, payload: dict):
    """Query enabled webhooks for this event and enqueue delivery tasks."""
    db = SessionLocal()
    try:
        hooks = db.query(models.Webhook).filter(models.Webhook.enabled == True, models.Webhook.event == event).all()
        for wh in hooks:
            deliver_webhook.delay(wh.id, wh.url, event, payload)
        return {"enqueued": len(hooks), "event": event}
    finally:
        db.close()


@celery_app.task(name="ping_task")
def ping_task():
    return "pong"

@celery_app.task(bind=True, name="import_csv_task", acks_late=True)
def import_csv_task(self, file_path: str, job_id: int):
    db = SessionLocal()
    try:
        crud.update_job_progress(db, job_id, processed=0, status="running")
        publish_progress(job_id, {"status":"running","processed":0,"message":"Starting import"})

        # Count records accurately using csv (handles quoted newlines) and skip blank SKU rows
        with open(file_path, "r", newline='', encoding='utf-8', errors='ignore') as f:
            reader_for_count = csv.DictReader(f)
            total = 0
            for r in reader_for_count:
                sku_val = str(r.get("sku", "")).strip()
                if not sku_val:
                    continue
                total += 1
        crud.update_job_progress(db, job_id, processed=0, total=total)
        publish_progress(job_id, {"status":"running","processed":0,"total":total,"message":"Parsing CSV"})

        batch = []
        batch_size = settings.CSV_BATCH_SIZE
        inserted = 0

        # fast path: use COPY to load into a per-job staging table, then upsert
        conn = engine.raw_connection()
        cur = conn.cursor()

        # Create a unique UNLOGGED staging table per job to avoid temp-table scope issues
        staging_table = f"staging_products_{job_id}_{uuid.uuid4().hex[:8]}"
        cur.execute(
            f"""
            CREATE UNLOGGED TABLE {staging_table} (
                sku text,
                name text,
                description text,
                price_cents integer
            );
            """
        )
        conn.commit()

        # Speed up bulk upserts within this session
        try:
            cur.execute("SET LOCAL synchronous_commit = OFF;")
        except Exception:
            pass

        # open file and copy rows in chunks
        def _clean_text(val: str) -> str:
            if val is None:
                return ""
            s = str(val)
            # Replace tabs/newlines that would break COPY delimiters
            return s.replace("\t", " ").replace("\r", " ").replace("\n", " ")

        with open(file_path, "r", newline='', encoding='utf-8', errors='ignore') as f:
            reader = csv.DictReader(f)
            rows = []
            buffered = 0  # number of rows currently buffered for COPY
            copy_buffer = io.StringIO()
            for row in reader:
                sku = _clean_text(row.get("sku", "")).strip()
                name = _clean_text(row.get("name", "")).strip()
                description = _clean_text(row.get("description", ""))
                price = row.get("price","")
                price_cents = None
                if price:
                    try:
                        price_cents = int(float(price) * 100)
                    except:
                        price_cents = None
                # skip rows with no SKU
                if not sku:
                    continue
                # normalize and write tab-separated for COPY
                price_col = "" if price_cents is None else str(price_cents)
                copy_buffer.write(f"{sku}\t{name}\t{description}\t{price_col}\n")
                buffered += 1
                if buffered >= batch_size:
                    copy_buffer.seek(0)
                    if copy_buffer.getvalue():
                        cur.copy_from(
                            copy_buffer,
                            staging_table,
                            sep="\t",
                            columns=('sku','name','description','price_cents'),
                            null=''  # treat empty string as NULL
                        )
                    conn.commit()
                    copy_buffer = io.StringIO()
                    # upsert tmp_products -> products with in-batch deduplication on sku_lower
                    cur.execute(
                        f"""
                        INSERT INTO products (sku, sku_lower, name, description, price_cents, active, created_at, updated_at)
                        SELECT sku, sku_lower, name, description, price_cents, true, now(), now()
                        FROM (
                            SELECT DISTINCT ON (sku_lower)
                                   sku, sku_lower, name, description, price_cents
                            FROM (
                                SELECT lower(sku) AS sku_lower, sku, name, description, price_cents, ctid
                                FROM {staging_table}
                            ) t
                            ORDER BY sku_lower, ctid DESC
                        ) d
                        ON CONFLICT (sku_lower) DO UPDATE
                        SET sku = EXCLUDED.sku,
                            name = EXCLUDED.name,
                            description = EXCLUDED.description,
                            price_cents = EXCLUDED.price_cents,
                            updated_at = now();
                        """
                    )
                    conn.commit()
                    # clear temp table
                    cur.execute(f"TRUNCATE {staging_table};")
                    conn.commit()
                    inserted += buffered
                    buffered = 0
                    # Persist progress to DB so /import-jobs reflects live progress
                    try:
                        crud.update_job_progress(db, job_id, processed=inserted)
                    except Exception:
                        pass
                    publish_progress(job_id, {"status":"running","processed":inserted,"total":total, "message": f"Processed {inserted}/{total}"})
            # final flush
            copy_buffer.seek(0)
            if copy_buffer.getvalue():
                cur.copy_from(
                    copy_buffer,
                    staging_table,
                    sep="\t",
                    columns=('sku','name','description','price_cents'),
                    null=''  # treat empty string as NULL
                )
            conn.commit()
            cur.execute(
                f"""
                INSERT INTO products (sku, sku_lower, name, description, price_cents, active, created_at, updated_at)
                SELECT sku, sku_lower, name, description, price_cents, true, now(), now()
                FROM (
                    SELECT DISTINCT ON (sku_lower)
                           sku, sku_lower, name, description, price_cents
                    FROM (
                        SELECT lower(sku) AS sku_lower, sku, name, description, price_cents, ctid
                        FROM {staging_table}
                    ) t
                    ORDER BY sku_lower, ctid DESC
                ) d
                ON CONFLICT (sku_lower) DO UPDATE
                SET sku = EXCLUDED.sku,
                    name = EXCLUDED.name,
                    description = EXCLUDED.description,
                    price_cents = EXCLUDED.price_cents,
                    updated_at = now();
                """
            )
            conn.commit()
            # Drop staging table to clean up
            try:
                cur.execute(f"DROP TABLE IF EXISTS {staging_table};")
                conn.commit()
            except Exception:
                pass
            # count final processed rows (best-effort)
            inserted += buffered
            try:
                crud.update_job_progress(db, job_id, processed=inserted)
            except Exception:
                pass
            publish_progress(job_id, {"status":"complete","processed":total,"total":total,"message":"Import complete"})
            # Ensure DB reflects total processed at completion for accurate UI
            crud.update_job_progress(db, job_id, processed=total, status="complete")
            # Fire import.completed webhooks asynchronously
            try:
                fire_event.delay("import.completed", {"job_id": job_id, "total_rows": total})
            except Exception:
                pass
    except Exception as e:
        crud.update_job_progress(db, job_id, processed=0, status="failed", error=str(e))
        publish_progress(job_id, {"status":"failed","message":str(e)})
        # keep file for retry
        try:
            fire_event.delay("import.failed", {"job_id": job_id, "error": str(e)})
        except Exception:
            pass
        raise
    finally:
        # remove file only on success (status complete and no error)
        try:
            job_state = db.get(models.ImportJob, job_id)
            if job_state and job_state.status == "complete" and os.path.exists(file_path):
                os.remove(file_path)
        except Exception:
            pass
        db.close()
        try:
            cur.close()
            conn.close()
        except:
            pass
