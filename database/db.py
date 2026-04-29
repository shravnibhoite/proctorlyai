from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, ForeignKey, Text
from sqlalchemy.orm import declarative_base, sessionmaker, relationship
from datetime import datetime
import sys
import os

# Add parent dir to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import Config

engine = create_engine(Config.DATABASE_URI, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True)
    password = Column(String(100)) # Simple storage for demo
    full_name = Column(String(100))
    role = Column(String(20), default="student") # student, admin
    face_encoding_path = Column(String(200), nullable=True) # Path to saved encoding

class ExamSession(Base):
    __tablename__ = "exam_sessions"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    start_time = Column(DateTime, default=datetime.utcnow)
    end_time = Column(DateTime, nullable=True)
    status = Column(String(20), default="ongoing") # ongoing, completed, flagged
    final_risk_score = Column(Float, default=0.0)
    
    user = relationship("User")
    events = relationship("IncidentEvent", back_populates="session", cascade="all, delete-orphan")

class IncidentEvent(Base):
    __tablename__ = "incident_events"
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("exam_sessions.id"))
    timestamp = Column(DateTime, default=datetime.utcnow)
    event_type = Column(String(50)) # e.g., 'multiple_faces', 'mobile_phone', 'no_face', 'looking_away'
    severity = Column(Float) # 0.0 to 100.0 based on Config
    description = Column(Text)
    screenshot_path = Column(String(200), nullable=True)
    
    session = relationship("ExamSession", back_populates="events")

class Exam(Base):
    __tablename__ = "exams"
    id = Column(Integer, primary_key=True, index=True)
    subject = Column(String(100))
    duration_minutes = Column(Integer)
    created_by = Column(Integer, ForeignKey("users.id"))
    scheduled_time = Column(DateTime, nullable=True)
    exam_code = Column(String(20), unique=True, index=True)
    status = Column(String(20), default="active") # active, completed
    
    questions = relationship("ExamQuestion", back_populates="exam", cascade="all, delete-orphan")

class ExamQuestion(Base):
    __tablename__ = "exam_questions"
    id = Column(Integer, primary_key=True, index=True)
    exam_id = Column(Integer, ForeignKey("exams.id"))
    question_text = Column(Text)
    question_type = Column(String(20)) # mcq, subjective
    options = Column(Text, nullable=True) # JSON string for MCQ options
    correct_answer = Column(Text, nullable=True)
    
    exam = relationship("Exam", back_populates="questions")

class StudentExam(Base):
    __tablename__ = "student_exams"
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("users.id"))
    exam_id = Column(Integer, ForeignKey("exams.id"))
    status = Column(String(20), default="assigned") # assigned, completed

class Settings(Base):
    __tablename__ = "settings"
    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(50), unique=True, index=True)
    value = Column(String(200))

def init_db():
    Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
