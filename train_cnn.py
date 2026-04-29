import os
import cv2
import numpy as np
import tensorflow as tf
import keras
from keras import layers, models
from config import DATA_DIR
from services.logger_service import logger

# Paths
REGISTERED_FACES_DIR = os.path.join(DATA_DIR, "registered_faces")
MODEL_SAVE_PATH = os.path.join(DATA_DIR, "models", "proctorly_cnn_model.h5")

def load_data():
    """Loads saved face images for training."""
    images = []
    labels = []
    
    # Try loading .jpg files first
    files = [f for f in os.listdir(REGISTERED_FACES_DIR) if f.endswith(".jpg")]
    
    if not files:
        logger.warning("No registered face images (.jpg) found. Falling back to encodings (.npy) if any.")
        # Fallback to encodings if no images (for backward compatibility during transition)
        files = [f for f in os.listdir(REGISTERED_FACES_DIR) if f.endswith(".npy")]
        if not files:
            return None, None
        
        for filename in files:
            encoding = np.load(os.path.join(REGISTERED_FACES_DIR, filename))
            images.append(encoding) # This isn't ideal but keeps it running
            user_id = int(filename.split("_")[1].split(".")[0])
            labels.append(user_id)
        return np.array(images), np.array(labels)
    
    for filename in files:
        try:
            img_path = os.path.join(REGISTERED_FACES_DIR, filename)
            img = cv2.imread(img_path)
            img = cv2.resize(img, (128, 128))
            img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
            images.append(img)
            user_id = int(filename.split("_")[1].split(".")[0])
            labels.append(user_id)
        except Exception as e:
            logger.error(f"Error loading {filename}: {e}")
            
    return np.array(images) / 255.0, np.array(labels)

def build_model(input_shape, num_classes):
    """CNN model for image classification."""
    if len(input_shape) == 1: # Fallback for encodings
        model = models.Sequential([
            layers.Input(shape=input_shape),
            layers.Dense(64, activation='relu'),
            layers.Dropout(0.2),
            layers.Dense(32, activation='relu'),
            layers.Dense(num_classes, activation='softmax')
        ])
    else: # Proper CNN for images
        model = models.Sequential([
            layers.Conv2D(32, (3, 3), activation='relu', input_shape=input_shape),
            layers.MaxPooling2D((2, 2)),
            layers.Conv2D(64, (3, 3), activation='relu'),
            layers.MaxPooling2D((2, 2)),
            layers.Flatten(),
            layers.Dense(64, activation='relu'),
            layers.Dense(num_classes, activation='softmax')
        ])
    
    model.compile(optimizer='adam',
                  loss='sparse_categorical_crossentropy',
                  metrics=['accuracy'])
    return model

def train():
    logger.info("Starting CNN training process...")
    
    X, y = load_data()
    if X is None or len(X) < 1:
        logger.error("Insufficient data for training.")
        return
    
    # Simple mapping for labels if they are not 0..N
    unique_labels = np.unique(y)
    label_map = {val: i for i, val in enumerate(unique_labels)}
    y_mapped = np.array([label_map[i] for i in y])
    
    input_shape = X.shape[1:]
    num_classes = len(unique_labels)
    
    model = build_model(input_shape, num_classes)
    
    logger.info(f"Training on {len(X)} samples with {num_classes} classes...")
    model.fit(X, y_mapped, epochs=10, batch_size=4, verbose=1)
    
    os.makedirs(os.path.dirname(MODEL_SAVE_PATH), exist_ok=True)
    model.save(MODEL_SAVE_PATH)
    logger.info(f"Model saved to {MODEL_SAVE_PATH}")

if __name__ == "__main__":
    train()
