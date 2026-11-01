
from ultralytics import YOLO
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.logger_service import logger


class ObjectDetector:
    def __init__(self):
        try:
            # YOLOv8 nano model for real-time detection
            self.model = YOLO("yolov8n.pt")
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
        detected_objects = []
        max_confidence = 0.0

        for result in results:
            for box in result.boxes:
                cls_id = int(box.cls[0])
                conf = float(box.conf[0])
                name = result.names[cls_id]

                if name == "person" and conf > 0.6:
                    person_count += 1

                elif name in [
                    "cell phone",
                    "laptop",
                    "book",
                    "mouse",
                    "keyboard",
                    "remote",
                    "tv"
                ] and conf > 0.4:

                    detected_objects.append(name)
                    max_confidence = max(max_confidence, conf)

        if "cell phone" in detected_objects:
            return True, "mobile_phone", max_confidence

        if detected_objects:
            return True, detected_objects[0], max_confidence

        if person_count > 1:
            return True, "multiple_faces", 1.0

        return False, "normal", 0.0


object_detector = ObjectDetector()
