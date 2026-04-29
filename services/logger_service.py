import logging
import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import DATA_DIR

def setup_logger(name="proctorly"):
    logger = logging.getLogger(name)
    logger.setLevel(logging.INFO)
    
    if not logger.handlers:
        c_handler = logging.StreamHandler()
        f_handler = logging.FileHandler(os.path.join(DATA_DIR, 'proctorly.log'))
        c_handler.setLevel(logging.INFO)
        f_handler.setLevel(logging.INFO)

        c_format = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
        f_format = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
        c_handler.setFormatter(c_format)
        f_handler.setFormatter(f_format)

        logger.addHandler(c_handler)
        logger.addHandler(f_handler)
    return logger

logger = setup_logger()
