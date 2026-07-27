import os
import pandas as pd
import logging
from app.db import get_supabase

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("pipelines.extract")

def extract_data(output_dir: str = "./data/raw"):
    os.makedirs(output_dir, exist_ok=True)
    supabase = get_supabase()
    
    if not supabase:
        logger.warning("Supabase client unavailable. Generating synthetic raw datasets.")
        df_donors = pd.DataFrame([
            {"id": f"d_{i}", "blood_group": "O+", "latitude": 12.97, "longitude": 77.59, "is_available": True}
            for i in range(100)
        ])
        df_donors.to_parquet(os.path.join(output_dir, "donors.parquet"))
        return

    logger.info("Extracting tables from Supabase...")
    for table in ["donors", "blood_requests", "request_responses", "donations"]:
        try:
            res = supabase.table(table).select("*").execute()
            df = pd.DataFrame(res.data)
            df.to_parquet(os.path.join(output_dir, f"{table}.parquet"))
            logger.info(f"Extracted {len(df)} rows from {table}")
        except Exception as e:
            logger.error(f"Error extracting {table}: {e}")

if __name__ == "__main__":
    extract_data()
