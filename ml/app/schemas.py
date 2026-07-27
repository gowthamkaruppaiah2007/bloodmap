from pydantic import BaseModel, Field
from typing import List, Optional, Any, Dict

class DonorCandidate(BaseModel):
    id: str
    blood_group: str
    latitude: float
    longitude: float
    is_available: bool = True
    available_days: List[str] = Field(default_factory=list)

class MatchRequest(BaseModel):
    request_id: str
    blood_group: str
    latitude: float
    longitude: float
    donors: List[DonorCandidate]

class RankedDonor(BaseModel):
    id: str
    score: float
    reasons: List[str]

class MatchResponse(BaseModel):
    request_id: str
    model_name: str = "xgboost_ltr"
    model_version: str = "1.0.0"
    ranked_donors: List[RankedDonor]

class ForecastRequest(BaseModel):
    region: str = "Global"
    blood_group: str = "All"
    horizon_days: int = 14

class ForecastPoint(BaseModel):
    date: str
    predictedRequests: int
    lowerBound: int
    upperBound: int

class ForecastResponse(BaseModel):
    region: str
    blood_group: str
    horizon_days: int
    forecast: List[ForecastPoint]
    total_projected: int
    peak_day: str

class RetrainRequest(BaseModel):
    target: str = "all"  # 'matcher', 'forecaster', 'all'
    force: bool = False

class RetrainResponse(BaseModel):
    status: str
    matcher_updated: bool
    forecaster_updated: bool
    details: Dict[str, Any] = Field(default_factory=dict)
