import sys
import os
from datetime import datetime
from sqlalchemy.orm import Session

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from database.db import ExamSession, IncidentEvent
from services.risk_engine import risk_engine
from services.logger_service import logger

class ExamSessionManager:
    def start_session(self, db: Session, user_id: int) -> ExamSession:
        new_session = ExamSession(user_id=user_id, status="ongoing")
        db.add(new_session)
        db.commit()
        db.refresh(new_session)
        logger.info(f"Started exam session {new_session.id} for user {user_id}")
        return new_session

    def end_session(self, db: Session, session_id: int) -> ExamSession:
        session = db.query(ExamSession).filter(ExamSession.id == session_id).first()
        if session:
            session.end_time = datetime.utcnow()
            
            # Recalculate final risk score
            events = db.query(IncidentEvent).filter(IncidentEvent.session_id == session_id).all()
            final_risk = risk_engine.calculate_session_risk(events)
            session.final_risk_score = final_risk
            
            if risk_engine.is_flagged(final_risk):
                session.status = "flagged"
            else:
                session.status = "completed"
                
            db.commit()
            db.refresh(session)
            logger.info(f"Ended exam session {session_id} with status {session.status} and risk {session.final_risk_score}")
        return session

    def log_event(self, db: Session, session_id: int, event_type: str, description: str, screenshot_path: str = None, confidence: float = 1.0) -> IncidentEvent:
        session = db.query(ExamSession).filter(ExamSession.id == session_id).first()
        if not session or session.status != "ongoing":
            logger.warning(f"Attempted to log event for invalid or inactive session {session_id}")
            return None
            
        severity = risk_engine.calculate_event_severity(event_type, confidence)
        
        new_event = IncidentEvent(
            session_id=session_id,
            event_type=event_type,
            severity=severity,
            description=description,
            screenshot_path=screenshot_path
        )
        db.add(new_event)
        
        # Update session risk score
        events = db.query(IncidentEvent).filter(IncidentEvent.session_id == session_id).all()
        events.append(new_event) # Include current event
        current_risk = risk_engine.calculate_session_risk(events)
        session.final_risk_score = current_risk
        
        if risk_engine.is_flagged(current_risk):
            session.status = "flagged"
            
        db.commit()
        db.refresh(new_event)
        logger.info(f"Logged event {event_type} for session {session_id} (Severity: {severity})")
        return new_event

exam_manager = ExamSessionManager()
