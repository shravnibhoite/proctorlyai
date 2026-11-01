import face_recognition
import numpy as np
import os
import cv2
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import DATA_DIR
from services.logger_service import logger

class FaceAuthenticator:
    def __init__(self):
        self.known_face_encodings = {}
        self.tolerance = 0.6
        
    def load_user_encodings(self, user_id, filepath):
        """Loads a face encoding from a saved numpy file for a user."""
        try:
            if os.path.exists(filepath):
                encoding = np.load(filepath)
                self.known_face_encodings[user_id] = encoding
                logger.info(f"Loaded face encoding for user {user_id}")
                return True
        except Exception as e:
            logger.error(f"Failed to load encoding for user {user_id}: {e}")
        return False

    def register_user_face(self, user_id, frame) -> tuple[str, str]:
        """Extracts face encoding and saves it to disk."""
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        face_locations = face_recognition.face_locations(rgb_frame)
        
        if len(face_locations) == 0:
            return None, "No face found in frame."
        if len(face_locations) > 1:
            return None, "Multiple faces found. Please ensure only you are visible."
            
        face_encodings = face_recognition.face_encodings(rgb_frame, face_locations)
        encoding = face_encodings[0]
        
        # Save encoding
        encoding_path = os.path.join(DATA_DIR, "registered_faces", f"user_{user_id}.npy")
        np.save(encoding_path, encoding)
        
        # Save raw image for CNN training
        image_path = os.path.join(DATA_DIR, "registered_faces", f"user_{user_id}.jpg")
        cv2.imwrite(image_path, frame)
        
        self.known_face_encodings[user_id] = encoding
        
        return encoding_path, "Success"

    def verify_face(self, frame, user_id) -> tuple[bool, str]:
        """Verifies if the face in the frame matches the registered user."""
        if user_id not in self.known_face_encodings:
            return False, "User not registered in memory."
            
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        face_locations = face_recognition.face_locations(rgb_frame)
        
        # If HOG fails, try upsampling twice to detect smaller or worse-lit faces
        if len(face_locations) == 0:
            face_locations = face_recognition.face_locations(rgb_frame, number_of_times_to_upsample=2)
            
        if len(face_locations) == 0:
            return False, "no_face"
        
        if len(face_locations) > 1:
            return False, "multiple_faces"
            
        face_encodings = face_recognition.face_encodings(rgb_frame, face_locations)
        encoding = face_encodings[0]
        
        matches = face_recognition.compare_faces(
            [self.known_face_encodings[user_id]], 
            encoding, 
            tolerance=self.tolerance
        )
        
        if matches[0]:
            return True, "verified"
        else:
            return False, "unauthorized_face"

face_authenticator = FaceAuthenticator()
