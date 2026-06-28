from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List, Optional
from database import get_db
import models, schemas
from auth import get_current_user

router = APIRouter()

@router.get("/", response_model=List[schemas.AuditLogOut])
def get_audit_logs(
    patient_id: Optional[int] = None,
    action: Optional[str] = None,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    query = db.query(models.AuditLog)
    if patient_id:
        query = query.filter(models.AuditLog.patient_id == patient_id)
    if action:
        query = query.filter(models.AuditLog.action == action)
    logs = query.order_by(models.AuditLog.timestamp.desc()).limit(limit).all()
    return [schemas.AuditLogOut.model_validate(l) for l in logs]
