import os
from typing import Optional

class APIConfig:
    """Configuration class for Google Safe Browsing API"""
    
    def __init__(self):
        self.GOOGLE_SAFE_BROWSING_API_KEY: Optional[str] = os.getenv('GOOGLE_SAFE_BROWSING_API_KEY')
        
        if not self.GOOGLE_SAFE_BROWSING_API_KEY:
            self.GOOGLE_SAFE_BROWSING_API_KEY = "Your API Key Here"
    
    def validate_key(self) -> dict:
        """Check if API key is properly configured"""
        return {
            'google_safe_browsing_configured': bool(
                self.GOOGLE_SAFE_BROWSING_API_KEY and 
                self.GOOGLE_SAFE_BROWSING_API_KEY != "Your API Key Here"
            ),
            'api_key_length': len(self.GOOGLE_SAFE_BROWSING_API_KEY) if self.GOOGLE_SAFE_BROWSING_API_KEY else 0
        }

config = APIConfig()