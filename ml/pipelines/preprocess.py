import os
import pandas as pd
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("pipelines.preprocess")

def preprocess_data(raw_dir: str = "./data/raw", processed_dir: str = "./data/processed"):
    os.makedirs(processed_dir, exist_ok=True)
    logger.info("Preprocessing raw datasets...")
    
    donors_file = os.path.join(raw_dir, "donors.parquet")
    if os.path.exists(donors_file):
        df_donors = pd.read_parquet(donors_file)
        df_donors.to_parquet(os.path.join(processed_dir, "clean_donors.parquet"))
        logger.info(f"Processed {len(df_donors)} donors.")

if __name__ == "__main__":
    preprocess_data()
