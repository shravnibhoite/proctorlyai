import os
import cv2
from datetime import datetime
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import DATA_DIR
from services.logger_service import logger

def save_screenshot(frame, session_id: int, event_type: str) -> str:
    """Saves a frame to the screenshots directory and returns the path."""
    try:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
        filename = f"session_{session_id}_{event_type}_{timestamp}.jpg"
        filepath = os.path.join(DATA_DIR, "screenshots", filename)
        
        cv2.imwrite(filepath, frame)
        logger.info(f"Saved screenshot to {filepath}")
        return filepath
    except Exception as e:
        logger.error(f"Failed to save screenshot: {str(e)}")
        return None
