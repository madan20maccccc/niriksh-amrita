# Agent 10 — Escalation Agent
# Determines WHO to notify based on risk level, and creates alert records

from models import RiskLevel, EscalationTarget, AlertStatus
from sqlalchemy.orm import Session
import models
import json


ESCALATION_MATRIX = {
    RiskLevel.green: {
        "target": EscalationTarget.dashboard,
        "action": "Add to dashboard monitoring queue only",
        "urgency_minutes": None,
    },
    RiskLevel.yellow: {
        "target": EscalationTarget.nurse,
        "action": "Notify assigned nurse. Reassess vitals within 4 hours.",
        "urgency_minutes": 60,
    },
    RiskLevel.orange: {
        "target": EscalationTarget.duty_doctor,
        "action": "Urgent — Duty Doctor Dr. Ramesh Iyer AND Supervisor Sr. Nurse Lalitha notified. Recheck vitals. Acknowledge alert.",
        "urgency_minutes": 30,
    },
    RiskLevel.red: {
        "target": EscalationTarget.rapid_response,
        "action": "EMERGENCY — Rapid Response Team activated. Duty Doctor Dr. Ramesh Iyer notified immediately. Consider ICU transfer.",
        "urgency_minutes": 15,
    },
}


def create_alert(
    db: Session,
    patient_id: int,
    vital_id: int,
    risk_level: RiskLevel,
    alert_type: str,
    message: str,
    details: dict = None,
) -> models.Alert:
    """Creates an alert record in the database"""
    escalation_info = ESCALATION_MATRIX.get(risk_level, ESCALATION_MATRIX[RiskLevel.yellow])

    alert = models.Alert(
        patient_id=patient_id,
        vital_id=vital_id,
        alert_type=alert_type,
        risk_level=risk_level,
        message=message,
        details=json.dumps(details) if details else None,
        status=AlertStatus.active,
        escalation_target=escalation_info["target"],
    )
    db.add(alert)
    db.commit()
    db.refresh(alert)
    return alert


def get_escalation_plan(risk_level: RiskLevel) -> dict:
    return ESCALATION_MATRIX.get(risk_level, ESCALATION_MATRIX[RiskLevel.yellow])


def run_escalation(
    db: Session,
    patient_id: int,
    vital_id: int,
    risk_level: RiskLevel,
    news2_score: int,
    clinical_alerts: list,
    trend_alerts: list,
) -> list[models.Alert]:
    """
    Creates alerts for the patient based on all findings.
    Returns list of created Alert objects.
    """
    created_alerts = []

    # Only create alert if not GREEN (or if there are clinical alerts)
    if risk_level == RiskLevel.green and not clinical_alerts and not trend_alerts:
        return created_alerts

    # Main risk alert
    plan = get_escalation_plan(risk_level)
    main_message = (
        f"[{risk_level.value}] Patient NEWS2={news2_score}. "
        f"Action: {plan['action']}"
    )
    alert = create_alert(
        db, patient_id, vital_id, risk_level,
        alert_type="ews",
        message=main_message,
        details={"news2_score": news2_score, "escalation": plan["target"].value},
    )
    created_alerts.append(alert)

    # Clinical rule alerts (threshold/patient-specific)
    for ca in clinical_alerts:
        if ca.severity in ("CRITICAL", "HIGH"):
            sev_risk = RiskLevel.red if ca.severity == "CRITICAL" else RiskLevel.orange
            a = create_alert(
                db, patient_id, vital_id, sev_risk,
                alert_type="threshold",
                message=ca.message,
                details=ca.details,
            )
            created_alerts.append(a)

    # Trend alerts
    for ta in trend_alerts:
        if ta.severity in ("HIGH", "CRITICAL"):
            sev_risk = RiskLevel.red if ta.severity == "CRITICAL" else RiskLevel.orange
            a = create_alert(
                db, patient_id, vital_id, sev_risk,
                alert_type="trend",
                message=ta.message,
                details={"vital": ta.vital, "values": ta.values},
            )
            created_alerts.append(a)

    return created_alerts
