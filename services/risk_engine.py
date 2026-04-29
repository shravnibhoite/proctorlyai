import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import Config
from services.logger_service import logger

class RiskEngine:
    def __init__(self):
        self.weights = Config.EVENT_WEIGHTS
        self.risk_threshold = Config.RISK_THRESHOLD

    def calculate_event_severity(self, event_type: str, confidence: float = 1.0) -> float:
        """Calculates severity for a specific event type."""
        base_weight = self.weights.get(event_type, 0)
        return min(base_weight * confidence, 100.0)

    def calculate_session_risk(self, events: list) -> float:
        """Calculates total risk score for a session based on all events."""
        if not events:
            return 0.0
            
        total_risk = sum([event.severity for event in events])
        return min(total_risk, 100.0)
        
    def is_flagged(self, current_risk: float) -> bool:
        return current_risk >= self.risk_threshold

risk_engine = RiskEngine()
