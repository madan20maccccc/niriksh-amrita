# Agent 11 — Closure Agent
# Monitors if actions were taken after alerts. Re-escalates if no action within time limit.

from datetime import datetime, timedelta
from sqlalchemy.orm import Session
import models
from models import AlertStatus, RiskLevel, EscalationTarget


ACKNOWLEDGEMENT_DEADLINES = {
    RiskLevel.green:  None,   # No deadline — dashboard only
    RiskLevel.yellow: 60,     # 60 minutes
    RiskLevel.orange: 30,     # 30 minutes
    RiskLevel.red:    15,     # 15 minutes — EMERGENCY
}

RE_ESCALATION_TARGETS = {
    EscalationTarget.nurse:         EscalationTarget.supervisor,
    EscalationTarget.supervisor:    EscalationTarget.duty_doctor,
    EscalationTarget.duty_doctor:   EscalationTarget.rapid_response,
    EscalationTarget.rapid_response: EscalationTarget.icu_team,
    EscalationTarget.dashboard:     EscalationTarget.nurse,
}


def check_unacknowledged_alerts(db: Session) -> list[models.Alert]:
    """
    Called by the scheduler periodically.
    Finds active alerts that have exceeded their acknowledgement deadline.
    Re-escalates them ONCE — never re-escalates escalation-type alerts.
    """
    now = datetime.utcnow()
    re_escalated = []

    active_alerts = db.query(models.Alert).filter(
        models.Alert.status == AlertStatus.active,
        models.Alert.re_escalated == False,
        models.Alert.alert_type != "escalation",  # ← Never re-escalate escalation alerts
    ).all()

    for alert in active_alerts:
        deadline_minutes = ACKNOWLEDGEMENT_DEADLINES.get(alert.risk_level)
        if deadline_minutes is None:
            continue

        elapsed = (now - alert.created_at.replace(tzinfo=None)).total_seconds() / 60
        if elapsed < deadline_minutes:
            continue

        # TIME EXCEEDED — Re-escalate ONCE
        next_target = RE_ESCALATION_TARGETS.get(
            alert.escalation_target,
            EscalationTarget.duty_doctor
        )

        # Mark the original alert so it won't be processed again
        alert.escalation_target = next_target
        alert.re_escalated = True
        alert.status = AlertStatus.escalated
        alert.closure_checked_at = now

        # Create ONE escalation notification alert (non-re-escalatable)
        re_alert = models.Alert(
            patient_id=alert.patient_id,
            vital_id=alert.vital_id,
            alert_type="escalation",          # ← This type is excluded from re-escalation
            risk_level=alert.risk_level,
            message=(
                f"⚡ ESCALATED: Alert #{alert.id} unacknowledged for "
                f"{deadline_minutes} min. Now assigned to: {next_target.value}. "
                f"Original: {alert.message[:80]}"
            ),
            status=AlertStatus.active,
            escalation_target=next_target,
            re_escalated=True,               # ← Prevent this from being re-escalated further
        )
        db.add(re_alert)
        re_escalated.append(alert)

    if re_escalated:
        db.commit()

    return re_escalated


def acknowledge_alert(
    db: Session,
    alert_id: int,
    user_id: int,
    action_taken: str = None
) -> models.Alert:
    """Marks alert as acknowledged with timestamp and user"""
    alert = db.query(models.Alert).filter(models.Alert.id == alert_id).first()
    if not alert:
        return None

    alert.status = AlertStatus.acknowledged
    alert.acknowledged_by = user_id
    alert.acknowledged_at = datetime.utcnow()
    alert.closure_checked_at = datetime.utcnow()
    db.commit()
    db.refresh(alert)
    return alert
