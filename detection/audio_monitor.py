import numpy as np
import audioop

class AudioMonitor:
    def __init__(self):
        self.threshold = 1000  # Typical volume threshold, will need tuning

    def analyze_audio_chunk(self, audio_bytes: bytes) -> tuple[bool, str, float]:
        """Analyzes a chunk of PCM 16-bit audio data for loud noises."""
        try:
            if not audio_bytes:
                return False, "normal", 0.0
                
            rms = audioop.rms(audio_bytes, 2)
            if rms > self.threshold:
                # Calculate a rough confidence
                confidence = min((rms - self.threshold) / 2000, 1.0)
                return True, "audio_speech", confidence
        except Exception:
            pass
            
        return False, "normal", 0.0

audio_monitor = AudioMonitor()
