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

def sms_escalation_job():
    """
    Every 15 minutes: Smart 4-Level Escalation Chain (PDF Protocol)
    ─────────────────────────────────────────────────────────────────
    Level 1 (0-15 min):  Duty Doctor — immediate alert
    Level 2 (15-30 min): Senior Doctor / Consultant — if no response
    Level 3 (30-45 min): Nursing Supervisor / HOD — if still no response
    Level 4 (45+ min):   Admin Office / Medical Superintendent — final escalation
    """
    from database import SessionLocal
    from agents.sms_notifier import send_sms_alert
    from agents.telegram_notifier import send_telegram_alert
    import models as m
    from datetime import datetime, timezone, timedelta

    db = SessionLocal()
    try:
        # Find all active (unacknowledged) RED or ORANGE alerts
        active_alerts = (
            db.query(m.Alert)
            .filter(
                m.Alert.status == m.AlertStatus.active,
                m.Alert.risk_level.in_([m.RiskLevel.RED, m.RiskLevel.ORANGE])
            )
            .all()
        )

        if not active_alerts:
            return

        now = datetime.now(timezone.utc)
        print(f"[Escalation Scheduler] {len(active_alerts)} unacknowledged HIGH-RISK alert(s). Running escalation chain...")

        for alert in active_alerts:
            patient = db.query(m.Patient).filter(m.Patient.id == alert.patient_id).first()
            if not patient:
                continue
            ward = db.query(m.Ward).filter(m.Ward.id == patient.ward_id).first()
            if not ward:
                continue

            # ── Calculate how long this alert has been active ──
            alert_age_mins = (now - alert.created_at.replace(tzinfo=timezone.utc)).total_seconds() / 60

            # ── Determine Escalation Level based on time ──
            # 0-15 min → Level 1 (Duty Doctor)
            # 15-30 min → Level 2 (Senior Doctor)
            # 30-45 min → Level 3 (Nursing Supervisor)
            # 45+ min → Level 4 (Admin Office)
            if alert_age_mins < 15:
                target_level = 1
            elif alert_age_mins < 30:
                target_level = 2
            elif alert_age_mins < 45:
                target_level = 3
            else:
                target_level = 4

            # ── Choose Who to Notify ──
            escalation_contacts = {
                1: {"phone": ward.doctor_phone,             "role": "Duty Doctor",              "emoji": "🚨"},
                2: {"phone": ward.senior_doctor_phone,      "role": "Senior Doctor/Consultant", "emoji": "⚠️"},
                3: {"phone": ward.nursing_supervisor_phone, "role": "Nursing Supervisor/HOD",   "emoji": "🔴"},
                4: {"phone": ward.admin_phone,              "role": "Admin Office/Med Supt",    "emoji": "🆘"},
            }

            # Notify all levels up to current level (so everyone in chain knows)
            levels_to_notify = list(range(1, target_level + 1))

            # Only notify if enough time has passed since last escalation for this alert
            if alert.last_escalated_at:
                mins_since_last = (now - alert.last_escalated_at.replace(tzinfo=timezone.utc)).total_seconds() / 60
                if mins_since_last < 14:  # 14 min buffer to avoid double-sending
                    continue

            # ── Send Telegram (Free, All Levels) ──
            escalation_label = f"Level {target_level}" if target_level == 1 else f"ESCALATION Level {target_level}"
            send_telegram_alert(
                patient_name=patient.full_name,
                bed_number=patient.bed_number,
                news2_score=alert.news2_score or 0,
                risk_level=alert.risk_level.value,
                details=(
                    f"⏱ {escalation_label} — Patient unacknowledged for {int(alert_age_mins)} minutes.\n"
                    f"Escalating to: {escalation_contacts[target_level]['role']}"
                ),
                ward_name=ward.name
            )

            # ── Send SMS to Each Level ──
            for level in levels_to_notify:
                contact = escalation_contacts[level]
                phone = contact["phone"]
                if not phone:
                    continue

                # Skip re-notifying lower levels after first cycle
                if level < target_level and alert.escalation_count > 0:
                    continue

                # Build level-appropriate message
                if level == target_level:
                    prefix = f"{contact['emoji']} URGENT - ACTION REQUIRED"
                    suffix = "Please respond or escalate IMMEDIATELY."
                else:
                    prefix = f"{contact['emoji']} FYI - ESCALATION IN PROGRESS"
                    suffix = f"Alert escalated to {escalation_contacts[target_level]['role']}."

                message_body = (
                    f"{prefix}\n"
                    f"Patient: {patient.full_name} | Bed: {patient.bed_number}\n"
                    f"Ward: {ward.name} | Risk: {alert.risk_level.value}\n"
                    f"NEWS2: {alert.news2_score or 'N/A'} | Unacknowledged: {int(alert_age_mins)} min\n"
                    f"Alert: {alert.message[:80]}\n"
                    f"{suffix}\n"
                    f"— NirikshAmrita Hospital Alert System"
                )

                result = send_sms_alert(
                    to_phone=phone,
                    patient_name=patient.full_name,
                    bed_number=patient.bed_number,
                    news2_score=alert.news2_score or 0,
                    risk_level=alert.risk_level.value,
                    details=message_body,
                    ward_name=ward.name,
                )
                print(f"[Escalation L{level}] {contact['role']} ({phone}): {result.get('message', 'sent')}")

            # ── Update escalation tracking on the alert ──
            alert.escalation_level = target_level
            alert.escalation_count = (alert.escalation_count or 0) + 1
            alert.last_escalated_at = now
            alert.re_escalated = True
            db.commit()

    except Exception as e:
        print(f"[Escalation Scheduler] ERROR: {e}")
        import traceback; traceback.print_exc()
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
    scheduler.add_job(sms_escalation_job, "interval", minutes=15, id="sms_escalation")
    scheduler.start()

    print("[OK] NurseWatch AI Backend Started")
    print("[OK] All agents active")
    print("[OK] Scheduler: closure=5min, shift-handover=6/14/22h, SMS-escalation=15min")
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
