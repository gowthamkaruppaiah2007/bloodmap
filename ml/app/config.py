import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "BloodMap AI ML Service"
    VERSION: str = "1.0.0"
    API_PREFIX: str = ""
    
    # Auth
    ML_API_KEY: str = os.getenv("ML_API_KEY", "secret-ml-key-change-me")
    
    # Supabase
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "https://sifwzveymuebfucqtwat.supabase.co")
    SUPABASE_SERVICE_ROLE_KEY: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    
    # Model storage
    MODEL_DIR: str = os.getenv("MODEL_DIR", "./models_data")
    
    class Config:
        case_sensitive = True

settings = Settings()
