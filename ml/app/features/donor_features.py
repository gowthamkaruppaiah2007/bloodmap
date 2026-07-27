from typing import Dict, Any

def compute_donor_features(donor: Dict[str, Any], req_lat: float, req_lng: float, req_blood: str) -> Dict[str, float]:
    """Generates feature vector for donor-request pair."""
    from app.features.compatibility import get_compatibility_score
    from app.features.distance import haversine_km, distance_score

    dist_km = haversine_km(req_lat, req_lng, donor["latitude"], donor["longitude"])
    compat_score = get_compatibility_score(donor["blood_group"], req_blood)
    dist_sc = distance_score(dist_km)
    avail_flag = 1.0 if donor.get("is_available", True) else 0.0

    return {
        "dist_km": dist_km,
        "dist_score": dist_sc,
        "compat_score": compat_score,
        "avail_flag": avail_flag,
        "response_rate": donor.get("response_rate", 0.85),
    }
