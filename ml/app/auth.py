from fastapi import Security, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.config import settings

security = HTTPBearer(auto_error=False)

def verify_api_key(credentials: HTTPAuthorizationCredentials = Security(security)):
    """Check Bearer token against ML_API_KEY if key is configured."""
    if not settings.ML_API_KEY or settings.ML_API_KEY == "secret-ml-key-change-me":
        # Allow requests if default key or unconfigured in dev
        return True
    
    if not credentials or credentials.credentials != settings.ML_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing ML_API_KEY Bearer token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return True
