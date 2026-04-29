from ultralytics import YOLO
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from services.logger_service import logger

class ObjectDetector:
    def __init__(self):
        try:
            # We use yolov8n for speed in real-time
            self.model = YOLO('yolov8n.pt') 
            logger.info("Loaded YOLOv8 model successfully")
        except Exception as e:
            logger.error(f"Failed to load YOLO model: {e}")
            self.model = None

    def detect(self, frame) -> tuple[bool, str, float]:
        """Returns (has_violation, violation_type, max_confidence)"""
        if self.model is None:
            return False, "Model not loaded", 0.0
            
        results = self.model(frame, verbose=False)
        person_count = 0
        phone_detected = False
        max_phone_conf = 0.0
        
        for result in results:
            boxes = result.boxes
            for box in boxes:
                cls_id = int(box.cls[0])
                conf = float(box.conf[0])
                name = result.names[cls_id]
                
                if name == 'person' and conf > 0.6:
                    person_count += 1
                elif name == 'cell phone' and conf > 0.4:
                    phone_detected = True
                    max_phone_conf = max(max_phone_conf, conf)
                    
        if phone_detected:
            return True, "mobile_phone", max_phone_conf
        if person_count > 1:
            return True, "multiple_faces", 1.0 # High confidence if multiple detected
            
        return False, "normal", 0.0

object_detector = ObjectDetector()
