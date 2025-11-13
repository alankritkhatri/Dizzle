# Dizzle – Product Importer (FastAPI + Celery + Next.js)

This app imports a large CSV (up to ~500k rows) into Postgres with a FastAPI backend and a Celery worker, and provides a Next.js frontend for upload, progress, and product management.

## Stack
- Backend: FastAPI, SQLAlchemy, Celery, Redis, Postgres
- Frontend: Next.js (App Router, TypeScript)
- Infra: Docker Compose for local dev

## Project Layout
- `backend/` – FastAPI, Celery worker, Dockerfile, docker-compose.yml
- `frontend/` – Next.js UI (upload, products, webhooks)

## 1) Quick Start with Docker (recommended)
Prereq: Docker Desktop running.

```powershell
# From project root
cd .\backend
# Optional: create backend .env from example
Copy-Item .env.example .env

# Build and start API, worker, Postgres, Redis
docker compose up --build
```

- API: http://localhost:8000
- OpenAPI docs: http://localhost:8000/docs

In a second terminal, start the frontend:
```powershell
cd ..\frontend
# First run only: copy env example
Copy-Item .env.local.example .env.local
# If you want a different backend URL, edit NEXT_PUBLIC_API_BASE_URL
npm install
npm run dev
```
- Frontend: http://localhost:3000

Upload CSV in the UI. You’ll see real-time progress via WebSocket. View and bulk-delete products in Products.

CSV headers expected: `sku,name,description,price`

## 2) Run Locally Without Docker (advanced)
Prereqs: Python 3.11+, Node 18+, PostgreSQL, Redis

```powershell
# Backend venv
cd .\backend
python -m venv .venv; .\.venv\Scripts\Activate.ps1
pip install -r requirements.txt

# Set env (adjust for your local Postgres/Redis)
$env:DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/postgres"
$env:REDIS_URL    = "redis://localhost:6379/0"

# Start API (terminal 1)
uvicorn app.app:app --host 0.0.0.0 --port 8000 --reload

# Start Celery worker (terminal 2)
celery -A app.celery_worker.celery_app worker --loglevel=info
```

Frontend:
```powershell
cd ..\frontend
Copy-Item .env.local.example .env.local
# Ensure NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
npm install
npm run dev
```

## Notes
- SKU uniqueness is enforced case-insensitively using `sku_lower`.
- Large CSVs are batched and upserted into Postgres; import progress is published via Redis Pub/Sub and consumed over WebSocket at `/ws/import-progress/{job_id}`.
- CORS is enabled for `http://localhost:3000` in the backend.

## Troubleshooting
- WebSocket not updating: ensure `NEXT_PUBLIC_API_BASE_URL` points to the backend host:port, and backend is reachable from the browser.
- Celery not connecting: verify `REDIS_URL` and that the worker command is `celery -A app.celery_worker.celery_app worker`.
- DB errors: ensure Postgres is up and `DATABASE_URL` is correct.
