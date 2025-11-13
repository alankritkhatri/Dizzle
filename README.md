# Dizzle

Bulk product imports without the drama.

I built Dizzle to take a giant CSV (hundreds of thousands of rows) and land it in Postgres quickly, while still letting me watch progress and retry failures. The backend is FastAPI + Celery; the frontend is Next.js. Redis keeps the task queue ticking and streams progress updates out to the browser.

---

## What It Does

1. You upload a CSV (`sku,name,description,price` … plus optional extras) via the web UI.
2. The file is stored and a Celery job starts parsing and batching rows into Postgres.
3. Progress events go out over Redis and are surfaced in the UI (WebSocket endpoint per job).
4. Products become available immediately; duplicates (case-insensitive SKU) are updated, not duplicated.
5. Failed runs keep the original file so you can hit “Retry” later instead of re‑uploading.

---

## Tech Stack (Plain English)

Backend: FastAPI API layer, SQLAlchemy models, Celery worker for long running imports, Postgres for storage, Redis (or Upstash Redis) for broker + lightweight pub/sub.

Frontend: Next.js (App Router + TypeScript) with a dashboard, product management, and real‑time import status.

Local Dev: Docker Compose spins up Postgres, Redis, API, worker. You can also run everything “bare metal” if you prefer.

---

## Repository Layout

`backend/` – API code, Celery tasks, Dockerfile, compose file

`frontend/` – Next.js app (upload flow, product UI, import job listing + retry)

Uploads go to `backend/uploads/` until a job succeeds (failed jobs keep the original file for retry).

---

## Getting Started (Docker Way)

Prerequisite: Docker Desktop running.

```powershell
cd .\backend
Copy-Item .env.example .env   # optional
docker compose up --build
```

Backend lives at `http://localhost:8000` (docs at `/docs`).

In another terminal for the frontend:

```powershell
cd ..\frontend
Copy-Item .env.local.example .env.local   # first run
npm install
npm run dev
```

Visit `http://localhost:3000` and drop in a CSV.

---

## Getting Started (Manual / No Docker)

Prereqs: Python 3.11+, Node 18+, a running Postgres, and Redis.

```powershell
cd .\backend
python -m venv .venv; .\.venv\Scripts\Activate.ps1
pip install -r requirements.txt

$env:DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/postgres"
$env:REDIS_URL    = "redis://localhost:6379/0"

uvicorn app.app:app --host 0.0.0.0 --port 8000 --reload   # terminal 1
celery -A app.celery_worker.celery_app worker --loglevel=info   # terminal 2
```

Frontend:

```powershell
cd ..\frontend
Copy-Item .env.local.example .env.local
npm install
npm run dev
```

---

## CSV Format

Required columns (in any order, but these four must exist):

```
sku,name,description,price
```

Optional columns currently ignored or handled separately: `quantity`, `category`, `active`. Extra columns are ignored safely.

Rules & behavior:

- Price: empty values become NULL.
- SKU: de‑duplicated case‑insensitively using a shadow `sku_lower` column.
- Bad / short lines (not 4 columns) are skipped and counted as processed.
- Import progress = `processed_rows / total_rows` (rounded).

---

## Retry & Import Jobs

Every upload creates an import job record. You can list recent jobs:

`GET /import-jobs?limit=5`

Returns job metadata including `status`, `processed_rows`, `total_rows`, `percent`, and the original filename.

To retry a failed job:

`POST /import-jobs/{job_id}/retry`

The original file is reused; a new Celery task is queued. Successful jobs delete their source file; failed jobs keep it.

Live progress per job streams at:

`/ws/import-progress/{job_id}` (WebSocket)

---

## Design Notes

- COPY + batch DISTINCT ON keeps imports fast while avoiding ON CONFLICT explosion from duplicates in the same file.
- Trigram (`pg_trgm`) indexes on product name/description enable future fuzzy search without refactoring later.
- Synchronous commit is disabled during import for speed; durability trade‑off is acceptable for bulk initial load.
- Upstash (if used) just swaps Redis network semantics; code treats it like a simple pub/sub feed.

---

## Troubleshooting Quick Hits

WebSocket doesn’t update → Confirm `NEXT_PUBLIC_API_BASE_URL` is pointing at `http://localhost:8000` and no proxy/CORS issues.

Celery connection errors → Check `REDIS_URL` (or Upstash credentials) and that the worker command matches the one above.

Postgres complaints (auth / missing extensions) → Verify `DATABASE_URL` and that `pg_trgm` is installed (the app will try to create it on startup).

Nothing imports / percent stays 0 → Your CSV might be empty or only headers; inspect the file under `backend/uploads/`.

Retry fails instantly → Original file might have been deleted manually; ensure it still exists before retry.

---

## Contributing / Tweaks

Open to: adding more columns, webhook events, fuzzy search UI, richer job audit trail. If you tweak something, keep the fast path (bulk COPY + upsert) intact.

---

## License

No explicit license file yet; treat this as “look but don’t ship commercially” until one is added. If that’s a blocker, raise an issue.

---

Enjoy. Drop a monster CSV and watch it chew through rows.
