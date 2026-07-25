# BloodMap AI — ML & MLOps Plan

Splitting into two deliverables that ship together: **(1) data schema + Lovable-side integration** (fully built here) and **(2) a self-contained Python ML service** you deploy externally (scaffolded here, ready to `docker build`).

## 1. Database schema (migration)

New tables under `public` with RLS + GRANTs:

- **`hospitals`** — name, address, lat, lng, phone, verified, `created_by`.
- **`blood_requests`** — requester (`user_id`), optional `hospital_id`, `blood_group`, `units_needed`, `urgency` (`low|normal|high|critical`), `patient_name`, `reason`, `lat`, `lng`, `needed_by`, `status` (`open|matched|fulfilled|cancelled|expired`), `notes`.
- **`donations`** — `donor_id` (fk `donors.id`), `request_id` (nullable fk `blood_requests.id`), `donated_at`, `units`, `hospital_id`, `notes`. Feeds donation-history + response-rate features.
- **`request_responses`** — `request_id`, `donor_id`, `status` (`invited|accepted|declined|no_response|completed`), `responded_at`. Powers response-rate feature + matching feedback loop.
- **`ml_predictions`** — audit log: `model_name`, `model_version`, `input_hash`, `output` jsonb, `latency_ms`, `created_at`. Used for monitoring/drift.

RLS: owners manage their own rows; authenticated users can read open `blood_requests` in their region via a `SECURITY DEFINER` RPC (mirrors the donor pattern already in the project). GRANTs on every table.

## 2. Lovable-side integration (this repo)

- `src/lib/ml.functions.ts` — `createServerFn` wrappers that POST to the Python service using `process.env.ML_API_URL` + `ML_API_KEY` (added via `add_secret`).
  - `matchDonorsForRequest({ requestId })` → returns ranked donors with score + reasons.
  - `forecastDemand({ region, bloodGroup, horizonDays })` → returns time-series forecast.
  - `logPrediction(...)` → inserts into `ml_predictions` for monitoring.
- `src/routes/_authenticated/requests.tsx` — create + list blood requests.
- `src/routes/_authenticated/requests.$id.tsx` — request detail with **AI-ranked donor matches** (calls `matchDonorsForRequest`), WhatsApp invite buttons that write `request_responses`.
- `src/routes/_authenticated/forecast.tsx` — demand-forecast dashboard (line chart of predicted requests per blood group).
- Graceful fallback: if `ML_API_URL` is unset or the service is down, matching falls back to a deterministic scorer (blood-group compatibility + haversine distance + availability), so the app never breaks.

## 3. Python ML service (scaffolded under `/ml`, you deploy)

Complete, runnable FastAPI app. Ready for Render / Railway / Fly / HF Spaces.

```
ml/
├── app/
│   ├── main.py                  # FastAPI: /health /match /forecast /retrain /metrics
│   ├── auth.py                  # ML_API_KEY bearer check
│   ├── config.py                # env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, MODEL_DIR
│   ├── db.py                    # supabase-py client for pulling training data
│   ├── schemas.py               # Pydantic request/response models
│   ├── models/
│   │   ├── matcher.py           # DonorMatcher: rules v1 + XGBoost LTR v2
│   │   └── forecaster.py        # DemandForecaster: Prophet + XGBoost fallback
│   └── features/
│       ├── compatibility.py     # ABO/Rh compatibility matrix
│       ├── distance.py          # haversine
│       └── donor_features.py    # response_rate, last_donation_days, availability
├── pipelines/
│   ├── extract.py               # Pull rows from Supabase → parquet
│   ├── preprocess.py            # Clean + feature engineer
│   ├── train_matcher.py         # Train LTR on request_responses (accepted=positive)
│   ├── train_forecaster.py      # Train per-(region, blood_group) Prophet models
│   ├── evaluate.py              # NDCG@k for matcher, MAPE/SMAPE for forecaster
│   └── register.py              # Version + save to MODEL_DIR (or S3 if configured)
├── monitoring/
│   ├── drift.py                 # PSI on features, log to ml_predictions summary
│   └── metrics.py               # Prometheus /metrics endpoint
├── tests/
│   ├── test_compatibility.py
│   ├── test_matcher.py
│   └── test_forecaster.py
├── notebooks/
│   └── 01_public_dataset_pretrain.ipynb   # Bootstrap with a public Kaggle blood-donation dataset
├── .github/workflows/
│   ├── ci.yml                   # lint + pytest on PR
│   └── retrain.yml              # weekly cron: extract → train → evaluate → register → redeploy
├── Dockerfile
├── docker-compose.yml           # local dev with mock Supabase
├── requirements.txt             # fastapi, uvicorn, xgboost, prophet, pandas, scikit-learn, supabase, prometheus-client
├── Makefile                     # make train / make serve / make test
└── README.md                    # deploy instructions for Render/Railway/Fly/HF Spaces
```

### Endpoints

- `POST /match` — input: request features + candidate donors → ranked list with score + explanation.
- `POST /forecast` — input: region, blood_group, horizon → daily forecast + confidence interval.
- `POST /retrain` — trigger retraining (protected). Called weekly by GitHub Actions or by Lovable cron.
- `GET /health`, `GET /metrics` — for uptime + Prometheus.

### MLOps loop

1. **Extract** nightly from Supabase (`donors`, `donations`, `blood_requests`, `request_responses`).
2. **Preprocess** → feature store (parquet in `MODEL_DIR` or S3).
3. **Train** matcher + forecaster.
4. **Evaluate** vs. holdout; only promote if metrics beat current champion.
5. **Register** new version; FastAPI hot-reloads from `MODEL_DIR/current/`.
6. **Monitor** live predictions → PSI drift alerts + accuracy backtests.

## 4. Secrets

- `ML_API_URL` — your deployed service URL (added via `add_secret` after you deploy).
- `ML_API_KEY` — shared secret between Lovable server fns and the FastAPI service (generated).

## 5. Order of operations in this build

1. Migration for the 5 new tables (needs your approval).
2. Once approved, write server functions + routes + UI.
3. Write the entire `/ml/` Python service.
4. Add `ML_API_URL` / `ML_API_KEY` secrets (I'll prompt).
5. Give you a `README.md` walkthrough for deploying `/ml/` to Render (recommended) with the exact env vars to set.

## Notes / trade-offs

- Until real usage accumulates, both models fall back to **rules-based scoring** (compatibility + distance + availability) and **synthetic/public-dataset pre-training**. Real ML kicks in after ~a few hundred `request_responses`.
- Prophet is heavier than XGBoost; the service ships both and picks by data volume per (region, blood_group).
- The Python service is **stateless** except for `MODEL_DIR`; mount a volume or use S3 for persistence across deploys.
- No PII leaves Lovable → ML service; only feature vectors (blood group, coords, aggregate stats) are sent.

Approve to proceed and I'll start with the migration.
