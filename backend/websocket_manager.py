"""
Real-time WebSocket Manager
Broadcasts events to all connected clients:
- New vitals entered
- New alert created
- Alert acknowledged/re-escalated
- Shift handover completed
"""

from fastapi import WebSocket
from typing import Dict, List
import json


class ConnectionManager:
    def __init__(self):
        # ward_id → list of connected WebSockets
        self.ward_connections: Dict[str, List[WebSocket]] = {}
        # "all" channel for admin command centre
        self.admin_connections: List[WebSocket] = []

    async def connect_ward(self, websocket: WebSocket, ward_id: str):
        await websocket.accept()
        if ward_id not in self.ward_connections:
            self.ward_connections[ward_id] = []
        self.ward_connections[ward_id].append(websocket)

    async def connect_admin(self, websocket: WebSocket):
        await websocket.accept()
        self.admin_connections.append(websocket)

    def disconnect_ward(self, websocket: WebSocket, ward_id: str):
        if ward_id in self.ward_connections:
            self.ward_connections[ward_id].remove(websocket)

    def disconnect_admin(self, websocket: WebSocket):
        if websocket in self.admin_connections:
            self.admin_connections.remove(websocket)

    async def broadcast_to_ward(self, ward_id: str, event: dict):
        """Send event to all clients watching a specific ward"""
        message = json.dumps(event)
        dead = []
        for ws in self.ward_connections.get(str(ward_id), []):
            try:
                await ws.send_text(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.ward_connections[str(ward_id)].remove(ws)

    async def broadcast_to_all_admins(self, event: dict):
        """Send event to admin command centre"""
        message = json.dumps(event)
        dead = []
        for ws in self.admin_connections:
            try:
                await ws.send_text(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.admin_connections.remove(ws)

    async def broadcast_alert(self, ward_id: str, alert_data: dict):
        """Shortcut: broadcast a new alert to ward + all admins"""
        event = {"type": "new_alert", "data": alert_data}
        await self.broadcast_to_ward(str(ward_id), event)
        await self.broadcast_to_all_admins(event)

    async def broadcast_vitals_update(self, ward_id: str, patient_id: int, vitals_data: dict):
        """Broadcast vitals update to ward watchers"""
        event = {
            "type": "vitals_updated",
            "patient_id": patient_id,
            "data": vitals_data,
        }
        await self.broadcast_to_ward(str(ward_id), event)
        await self.broadcast_to_all_admins(event)

    async def broadcast_alert_acknowledged(self, ward_id: str, alert_id: int, by_user: str):
        event = {
            "type": "alert_acknowledged",
            "alert_id": alert_id,
            "by": by_user,
        }
        await self.broadcast_to_ward(str(ward_id), event)
        await self.broadcast_to_all_admins(event)


# Singleton instance — imported by all routes
manager = ConnectionManager()
