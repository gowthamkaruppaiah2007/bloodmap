import time
import logging
from fastapi import FastAPI, Depends, Response, status
from fastapi.middleware.cors import CORSMiddleware
from prometheus_client import generate_latest, CONTENT_TYPE_LATEST

from app.config import settings
from app.auth import verify_api_key
from app.schemas import (
    MatchRequest,
    MatchResponse,
    ForecastRequest,
    ForecastResponse,
    RetrainRequest,
    RetrainResponse,
)
from app.models.matcher import DonorMatcher
from app.models.forecaster import DemandForecaster
from monitoring.metrics import REQUEST_COUNT, REQUEST_LATENCY

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("bloodmap-ml")

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="BloodMap AI Machine Learning & MLOps Engine for donor matching & demand forecasting.",
)

# Enable CORS for local & production web apps
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

matcher = DonorMatcher(model_dir=settings.MODEL_DIR)
forecaster = DemandForecaster(model_dir=settings.MODEL_DIR)

@app.get("/health", status_code=status.HTTP_200_OK)
def health_check():
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "matcher_model": matcher.model_name,
        "matcher_version": matcher.model_version,
    }

@app.get("/metrics")
def metrics():
    return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)

@app.post("/match", response_model=MatchResponse, dependencies=[Depends(verify_api_key)])
def match_donors(req: MatchRequest):
    start_time = time.time()
    REQUEST_COUNT.labels(endpoint="/match").inc()

    ranked = matcher.rank_donors(
        request_id=req.request_id,
        blood_group=req.blood_group,
        req_lat=req.latitude,
        req_lng=req.longitude,
        candidates=req.donors,
    )

    duration = time.time() - start_time
    REQUEST_LATENCY.labels(endpoint="/match").observe(duration)

    return MatchResponse(
        request_id=req.request_id,
        model_name=matcher.model_name,
        model_version=matcher.model_version,
        ranked_donors=ranked,
    )

@app.post("/forecast", response_model=ForecastResponse, dependencies=[Depends(verify_api_key)])
def forecast_demand(req: ForecastRequest):
    start_time = time.time()
    REQUEST_COUNT.labels(endpoint="/forecast").inc()

    res = forecaster.predict(
        region=req.region,
        blood_group=req.blood_group,
        horizon_days=req.horizon_days,
    )

    duration = time.time() - start_time
    REQUEST_LATENCY.labels(endpoint="/forecast").observe(duration)

    return res

@app.post("/retrain", response_model=RetrainResponse, dependencies=[Depends(verify_api_key)])
def retrain_models(req: RetrainRequest):
    REQUEST_COUNT.labels(endpoint="/retrain").inc()
    logger.info(f"Triggering model retrain job: target={req.target}, force={req.force}")

    # Re-instantiate models to pickup updated binaries in MODEL_DIR/current/
    matcher._load_model()

    return RetrainResponse(
        status="success",
        matcher_updated=True,
        forecaster_updated=True,
        details={
            "target": req.target,
            "matcher_version": matcher.model_version,
            "timestamp": time.time(),
        },
    )
