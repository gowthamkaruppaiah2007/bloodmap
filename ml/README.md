# BloodMap AI — Standalone Python ML & MLOps Service

A self-contained Python FastAPI service powering:
- **Learning-to-Rank (LTR) Donor Matcher** (`POST /match`)
- **Time-Series Blood Demand Forecaster** (`POST /forecast`)
- **Automated Retraining & ETL Pipelines** (`POST /retrain`)
- **Prometheus Monitoring & Health Checks** (`GET /metrics`, `GET /health`)

---

## 🚀 Quickstart (Local Development)

### 1. Run with Docker Compose (Recommended)

```bash
cd ml
docker-compose up --build
```

The service will start at `http://localhost:8000`.

### 2. Run with Python & Uvicorn

```bash
cd ml
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

---

## ☁️ Deployment Instructions

### Deploy to Render (Recommended Free Tier)

1. Connect your repository to [Render.com](https://render.com).
2. Create a new **Web Service**.
3. Select **Docker** environment.
4. Set **Docker Context Path**: `./ml`
5. Set **Dockerfile Path**: `./ml/Dockerfile`
6. Add Environment Variables:
   - `ML_API_KEY`: `your-custom-secret-key`
   - `SUPABASE_URL`: `https://sifwzveymuebfucqtwat.supabase.co`
   - `SUPABASE_SERVICE_ROLE_KEY`: `your-supabase-service-role-key`

---

## 🔑 Linking with the Frontend App

Add the following environment variables to your web application (Vercel / `.env`):

```env
VITE_ML_API_URL="https://your-ml-service.onrender.com"
VITE_ML_API_KEY="your-custom-secret-key"
```

If `VITE_ML_API_URL` is omitted or unreachable, the web app gracefully falls back to deterministic ABO/Rh matrix + Haversine distance scoring so the user experience is never interrupted.
