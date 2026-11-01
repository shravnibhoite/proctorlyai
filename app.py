import base64
import cv2
import numpy as np
import os
import uvicorn
import time
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, HTTPException, UploadFile, File
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from contextlib import asynccontextmanager
from pydantic import BaseModel

from config import Config, DATA_DIR
from database.db import get_db, init_db, User, ExamSession, IncidentEvent, Exam, ExamQuestion, StudentExam, Settings
from services.exam_session import exam_manager
from services.screenshot_service import save_screenshot
from services.logger_service import logger
from services.admin_manager import admin_manager
from reporting.pdf_report import generate_pdf_report
from detection.face_auth import face_authenticator
from detection.gaze_headpose import gaze_detector
from detection.yolo_detector import object_detector
from detection.audio_monitor import audio_monitor

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup Setup
    logger.info("Initializing Database...")
    init_db()
    yield
    # Shutdown Cleanup
    logger.info("Shutting down...")

app = FastAPI(title="Proctorly AI", lifespan=lifespan)

# Setup CORS for frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static Files serving
FRONTEND_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "frontend")
if not os.path.exists(FRONTEND_DIR):
    os.makedirs(FRONTEND_DIR, exist_ok=True)
    os.makedirs(os.path.join(FRONTEND_DIR, "css"), exist_ok=True)
    os.makedirs(os.path.join(FRONTEND_DIR, "js"), exist_ok=True)
    
app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")

@app.get("/")
def serve_index():
    return HTMLResponse(content=open(os.path.join(FRONTEND_DIR, "login.html")).read())

@app.get("/register")
def serve_register():
    return HTMLResponse(content=open(os.path.join(FRONTEND_DIR, "register.html")).read())

@app.get("/dashboard")
def serve_dashboard():
    return HTMLResponse(content=open(os.path.join(FRONTEND_DIR, "index.html")).read())
    
@app.get("/admin")
def serve_admin():
    return HTMLResponse(content=open(os.path.join(FRONTEND_DIR, "admin.html")).read())

# ----------------- MODELS ----------------- #

class SignupRequest(BaseModel):
    username: str
    full_name: str
    password: str
    role: str = "student"

class LoginRequest(BaseModel):
    username: str
    password: str

# ----------------- REST ENDPOINTS ----------------- #

@app.post("/api/signup")
async def signup(request: SignupRequest, db: Session = Depends(get_db)):
    try:
        # Check if username exists
        existing_user = db.query(User).filter(User.username == request.username).first()
        if existing_user:
            raise HTTPException(status_code=400, detail="Username already exists")
            
        new_user = User(
            username=request.username,
            full_name=request.full_name,
            password=request.password, # For demo, storing plain text; add hashing in prod
            role=request.role
        )
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        return {"user_id": new_user.id, "message": "Signup successful"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class LoginRequestWithRole(BaseModel):
    username: str
    password: str
    role: str

@app.post("/api/login")
async def login(request: LoginRequestWithRole, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == request.username, User.password == request.password).first()
    
    if not user:
        raise HTTPException(status_code=401, detail="Invalid username or password")
        
    if user.role != request.role:
        raise HTTPException(status_code=403, detail=f"This account is not a {request.role} account.")
        
    return {
        "user_id": user.id, 
        "username": user.username, 
        "full_name": user.full_name,
        "role": user.role,
        "has_face": user.face_encoding_path is not None
    }

@app.post("/api/verify_face_id/{user_id}")
async def verify_face_id(user_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    """Strict 1:1 face verification before exam start."""
    contents = await file.read()
    nparr = np.frombuffer(contents, np.uint8)
    frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    
    encoding_path = os.path.join(DATA_DIR, "registered_faces", f"user_{user_id}.npy")
    face_authenticator.load_user_encodings(user_id, encoding_path)
    is_auth, msg = face_authenticator.verify_face(frame, user_id)
    
    if is_auth:
        return {"status": "success", "message": "Face ID verified"}
    else:
        raise HTTPException(status_code=401, detail="Face ID verification failed")


@app.post("/api/register_face/{user_id}")
async def register_face(user_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    """Uploads a face image for biometric auth."""
    contents = await file.read()
    nparr = np.frombuffer(contents, np.uint8)
    frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    
    filepath, msg = face_authenticator.register_user_face(user_id, frame)
    if not filepath:
        raise HTTPException(status_code=400, detail=msg)
    
    return {"message": "Face registered successfully"}

@app.get("/api/sessions")
def get_sessions(db: Session = Depends(get_db)):
    sessions = db.query(ExamSession).order_by(ExamSession.start_time.desc()).all()
    result = []
    for s in sessions:
        user = db.query(User).filter(User.id == s.user_id).first()
        result.append({
            "id": s.id,
            "username": user.username if user else "Unknown",
            "status": s.status,
            "start_time": s.start_time,
            "end_time": s.end_time,
            "risk_score": s.final_risk_score
        })
    return result

@app.get("/api/sessions/{session_id}/report")
def get_report(session_id: int, db: Session = Depends(get_db)):
    filename = f"report_session_{session_id}.pdf"
    filepath = os.path.join(DATA_DIR, "reports", filename)
    if os.path.exists(filepath):
        return FileResponse(filepath, media_type="application/pdf", filename=filename)
    raise HTTPException(status_code=404, detail="Report not generated for this session")

# ----------------- ADMIN API ENDPOINTS ----------------- #

@app.get("/api/admin/stats")
def get_admin_stats(db: Session = Depends(get_db)):
    total_students = db.query(User).filter(User.role == "student").count()
    active_exams = db.query(ExamSession).filter(ExamSession.status == "ongoing").count()
    flagged_students = db.query(ExamSession).filter(ExamSession.status == "flagged").count()
    return {
        "total_students": total_students,
        "active_exams": active_exams,
        "flagged_students": flagged_students
    }

class ExamCreateRequest(BaseModel):
    subject: str
    duration_minutes: int
    exam_code: str
    questions_count: int = 0

@app.post("/api/exams")
def create_exam(request: ExamCreateRequest, db: Session = Depends(get_db)):
    new_exam = Exam(
        subject=request.subject,
        duration_minutes=request.duration_minutes,
        exam_code=request.exam_code,
        created_by=999 # Using mock user_id for now
    )
    db.add(new_exam)
    db.commit()
    db.refresh(new_exam)
    return {"message": "Exam created successfully", "exam_id": new_exam.id}

@app.get("/api/exams")
def get_exams(db: Session = Depends(get_db)):
    exams = db.query(Exam).all()
    return [
        {
            "id": e.id,
            "subject": e.subject,
            "duration_minutes": e.duration_minutes,
            "exam_code": e.exam_code,
            "status": e.status
        } for e in exams
    ]

@app.get("/api/students")
def get_students(db: Session = Depends(get_db)):
    students = db.query(User).filter(User.role == "student").all()
    return [{"id": s.id, "username": s.username, "full_name": s.full_name} for s in students]

@app.get("/api/settings")
def get_settings(db: Session = Depends(get_db)):
    settings = db.query(Settings).all()
    return {s.key: s.value for s in settings}

class SettingUpdateRequest(BaseModel):
    key: str
    value: str

@app.put("/api/settings")
def update_settings(request: SettingUpdateRequest, db: Session = Depends(get_db)):
    setting = db.query(Settings).filter(Settings.key == request.key).first()
    if setting:
        setting.value = request.value
    else:
        setting = Settings(key=request.key, value=request.value)
        db.add(setting)
    db.commit()
    return {"message": "Setting updated"}

# ----------------- WEBSOCKET ENDPOINTS ----------------- #

@app.websocket("/ws/proctor/{user_id}")
async def proctor_websocket(websocket: WebSocket, user_id: int, db: Session = Depends(get_db)):
    await websocket.accept()
    
    encoding_path = os.path.join(DATA_DIR, "registered_faces", f"user_{user_id}.npy")
    # Don't strictly crash if encoding doesn't exist, handle it
    if os.path.exists(encoding_path):
        face_authenticator.load_user_encodings(user_id, encoding_path)
    
    session = exam_manager.start_session(db, user_id)
    session_id = session.id
    username = db.query(User).filter(User.id == user_id).first().username if db.query(User).filter(User.id == user_id).first() else f"User {user_id}"

    
    await websocket.send_json({"message": "Exam started", "session_id": session_id})
    frame_count = 0
    look_away_start_time = None
    missing_face_start_time = None
    
    try:
        while True:
            data = await websocket.receive_json()
            
            if "frame" in data:
                b64_data = data["frame"].split(",")[-1]
                nparr = np.frombuffer(base64.b64decode(b64_data), np.uint8)
                frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
                
                # Broadcast raw frame to admin dashboard
                await admin_manager.broadcast({
                    "type": "video_frame",
                    "user_id": user_id,
                    "username": username,
                    "frame": data["frame"],
                    "status": "normal"
                })

                # We analyze only every N frames to save CPU in real-time
                frame_count += 1
                if frame_count % 2 != 0:
                    continue
                
                # 1. Face Auth
                is_auth, auth_msg = face_authenticator.verify_face(frame, user_id)
                if not is_auth:
                    if missing_face_start_time is None:
                        missing_face_start_time = time.time()
                    elif time.time() - missing_face_start_time >= 3.0:
                        path = save_screenshot(frame, session_id, "unauthorized_face")
                        event = exam_manager.log_event(db, session_id, auth_msg, "Face verification failed", path, 0.9)
                        await websocket.send_json({"alert": auth_msg, "severity": event.severity if event else 0})
                        await admin_manager.broadcast({"type": "alert", "user_id": user_id, "username": username, "alert": auth_msg, "severity": "high", "frame": data["frame"]})
                        missing_face_start_time = None
                    continue 
                else:
                    missing_face_start_time = None
                
                # 2. Gaze Detection
                is_looking_away, gaze_msg = gaze_detector.detect(frame)
                if is_looking_away:
                    if look_away_start_time is None:
                        look_away_start_time = time.time()
                    elif time.time() - look_away_start_time >= 3.0:
                        path = save_screenshot(frame, session_id, "looking_away")
                        event = exam_manager.log_event(db, session_id, "looking_away", gaze_msg, path, 0.7)
                        await websocket.send_json({"alert": gaze_msg, "detail": "User looked away from the screen."})
                        await admin_manager.broadcast({"type": "alert", "user_id": user_id, "username": username, "alert": gaze_msg, "severity": "medium", "frame": data["frame"]})
                        look_away_start_time = None
                else:
                    look_away_start_time = None
                    
                # 3. Object Detection (YOLO)
                has_violation, obj_msg, conf = object_detector.detect(frame)
                if has_violation:
                    path = save_screenshot(frame, session_id, obj_msg)
                    event = exam_manager.log_event(db, session_id, obj_msg, f"Detected: {obj_msg}", path, conf)
                    await websocket.send_json({"alert": obj_msg, "detail": "Unauthorized object/person detected"})
                    await admin_manager.broadcast({"type": "alert", "user_id": user_id, "username": username, "alert": f"Detected: {obj_msg}", "severity": "high", "frame": data["frame"]})
                    
            if "audio" in data:
                b64_audio = data["audio"]
                audio_bytes = base64.b64decode(b64_audio)
                has_noise, noise_msg, conf = audio_monitor.analyze_audio_chunk(audio_bytes)
                if has_noise:
                    event = exam_manager.log_event(db, session_id, noise_msg, "Talking or loud noise detected", None, conf)
                    await websocket.send_json({"alert": noise_msg, "detail": "Speech detected"})
                    await admin_manager.broadcast({"type": "alert", "user_id": user_id, "username": username, "alert": "Speech Detected", "severity": "medium"})

    except WebSocketDisconnect:
        logger.info(f"Client disconnected from lesson {session_id}")
        await admin_manager.broadcast({"type": "disconnect", "user_id": user_id, "username": username})
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        # Wrap up session processing
        ended_session = exam_manager.end_session(db, session_id)
        events = db.query(IncidentEvent).filter(IncidentEvent.session_id == session_id).all()
        report_path = generate_pdf_report(ended_session, events)
        logger.info(f"Generated report at {report_path}")

@app.websocket("/ws/admin/monitor")
async def admin_monitor_websocket(websocket: WebSocket, db: Session = Depends(get_db)):
    await admin_manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            # Admin might send commands in the future
    except WebSocketDisconnect:
        admin_manager.disconnect(websocket)


if __name__ == "__main__":
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
    # Triggering hot-reload to clear DB from memory
