import os
import numpy as np
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("pipelines.train_matcher")

def train_matcher_model(output_dir: str = "./models_data/current"):
    os.makedirs(output_dir, exist_ok=True)
    logger.info("Training Donor Matcher model (XGBoost LTR)...")

    try:
        import xgboost as xgb
        # Synthetic dataset for initial training bootstrap
        X = np.random.rand(200, 4)  # [dist_km, dist_score, compat_score, avail_flag]
        y = (X[:, 1] * 0.4 + X[:, 2] * 0.5 + X[:, 3] * 0.1 > 0.5).astype(int)

        dtrain = xgb.DMatrix(X, label=y)
        params = {
            "objective": "binary:logistic",
            "eval_metric": "logloss",
            "max_depth": 4,
            "eta": 0.1,
        }
        bst = xgb.train(params, dtrain, num_boost_round=20)
        
        save_path = os.path.join(output_dir, "matcher.xgb")
        bst.save_model(save_path)
        logger.info(f"Successfully trained and saved matcher model to {save_path}")
    except Exception as e:
        logger.error(f"Failed to train matcher model: {e}")

if __name__ == "__main__":
    train_matcher_model()
