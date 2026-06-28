"""
NurseWatch AI — FastAPI Main Application
Integrates all 16 agents into a cohesive real-time hospital monitoring system.
"""

from fastapi import FastAPI, Depends, HTTPException, WebSocket, WebSocketDisconnect, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from contextlib import asynccontextmanager
import os

from database import engine, get_db, Base
import models
from websocket_manager import manager
from agents.closure import check_unacknowledged_alerts
from agents.shift_handover import run_shift_handover, get_current_shift

# Route modules
from routes import auth_routes, patient_routes, vital_routes, alert_routes
from routes import ward_routes, nurse_routes, sbar_routes, audit_routes, analytics_routes, innovation_routes


# ─────────────────────────────────────────────
# Scheduler (APScheduler)
# ─────────────────────────────────────────────
scheduler = AsyncIOScheduler()

def closure_check_job():
    """Every 5 minutes: check for unacknowledged alerts"""
    from database import SessionLocal
    db = SessionLocal()
    try:
        re_escalated = check_unacknowledged_alerts(db)
        if re_escalated:
            print(f"[Closure Agent] Re-escalated {len(re_escalated)} alerts")
    finally:
        db.close()

def shift_handover_job():
    """At 6:00, 14:00, 22:00: generate SBAR for all patients"""
    from database import SessionLocal
    db = SessionLocal()
    try:
        count = run_shift_handover(db)
        print(f"[Handover Agent] Generated {count} SBAR reports")
    finally:
        db.close()


# ─────────────────────────────────────────────
# App Lifespan (startup/shutdown)
# ─────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create all tables
    Base.metadata.create_all(bind=engine)

    # Schedule jobs
    scheduler.add_job(closure_check_job, "interval", minutes=5, id="closure_check")
    scheduler.add_job(shift_handover_job, "cron", hour="6,14,22", minute=0, id="shift_handover")
    scheduler.start()

    print("[OK] NurseWatch AI Backend Started")
    print("[OK] All agents active")
    print("[OK] Scheduler running: closure check every 5 min, shift handover at 6/14/22h")
    yield

    scheduler.shutdown()
    print("[STOP] NurseWatch AI Backend Stopped")


# ─────────────────────────────────────────────
# FastAPI App
# ─────────────────────────────────────────────
app = FastAPI(
    title="NurseWatch AI",
    description="Agentic Shift Safety & Early Warning System for Amrita Hospital",
    version="2.0.0",
    lifespan=lifespan,
)

# CORS — allow frontend origin
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:8080",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:8080",
        "http://0.0.0.0:3000",
        "http://0.0.0.0:8080",
        "*"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─────────────────────────────────────────────
# REST Routes
# ─────────────────────────────────────────────
app.include_router(auth_routes.router,      prefix="/auth",      tags=["Authentication"])
app.include_router(patient_routes.router,   prefix="/patients",  tags=["Patients"])
app.include_router(vital_routes.router,     prefix="/vitals",    tags=["Vitals"])
app.include_router(alert_routes.router,     prefix="/alerts",    tags=["Alerts"])
app.include_router(ward_routes.router,      prefix="/wards",     tags=["Wards"])
app.include_router(nurse_routes.router,     prefix="/nurses",    tags=["Nurses"])
app.include_router(sbar_routes.router,      prefix="/sbar",      tags=["SBAR"])
app.include_router(audit_routes.router,     prefix="/audit",     tags=["Audit"])
app.include_router(analytics_routes.router, prefix="/analytics", tags=["Analytics"])
app.include_router(innovation_routes.router, prefix="/innovations", tags=["Innovations"])


# ─────────────────────────────────────────────
# WebSocket Endpoints (Agent 12 — Dashboard Layer)
# ─────────────────────────────────────────────
@app.websocket("/ws/ward/{ward_id}")
async def websocket_ward(websocket: WebSocket, ward_id: str):
    """Ward-specific real-time feed"""
    await manager.connect_ward(websocket, ward_id)
    try:
        while True:
            # Keep connection alive; server pushes events
            data = await websocket.receive_text()
            # Handle ping/pong
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        manager.disconnect_ward(websocket, ward_id)


@app.websocket("/ws/admin")
async def websocket_admin(websocket: WebSocket):
    """Admin command centre — receives ALL events from all wards"""
    await manager.connect_admin(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        manager.disconnect_admin(websocket)


# ─────────────────────────────────────────────
# Health Check
# ─────────────────────────────────────────────
@app.get("/", tags=["Health"])
def root():
    return {
        "status": "online",
        "system": "NurseWatch AI",
        "version": "2.0.0",
        "hospital": "Amrita Hospital",
        "agents": 16,
        "docs": "/docs",
    }

@app.get("/health", tags=["Health"])
def health():
    return {"status": "healthy", "scheduler": scheduler.running}
