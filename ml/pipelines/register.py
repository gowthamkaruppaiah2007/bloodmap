import os
import shutil
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("pipelines.register")

def register_model(src_dir: str = "./models_data/current", version: str = "1.0.0"):
    logger.info(f"Registering model version {version}...")
    dest_dir = f"./models_data/v_{version}"
    os.makedirs(dest_dir, exist_ok=True)
    if os.path.exists(src_dir):
        for f in os.listdir(src_dir):
            shutil.copy(os.path.join(src_dir, f), os.path.join(dest_dir, f))
    logger.info(f"Model version {version} registered to {dest_dir}")

if __name__ == "__main__":
    register_model()
