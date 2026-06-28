from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Optional
from database import get_db
import models, schemas
from auth import get_current_user
from agents.closure import acknowledge_alert
from agents.audit import audit_alert_acknowledged
from websocket_manager import manager

router = APIRouter()


@router.get("/", response_model=List[schemas.AlertOut])
def list_alerts(
    status: Optional[str] = None,
    risk_level: Optional[str] = None,
    patient_id: Optional[int] = None,
    ward_id: Optional[int] = None,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    query = db.query(models.Alert)

    if status:
        query = query.filter(models.Alert.status == status)
    if risk_level:
        query = query.filter(models.Alert.risk_level == risk_level)
    if patient_id:
        query = query.filter(models.Alert.patient_id == patient_id)
    if ward_id:
        # Filter alerts where patient is in that ward
        patient_ids = [
            p.id for p in db.query(models.Patient).filter(models.Patient.ward_id == ward_id).all()
        ]
        query = query.filter(models.Alert.patient_id.in_(patient_ids))

    alerts = query.order_by(models.Alert.created_at.desc()).limit(limit).all()
    return [schemas.AlertOut.model_validate(a) for a in alerts]


@router.post("/{alert_id}/acknowledge", response_model=schemas.AlertOut)
async def acknowledge_alert_endpoint(
    alert_id: int,
    ack_data: schemas.AlertAcknowledge,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    alert = acknowledge_alert(db, alert_id, current_user.id, ack_data.action_taken)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    # Audit
    audit_alert_acknowledged(db, current_user.id, alert.patient_id, alert_id, ack_data.action_taken)

    # Broadcast
    patient = db.query(models.Patient).filter(models.Patient.id == alert.patient_id).first()
    if patient:
        background_tasks.add_task(
            manager.broadcast_alert_acknowledged,
            str(patient.ward_id),
            alert_id,
            current_user.full_name,
        )

    return schemas.AlertOut.model_validate(alert)


@router.get("/patient/{patient_id}", response_model=List[schemas.AlertOut])
def get_patient_alerts(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    alerts = (
        db.query(models.Alert)
        .filter(models.Alert.patient_id == patient_id)
        .order_by(models.Alert.created_at.desc())
        .limit(20)
        .all()
    )
    return [schemas.AlertOut.model_validate(a) for a in alerts]


@router.get("/active/count")
def active_alert_count(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    from sqlalchemy import func
    counts = (
        db.query(models.Alert.risk_level, func.count(models.Alert.id))
        .filter(models.Alert.status == models.AlertStatus.active)
        .group_by(models.Alert.risk_level)
        .all()
    )
    return {level.value: count for level, count in counts}
