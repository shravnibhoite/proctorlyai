import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
DB_PATH = os.path.join(BASE_DIR, "database", "proctorly.db")

# Ensure required directories exist for artifacts
os.makedirs(os.path.join(DATA_DIR, "models"), exist_ok=True)
os.makedirs(os.path.join(DATA_DIR, "registered_faces"), exist_ok=True)
os.makedirs(os.path.join(DATA_DIR, "reports"), exist_ok=True)
os.makedirs(os.path.join(DATA_DIR, "screenshots"), exist_ok=True)

class Config:
    DATABASE_URI = f"sqlite:///{DB_PATH}"
    SECRET_KEY = "proctorly_super_secret_key_change_in_production"
    # Risk threshold configuration out of 100
    RISK_THRESHOLD = 75
    # Default severity weights for different events
    EVENT_WEIGHTS = {
        "mobile_phone": 40,
        "multiple_faces": 35,
        "no_face": 25,
        "looking_away": 10,
        "audio_speech": 20
    }
