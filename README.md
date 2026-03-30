# TCG Demo (Image Search)

Simple demo app to search TCG cards by image:

- Frontend: React (Vite)
- Backend: Express + Python worker (`open_clip` + `faiss`)
- Data source: prebuilt artifacts in `../artifacts`

## Requirements

- Node.js 20+
- npm 10+
- Python 3.11+ (with `pip`)
- Artifacts folder available at:
  - `../artifacts` (local default in examples below), or
  - any path you provide via `ARTIFACT_DIR`

Required artifact files:

- `faiss_hnsw_idmap.index`
- `metadata.jsonl`
- `build_config.json` (optional but recommended)

## Project Structure

- `backend/`: Express API + Python search worker
- `frontend/`: React UI
- `docker-compose.yml`: run frontend + backend with Docker

## Run Locally

Open 2 terminals.

### 1) Backend

```bash
cd ../backend
npm install
```

**macOS — using a virtual environment (recommended):**

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Then point `PYTHON_BIN` to the Python inside `.venv`:

```bash
export PYTHON_BIN=$(pwd)/.venv/bin/python
export ARTIFACT_DIR=/absolute/path/to/artifacts
npm run dev
```

Without venv, install globally and use `python3`:

```bash
pip install -r requirements.txt
export PYTHON_BIN=python3
export ARTIFACT_DIR=/absolute/path/to/artifacts
npm run dev
```

```powershell
# Windows PowerShell
$env:PYTHON_BIN="C:/../python3.11.exe"
$env:ARTIFACT_DIR="../artifacts"
npm run dev
```

Backend will run at `http://localhost:4000`.

### 2) Frontend

```bash
cd ../frontend
npm install
```

```bash
# Linux/macOS
export VITE_API_BASE_URL=http://localhost:4000
npm run dev
```

```powershell
# Windows PowerShell
$env:VITE_API_BASE_URL="http://localhost:4000"
npm run dev
```

Frontend will run at `http://localhost:5173`.

## Run With Docker

From `TCG-Demo/`:

```bash
docker compose up --build
```

Services:

- Frontend: `http://localhost:8080`
- Backend: `http://localhost:4000`

The backend container mounts artifacts from `../artifacts` into `/artifacts` (read-only), configured in `docker-compose.yml`.

## API

- `GET /api/health`: worker/backend status
- `POST /api/search`:
  - multipart field: `image` (file)
  - form field: `topK` (1..100, default 10)

## Common Issue

If you see `Python worker exited with code 9009`:

- Your backend process is not using a valid Python path.
- Set `PYTHON_BIN` explicitly (see backend commands above), then restart backend.
