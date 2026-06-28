from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional

from database import get_db
import models
from auth import get_current_user
from innovations.predictor import predict_deterioration
from innovations.rag_assistant import rag_answer
from innovations.explainability import explain_alert

router = APIRouter()

class AskRequest(BaseModel):
    question: str

@router.post("/patients/{patient_id}/ask")
def ask_patient_rag(
    patient_id: int,
    req: AskRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    RAG Assistant (Innovation 2)
    Nurses can ask natural-language questions about a patient's historical vitals and alerts.
    """
    patient = db.query(models.Patient).filter(models.Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
        
    vitals_history = (
        db.query(models.Vital)
        .filter(models.Vital.patient_id == patient_id)
        .order_by(models.Vital.recorded_at.desc())
        .limit(10)
        .all()
    )
    
    alerts_history = (
        db.query(models.Alert)
        .filter(models.Alert.patient_id == patient_id)
        .order_by(models.Alert.created_at.desc())
        .limit(10)
        .all()
    )
    
    # Map models to dicts for RAG
    patient_dict = {
        "full_name": patient.full_name,
        "age": patient.age,
        "gender": patient.gender,
        "bed_number": patient.bed_number,
        "ward_name": patient.ward.name if patient.ward else "General",
        "primary_diagnosis": patient.primary_diagnosis,
        "comorbidities": patient.comorbidities,
        "current_medications": patient.current_medications,
        "diabetes": patient.diabetes,
        "hypertension": patient.hypertension,
        "copd": patient.copd,
        "post_surgery": patient.post_surgery,
        "cardiac_history": patient.cardiac_history,
    }
    
    vitals_list = []
    for v in vitals_history:
        vitals_list.append({
            "shift": v.shift.value if v.shift else "N/A",
            "timestamp": v.recorded_at.strftime("%Y-%m-%d %H:%M"),
            "systolic_bp": v.systolic_bp,
            "diastolic_bp": v.diastolic_bp,
            "heart_rate": v.heart_rate,
            "respiratory_rate": v.respiratory_rate,
            "spo2": v.spo2,
            "temperature": v.temperature,
            "consciousness": v.consciousness,
            "blood_glucose": v.blood_glucose,
        })
        
    alerts_list = []
    for a in alerts_history:
        alerts_list.append({
            "severity": a.risk_level.value if a.risk_level else "UNKNOWN",
            "message": a.message,
            "timestamp": a.created_at.strftime("%Y-%m-%d %H:%M")
        })
        
    answer = rag_answer(req.question, patient_dict, vitals_list, alerts_list)
    return {"answer": answer}


@router.get("/patients/{patient_id}/predict")
def predict_patient_trends(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Predictive Deterioration (Innovation 1)
    Exposes trend forecast predictions for SBP, HR, Glucose, and SpO2.
    """
    patient = db.query(models.Patient).filter(models.Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
        
    # Get last 5 vitals (ordered oldest to newest for linear fitting)
    vitals = (
        db.query(models.Vital)
        .filter(models.Vital.patient_id == patient_id)
        .order_by(models.Vital.recorded_at.asc())
        .limit(5)
        .all()
    )
    
    if len(vitals) < 3:
        return {
            "can_predict": False,
            "message": "At least 3 sets of vitals are required to run regression modeling."
        }
        
    sbp_history = [v.systolic_bp for v in vitals if v.systolic_bp is not None]
    hr_history = [v.heart_rate for v in vitals if v.heart_rate is not None]
    gl_history = [v.blood_glucose for v in vitals if v.blood_glucose is not None]
    spo2_history = [v.spo2 for v in vitals if v.spo2 is not None]
    
    predictions = {}
    
    # 1. SBP predictions
    if len(sbp_history) >= 3:
        # Check high threshold (180) and low threshold (90)
        high_pred = predict_deterioration(sbp_history, 180.0, "Systolic Blood Pressure (High)")
        low_pred = predict_deterioration(sbp_history, 90.0, "Systolic Blood Pressure (Low)")
        predictions["systolic_bp"] = {
            "history": sbp_history,
            "high_threshold_prediction": high_pred,
            "low_threshold_prediction": low_pred
        }
        
    # 2. Heart Rate predictions
    if len(hr_history) >= 3:
        high_pred = predict_deterioration(hr_history, 130.0, "Heart Rate (High)")
        low_pred = predict_deterioration(hr_history, 40.0, "Heart Rate (Low)")
        predictions["heart_rate"] = {
            "history": hr_history,
            "high_threshold_prediction": high_pred,
            "low_threshold_prediction": low_pred
        }
        
    # 3. Blood Glucose predictions
    if len(gl_history) >= 3:
        # Diabetic threshold is lower (250) vs standard (400)
        high_limit = 250.0 if patient.diabetes else 400.0
        high_pred = predict_deterioration(gl_history, high_limit, "Blood Glucose (High)")
        low_pred = predict_deterioration(gl_history, 70.0, "Blood Glucose (Low)")
        predictions["blood_glucose"] = {
            "history": gl_history,
            "high_threshold_prediction": high_pred,
            "low_threshold_prediction": low_pred
        }
        
    # 4. SpO2 predictions
    if len(spo2_history) >= 3:
        low_limit = 88.0 if patient.copd else 92.0
        low_pred = predict_deterioration(spo2_history, low_limit, "Oxygen Saturation (SpO2)")
        predictions["spo2"] = {
            "history": spo2_history,
            "low_threshold_prediction": low_pred
        }
        
    return {
        "can_predict": len(predictions) > 0,
        "predictions": predictions
    }


@router.get("/alerts/{alert_id}/explain")
def explain_patient_alert(
    alert_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Explainability Panel (Innovation 3)
    Translates alert criteria and triggered rules into plain-English explanation models.
    """
    alert = db.query(models.Alert).filter(models.Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
        
    patient = db.query(models.Patient).filter(models.Patient.id == alert.patient_id).first()
    
    patient_context = {}
    if patient:
        patient_context = {
            "diabetes": patient.diabetes,
            "hypertension": patient.hypertension,
            "copd": patient.copd,
            "post_surgery": patient.post_surgery,
            "cardiac_history": patient.cardiac_history,
        }
        
    alert_dict = {
        "id": alert.id,
        "message": alert.message,
        "rule_type": alert.alert_type,
        "severity": alert.risk_level.value if alert.risk_level else "LOW",
        "details": alert.details,
    }
    
    explanation = explain_alert(alert_dict, patient_context)
    return explanation
