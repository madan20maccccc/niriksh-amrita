from fastapi import APIRouter, Depends, HTTPException, Request, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List
from database import get_db
import models, schemas
from auth import get_current_user
from websocket_manager import manager

# Import all agents
from agents.validation import validate_vitals
from agents.ews_calculator import calculate_news2
from agents.clinical_rules import run_clinical_rules
from agents.trend_reasoning import detect_trends, detect_persistent_abnormality
from agents.risk_classifier import classify_risk
from agents.escalation import run_escalation
from agents.llm_summary import generate_sbar_gemini
from agents.audit import audit_vitals_entered, audit_alert_created, audit_sbar_generated
import json

router = APIRouter()


@router.post("/", response_model=schemas.VitalOut)
async def enter_vitals(
    vital_data: schemas.VitalCreate,
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    THE MAIN ENDPOINT — triggers all agents in sequence:
    3. Validation → 4. Context → 5. Rules → 6. EWS → 7. Trends → 8. Risk → 9. LLM → 10. Escalation → 14. Audit
    """
    # ── Agent 4: Patient Context ─────────────────────────────────
    patient = db.query(models.Patient).filter(models.Patient.id == vital_data.patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    patient_context = {
        "diabetes": patient.diabetes,
        "copd": patient.copd,
        "hypertension": patient.hypertension,
        "post_surgery": patient.post_surgery,
        "cardiac_history": patient.cardiac_history,
    }

    vitals_dict = vital_data.model_dump()

    # ── Agent 3: Validation ──────────────────────────────────────
    validation = validate_vitals(vitals_dict)

    # ── Save vital record ────────────────────────────────────────
    vital = models.Vital(
        patient_id=vital_data.patient_id,
        entered_by=current_user.id,
        shift=vital_data.shift,
        systolic_bp=vital_data.systolic_bp,
        diastolic_bp=vital_data.diastolic_bp,
        heart_rate=vital_data.heart_rate,
        respiratory_rate=vital_data.respiratory_rate,
        spo2=vital_data.spo2,
        temperature=vital_data.temperature,
        consciousness=vital_data.consciousness,
        blood_glucose=vital_data.blood_glucose,
        urine_output=vital_data.urine_output,
        source=vital_data.source,
        is_validated=validation.is_valid,
        validation_notes=validation.summary(),
    )
    db.add(vital)
    db.commit()
    db.refresh(vital)

    # ── Agent 6: EWS/NEWS2 ──────────────────────────────────────
    ews_data = calculate_news2(vitals_dict, copd=patient.copd)
    ews_record = models.EWSScore(
        vital_id=vital.id,
        patient_id=patient.id,
        **ews_data,
    )
    db.add(ews_record)

    # Update vital with NEWS2
    vital.news2_score = ews_data["total_score"]

    # ── Agent 5: Clinical Rules ──────────────────────────────────
    clinical_alerts = run_clinical_rules(vitals_dict, patient_context)

    # ── Agent 7: Trend Reasoning ─────────────────────────────────
    history = (
        db.query(models.Vital)
        .filter(models.Vital.patient_id == patient.id)
        .order_by(models.Vital.recorded_at.asc())
        .limit(6)
        .all()
    )
    history_dicts = [
        {
            "systolic_bp": v.systolic_bp,
            "heart_rate": v.heart_rate,
            "respiratory_rate": v.respiratory_rate,
            "spo2": v.spo2,
            "temperature": v.temperature,
            "news2_score": v.news2_score,
        }
        for v in history
    ]
    # Add current
    history_dicts.append(vitals_dict)
    trend_alerts = detect_trends(history_dicts)
    trend_alerts += detect_persistent_abnormality(history_dicts)

    # ── Agent 8: Risk Classification ─────────────────────────────
    ca_severities = [a.severity for a in clinical_alerts]
    ta_severities = [a.severity for a in trend_alerts]
    single_param_3 = any(
        v == 3 for v in [
            ews_data["resp_rate_score"], ews_data["spo2_score"],
            ews_data["temp_score"], ews_data["bp_score"],
            ews_data["hr_score"], ews_data["consciousness_score"]
        ]
    )
    risk_level, risk_reason, escalation_target = classify_risk(
        ews_data["total_score"], ca_severities, ta_severities, single_param_3
    )

    vital.risk_level = risk_level
    db.commit()
    db.refresh(vital)

    # ── Agent 10: Escalation ─────────────────────────────────────
    created_alerts = run_escalation(
        db, patient.id, vital.id, risk_level,
        ews_data["total_score"], clinical_alerts, trend_alerts
    )

    # ── Agent 14: Audit ──────────────────────────────────────────
    audit_vitals_entered(
        db, current_user.id, patient.id, vital.id,
        ews_data["total_score"], risk_level.value, request
    )
    for alert in created_alerts:
        audit_alert_created(db, patient.id, alert.id, alert.risk_level.value, alert.alert_type)

    # ── Agent 12 (WebSocket): Broadcast to dashboard ─────────────
    alert_dicts = [
        {
            "id": a.id,
            "patient_id": a.patient_id,
            "patient_name": patient.full_name,
            "risk_level": a.risk_level.value,
            "message": a.message,
            "created_at": a.created_at.isoformat(),
        }
        for a in created_alerts
    ]
    background_tasks.add_task(
        manager.broadcast_vitals_update,
        str(patient.ward_id),
        patient.id,
        {
            "news2": ews_data["total_score"],
            "risk_level": risk_level.value,
            "shift": vital_data.shift.value,
        },
    )
    for alert_dict in alert_dicts:
        background_tasks.add_task(
            manager.broadcast_alert,
            str(patient.ward_id),
            alert_dict,
        )

    # ── Agent 9: LLM SBAR (background, non-blocking) ─────────────
    if risk_level.value in ["ORANGE", "RED"]:
        background_tasks.add_task(
            _generate_and_save_sbar,
            patient.id, vital.id, vital_data.shift, patient, vitals_dict, ews_data,
            clinical_alerts, trend_alerts, db
        )

    return schemas.VitalOut.model_validate(vital)


async def _generate_and_save_sbar(
    patient_id, vital_id, shift, patient, vitals_dict, ews_data,
    clinical_alerts, trend_alerts, db
):
    """Background task: generate LLM SBAR and save"""
    try:
        ward = db.query(models.Ward).filter(models.Ward.id == patient.ward_id).first()
        patient_data = {
            "full_name": patient.full_name,
            "age": patient.age,
            "gender": patient.gender,
            "bed_number": patient.bed_number,
            "ward_name": ward.name if ward else "Unknown",
            "primary_diagnosis": patient.primary_diagnosis,
            "comorbidities": patient.comorbidities,
            "current_medications": patient.current_medications,
            "diabetes": patient.diabetes,
            "copd": patient.copd,
            "hypertension": patient.hypertension,
            "post_surgery": patient.post_surgery,
            "cardiac_history": patient.cardiac_history,
        }
        alert_list = [{"severity": a.severity, "message": a.message} for a in clinical_alerts]
        trend_msgs = [a.message for a in trend_alerts]

        sbar = generate_sbar_gemini(patient_data, vitals_dict, ews_data, alert_list, trend_msgs)

        report = models.SBARReport(
            patient_id=patient_id,
            vital_id=vital_id,
            shift=shift,
            situation=sbar.get("situation", ""),
            background=sbar.get("background", ""),
            assessment=sbar.get("assessment", ""),
            recommendation=sbar.get("recommendation", ""),
            generated_by=sbar.get("generated_by", "template"),
        )
        db.add(report)
        db.commit()
        db.refresh(report)
        audit_sbar_generated(db, patient_id, report.id, shift.value, sbar.get("generated_by"))
    except Exception as e:
        print(f"[SBAR Background] Failed: {e}")


@router.get("/patient/{patient_id}", response_model=List[schemas.VitalOut])
def get_patient_vitals(
    patient_id: int,
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    vitals = (
        db.query(models.Vital)
        .filter(models.Vital.patient_id == patient_id)
        .order_by(models.Vital.recorded_at.desc())
        .limit(limit)
        .all()
    )
    return [schemas.VitalOut.model_validate(v) for v in vitals]


@router.get("/{vital_id}/ews", response_model=schemas.EWSScoreOut)
def get_ews(
    vital_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    ews = db.query(models.EWSScore).filter(models.EWSScore.vital_id == vital_id).first()
    if not ews:
        raise HTTPException(status_code=404, detail="EWS score not found for this vital")
    return schemas.EWSScoreOut.model_validate(ews)
