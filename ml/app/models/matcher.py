import os
import logging
from typing import List, Dict, Any
from app.features.compatibility import is_blood_compatible, get_compatibility_score
from app.features.distance import haversine_km, distance_score
from app.schemas import DonorCandidate, RankedDonor

logger = logging.getLogger(__name__)

class DonorMatcher:
    def __init__(self, model_dir: str = "./models_data"):
        self.model_dir = model_dir
        self.model_name = "rules_hybrid_v1"
        self.model_version = "1.0.0"
        self.xgb_model = None
        self._load_model()

    def _load_model(self):
        model_path = os.path.join(self.model_dir, "current", "matcher.xgb")
        if os.path.exists(model_path):
            try:
                import xgboost as xgb
                self.xgb_model = xgb.Booster()
                self.xgb_model.load_model(model_path)
                self.model_name = "xgboost_ltr"
                self.model_version = "2.0.0"
                logger.info(f"Loaded trained XGBoost LTR model from {model_path}")
            except Exception as e:
                logger.warning(f"Could not load XGBoost model from {model_path}: {e}")

    def rank_donors(
        self,
        request_id: str,
        blood_group: str,
        req_lat: float,
        req_lng: float,
        candidates: List[DonorCandidate],
    ) -> List[RankedDonor]:
        ranked: List[RankedDonor] = []

        for donor in candidates:
            if not is_blood_compatible(donor.blood_group, blood_group):
                continue

            dist_km = haversine_km(req_lat, req_lng, donor.latitude, donor.longitude)
            compat = get_compatibility_score(donor.blood_group, blood_group)
            d_score = distance_score(dist_km)

            reasons: List[str] = []
            
            if donor.blood_group == blood_group:
                reasons.append(f"Exact blood match ({donor.blood_group})")
            else:
                reasons.append(f"Compatible blood type ({donor.blood_group})")

            if dist_km <= 2.0:
                reasons.append("Very close (<2 km)")
            elif dist_km <= 5.0:
                reasons.append("Nearby (2–5 km)")
            elif dist_km <= 15.0:
                reasons.append("Within 15 km")
            else:
                reasons.append(f"Distance: {dist_km:.1f} km")

            if donor.is_available:
                reasons.append("Currently available")

            # Scoring algorithm
            if self.xgb_model:
                try:
                    import xgboost as xgb
                    import numpy as np
                    features = np.array([[dist_km, d_score, compat, 1.0 if donor.is_available else 0.0]])
                    dmatrix = xgb.DMatrix(features)
                    raw_score = float(self.xgb_model.predict(dmatrix)[0])
                    final_score = min(100.0, max(1.0, raw_score * 100.0))
                except Exception:
                    final_score = self._rule_score(compat, dist_km, donor.is_available)
            else:
                final_score = self._rule_score(compat, dist_km, donor.is_available)

            ranked.append(
                RankedDonor(
                    id=donor.id,
                    score=round(final_score, 1),
                    reasons=reasons,
                )
            )

        # Sort descending by score
        ranked.sort(key=lambda x: x.score, reverse=True)
        return ranked

    def _rule_score(self, compat: float, dist_km: float, is_avail: bool) -> float:
        score = 0.0
        score += compat * 50.0  # max 50 pts
        
        if dist_km <= 2.0:
            score += 40.0
        elif dist_km <= 5.0:
            score += 30.0
        elif dist_km <= 15.0:
            score += 20.0
        elif dist_km <= 30.0:
            score += 10.0
        else:
            score += 5.0

        if is_avail:
            score += 10.0

        return min(100.0, max(1.0, score))
