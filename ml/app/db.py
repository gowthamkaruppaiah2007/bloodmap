from supabase import create_client, Client
from app.config import settings
import logging

logger = logging.getLogger(__name__)

_client: Client | None = None

def get_supabase() -> Client | None:
    global _client
    if _client is not None:
        return _client
    
    if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_ROLE_KEY:
        logger.warning("Supabase credentials not configured in ML Service.")
        return None
        
    try:
        _client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)
        return _client
    except Exception as e:
        logger.error(f"Failed to connect to Supabase: {e}")
        return None
