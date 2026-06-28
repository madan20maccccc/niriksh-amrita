# Agent 14 — Audit Agent
# Logs every action with user, patient, timestamp, and details

from sqlalchemy.orm import Session
import models
import json


def log_action(
    db: Session,
    action: str,
    user_id: int = None,
    patient_id: int = None,
    entity_type: str = None,
    entity_id: int = None,
    details: dict = None,
    ip_address: str = None,
) -> models.AuditLog:
    """Universal audit logger — call this for every significant action"""
    log = models.AuditLog(
        user_id=user_id,
        patient_id=patient_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        details=json.dumps(details) if details else None,
        ip_address=ip_address,
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return log


# ── Convenience wrappers ──────────────────────────────────────────────
def audit_vitals_entered(db, user_id, patient_id, vital_id, news2, risk_level, request=None):
    return log_action(
        db, "vitals_entered",
        user_id=user_id, patient_id=patient_id,
        entity_type="vital", entity_id=vital_id,
        details={"news2_score": news2, "risk_level": risk_level},
        ip_address=request.client.host if request else None,
    )

def audit_alert_created(db, patient_id, alert_id, risk_level, alert_type):
    return log_action(
        db, "alert_created",
        patient_id=patient_id,
        entity_type="alert", entity_id=alert_id,
        details={"risk_level": risk_level, "alert_type": alert_type},
    )

def audit_alert_acknowledged(db, user_id, patient_id, alert_id, action_taken=None):
    return log_action(
        db, "alert_acknowledged",
        user_id=user_id, patient_id=patient_id,
        entity_type="alert", entity_id=alert_id,
        details={"action_taken": action_taken},
    )

def audit_sbar_generated(db, patient_id, sbar_id, shift, generated_by):
    return log_action(
        db, "sbar_generated",
        patient_id=patient_id,
        entity_type="sbar", entity_id=sbar_id,
        details={"shift": shift, "generated_by": generated_by},
    )

def audit_escalation(db, patient_id, alert_id, from_target, to_target):
    return log_action(
        db, "alert_escalated",
        patient_id=patient_id,
        entity_type="alert", entity_id=alert_id,
        details={"from": from_target, "to": to_target},
    )

def audit_login(db, user_id, email, ip_address=None):
    return log_action(
        db, "user_login",
        user_id=user_id,
        details={"email": email},
        ip_address=ip_address,
    )
