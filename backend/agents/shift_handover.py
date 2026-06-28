# Agent 13 — Shift Handover Agent (SBAR)
# Auto-generates SBAR at each shift change: 6AM / 2PM / 10PM

from datetime import datetime
from sqlalchemy.orm import Session
import models
import json
from agents.llm_summary import generate_sbar_gemini
from agents.ews_calculator import calculate_news2


def get_current_shift(hour: int = None) -> models.ShiftType:
    """Determine current shift based on hour (24h format)"""
    if hour is None:
        hour = datetime.now().hour
    if 6 <= hour < 14:
        return models.ShiftType.morning
    elif 14 <= hour < 22:
        return models.ShiftType.evening
    else:
        return models.ShiftType.night


def generate_shift_sbar(db: Session, patient_id: int, shift: models.ShiftType) -> models.SBARReport | None:
    """Generates an SBAR for one patient for the current shift"""
    patient = db.query(models.Patient).filter(models.Patient.id == patient_id).first()
    if not patient or not patient.is_active:
        return None

    # Get latest vitals for this shift
    vital = (
        db.query(models.Vital)
        .filter(models.Vital.patient_id == patient_id, models.Vital.shift == shift)
        .order_by(models.Vital.recorded_at.desc())
        .first()
    )
    if not vital:
        # Fallback: use the most recent vital regardless of shift
        vital = (
            db.query(models.Vital)
            .filter(models.Vital.patient_id == patient_id)
            .order_by(models.Vital.recorded_at.desc())
            .first()
        )
    if not vital:
        return None
    # Use the actual shift from the found vital
    shift = vital.shift

    # Get EWS
    ews_record = db.query(models.EWSScore).filter(models.EWSScore.vital_id == vital.id).first()
    ews_data = {}
    if ews_record:
        ews_data = {
            "total_score": ews_record.total_score,
            "clinical_risk": ews_record.clinical_risk,
            "response_required": ews_record.response_required,
        }

    # Get active alerts
    alerts = (
        db.query(models.Alert)
        .filter(models.Alert.patient_id == patient_id, models.Alert.status == models.AlertStatus.active)
        .limit(5)
        .all()
    )
    alert_list = [{"severity": a.risk_level.value, "message": a.message} for a in alerts]

    # Build patient context
    ward = db.query(models.Ward).filter(models.Ward.id == patient.ward_id).first()
    patient_data = {
        "full_name": patient.full_name,
        "age": patient.age,
        "gender": patient.gender,
        "bed_number": patient.bed_number,
        "ward_name": ward.name if ward else "Unknown Ward",
        "primary_diagnosis": patient.primary_diagnosis,
        "comorbidities": patient.comorbidities,
        "current_medications": patient.current_medications,
        "diabetes": patient.diabetes,
        "copd": patient.copd,
        "hypertension": patient.hypertension,
        "post_surgery": patient.post_surgery,
        "cardiac_history": patient.cardiac_history,
    }

    vitals_data = {
        "shift": shift.value,
        "systolic_bp": vital.systolic_bp,
        "diastolic_bp": vital.diastolic_bp,
        "heart_rate": vital.heart_rate,
        "respiratory_rate": vital.respiratory_rate,
        "spo2": vital.spo2,
        "temperature": vital.temperature,
        "consciousness": vital.consciousness,
        "blood_glucose": vital.blood_glucose,
    }

    # Generate via LLM
    sbar_data = generate_sbar_gemini(patient_data, vitals_data, ews_data, alert_list, [])

    # Save to DB
    report = models.SBARReport(
        patient_id=patient_id,
        vital_id=vital.id,
        shift=shift,
        situation=sbar_data.get("situation", ""),
        background=sbar_data.get("background", ""),
        assessment=sbar_data.get("assessment", ""),
        recommendation=sbar_data.get("recommendation", ""),
        generated_by=sbar_data.get("generated_by", "template"),
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return report


def run_shift_handover(db: Session) -> int:
    """Run for ALL active patients. Called by scheduler at shift change time."""
    current_shift = get_current_shift()
    patients = db.query(models.Patient).filter(models.Patient.is_active == True).all()
    count = 0
    for patient in patients:
        try:
            report = generate_shift_sbar(db, patient.id, current_shift)
            if report:
                count += 1
        except Exception as e:
            print(f"[Handover Agent] Failed for patient {patient.id}: {e}")
    print(f"[Handover Agent] Generated {count} SBAR reports for {current_shift.value} shift")
    return count
