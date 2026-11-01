class BehaviorCNN:
    def __init__(self):
        self.enabled = False
        
    def predict(self, frame) -> tuple[bool, str, float]:
        # Placeholder for custom CNN prediction behavior
        return False, "normal", 0.0

behavior_cnn = BehaviorCNN()
