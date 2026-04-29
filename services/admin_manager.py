import json
from typing import List, Dict
from fastapi import WebSocket
from services.logger_service import logger

class AdminManager:
    def __init__(self):
        self.active_admins: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_admins.append(websocket)
        logger.info(f"Admin connected. Total admins: {len(self.active_admins)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_admins:
            self.active_admins.remove(websocket)
            logger.info(f"Admin disconnected. Total admins: {len(self.active_admins)}")

    async def broadcast(self, message: dict):
        for connection in self.active_admins:
            try:
                await connection.send_json(message)
            except Exception as e:
                logger.error(f"Failed to send to admin: {e}")
                self.disconnect(connection)

admin_manager = AdminManager()
