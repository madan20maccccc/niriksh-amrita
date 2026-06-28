from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from database import get_db
import models, schemas
from auth import get_current_user
import json, random, string

router = APIRouter()


def generate_patient_id() -> str:
    return "AMR-" + "".join(random.choices(string.digits, k=6))


@router.post("/", response_model=schemas.PatientOut)
def create_patient(
    patient_data: schemas.PatientCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    patient = models.Patient(
        patient_id=generate_patient_id(),
        full_name=patient_data.full_name,
        age=patient_data.age,
        gender=patient_data.gender,
        bed_number=patient_data.bed_number,
        ward_id=patient_data.ward_id,
        assigned_nurse_id=patient_data.assigned_nurse_id,
        primary_diagnosis=patient_data.primary_diagnosis,
        comorbidities=json.dumps(patient_data.comorbidities),
        current_medications=json.dumps(patient_data.current_medications),
        allergies=patient_data.allergies,
        diabetes=patient_data.diabetes,
        hypertension=patient_data.hypertension,
        copd=patient_data.copd,
        post_surgery=patient_data.post_surgery,
        cardiac_history=patient_data.cardiac_history,
    )
    db.add(patient)
    db.commit()
    db.refresh(patient)
    return schemas.PatientOut.model_validate(patient)


@router.get("/", response_model=List[schemas.PatientSummary])
def list_patients(
    ward_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Returns patient list with latest risk level and alert count"""
    query = db.query(models.Patient).filter(models.Patient.is_active == True)

    # Nurses only see their assigned patients
    if current_user.role == models.UserRole.nurse:
        query = query.filter(models.Patient.assigned_nurse_id == current_user.id)
    elif ward_id:
        query = query.filter(models.Patient.ward_id == ward_id)

    patients = query.all()
    result = []

    for p in patients:
        # Latest vital
        latest_vital = (
            db.query(models.Vital)
            .filter(models.Vital.patient_id == p.id)
            .order_by(models.Vital.recorded_at.desc())
            .first()
        )
        # Active alert count
        active_alerts = (
            db.query(func.count(models.Alert.id))
            .filter(models.Alert.patient_id == p.id, models.Alert.status == models.AlertStatus.active)
            .scalar()
        )

        result.append(schemas.PatientSummary(
            id=p.id,
            patient_id=p.patient_id,
            full_name=p.full_name,
            age=p.age,
            gender=p.gender,
            bed_number=p.bed_number,
            ward_id=p.ward_id,
            primary_diagnosis=p.primary_diagnosis,
            latest_risk_level=latest_vital.risk_level.value if latest_vital and latest_vital.risk_level else None,
            latest_news2=latest_vital.news2_score if latest_vital else None,
            active_alerts=active_alerts or 0,
            last_vitals_at=latest_vital.recorded_at if latest_vital else None,
            latest_systolic_bp=latest_vital.systolic_bp if latest_vital else None,
            latest_diastolic_bp=latest_vital.diastolic_bp if latest_vital else None,
            latest_heart_rate=latest_vital.heart_rate if latest_vital else None,
            latest_spo2=latest_vital.spo2 if latest_vital else None,
        ))

    return result


@router.get("/{patient_id}", response_model=schemas.PatientOut)
def get_patient(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    patient = db.query(models.Patient).filter(models.Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    return schemas.PatientOut.model_validate(patient)


@router.put("/{patient_id}", response_model=schemas.PatientOut)
def update_patient(
    patient_id: int,
    patient_data: schemas.PatientCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    patient = db.query(models.Patient).filter(models.Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    for field, value in patient_data.model_dump().items():
        if field in ["comorbidities", "current_medications"] and isinstance(value, list):
            setattr(patient, field, json.dumps(value))
        elif hasattr(patient, field):
            setattr(patient, field, value)

    db.commit()
    db.refresh(patient)
    return schemas.PatientOut.model_validate(patient)


@router.delete("/{patient_id}")
def discharge_patient(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if current_user.role not in [models.UserRole.admin, models.UserRole.doctor]:
        raise HTTPException(status_code=403, detail="Only doctors or admins can discharge patients")
    patient = db.query(models.Patient).filter(models.Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    patient.is_active = False
    db.commit()
    return {"message": f"Patient {patient.full_name} discharged"}
