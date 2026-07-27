from prometheus_client import Counter, Histogram, Gauge

REQUEST_COUNT = Counter(
    "ml_service_requests_total",
    "Total HTTP requests to the ML Service",
    ["endpoint"]
)

REQUEST_LATENCY = Histogram(
    "ml_service_request_latency_seconds",
    "Request latency in seconds",
    ["endpoint"]
)

PREDICTION_DRIFT_GAUGE = Gauge(
    "ml_model_feature_drift_psi",
    "Population Stability Index (PSI) feature drift score",
    ["feature_name"]
)
