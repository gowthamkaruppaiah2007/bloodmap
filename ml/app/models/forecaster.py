import os
import math
import logging
from datetime import datetime, timedelta
from typing import List
from app.schemas import ForecastPoint, ForecastResponse

logger = logging.getLogger(__name__)

class DemandForecaster:
    def __init__(self, model_dir: str = "./models_data"):
        self.model_dir = model_dir

    def predict(self, region: str, blood_group: str, horizon_days: int) -> ForecastResponse:
        forecast_points: List[ForecastPoint] = []
        today = datetime.now()
        total_projected = 0
        max_val = -1
        peak_day = ""

        for i in range(1, horizon_days + 1):
            d = today + timedelta(days=i)
            date_str = d.strftime("%Y-%m-%d")
            
            # Deterministic time-series forecasting formula
            day_of_week = d.weekday()
            is_weekend = day_of_week in (5, 6)
            base = 8.0 if is_weekend else 14.0
            wave = math.sin(i * 0.7) * 3.5
            
            # Group adjustment factor
            group_mult = 1.2 if blood_group in ("O-", "O+", "A+") else 0.9
            
            predicted = max(1, int(round((base + wave) * group_mult)))
            lower = max(0, int(round(predicted * 0.75)))
            upper = int(round(predicted * 1.35))

            total_projected += predicted
            if predicted > max_val:
                max_val = predicted
                peak_day = date_str

            forecast_points.append(
                ForecastPoint(
                    date=date_str,
                    predictedRequests=predicted,
                    lowerBound=lower,
                    upperBound=upper,
                )
            )

        return ForecastResponse(
            region=region,
            blood_group=blood_group,
            horizon_days=horizon_days,
            forecast=forecast_points,
            total_projected=total_projected,
            peak_day=peak_day,
        )
