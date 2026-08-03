from fastapi import APIRouter, Depends, HTTPException, Request, BackgroundTasks, File, UploadFile
from sqlalchemy.orm import Session
from typing import List
import os
import json
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
from agents.email_notifier import send_email_alert

router = APIRouter()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")


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

    # ── Agent 15: Real Email Alert (RED / ORANGE) ─────────
    if risk_level.value in ["RED", "ORANGE"] and created_alerts:
        ward = db.query(models.Ward).filter(models.Ward.id == patient.ward_id).first()
        alert_msg = created_alerts[0].message if created_alerts else f"NEWS2 Score {ews_data['total_score']}"
        
        doctor_email = ward.doctor_email if (ward and hasattr(ward, 'doctor_email') and ward.doctor_email) else "madan.m200607@gmail.com"
        
        background_tasks.add_task(
            send_email_alert,
            patient.full_name,
            patient.bed_number,
            ews_data["total_score"],
            risk_level.value,
            alert_msg,
            ward.name if ward else "Unknown Ward",
            doctor_email
        )

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


@router.post("/ocr")
async def extract_vitals_ocr(
    file: UploadFile = File(...),
    current_user: models.User = Depends(get_current_user)
):
    """
    Real-time AI vital monitor OCR screen parser using Gemini, OpenAI, or Hugging Face.
    Provides transparent failover: Gemini -> OpenAI -> Hugging Face.
    """
    # 1. Read configs directly from .env file (hot-reload support)
    provider = "gemini"
    hf_token = ""
    gemini_key = ""
    openai_key = ""
    try:
        env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")
        if os.path.exists(env_path):
            with open(env_path, "r", encoding="utf-8") as env_f:
                for line in env_f:
                    if line.startswith("AI_PROVIDER="):
                        provider = line.split("=", 1)[1].strip().lower()
                    elif line.startswith("HUGGINGFACE_API_KEY="):
                        hf_token = line.split("=", 1)[1].strip()
                    elif line.startswith("GEMINI_API_KEY="):
                        gemini_key = line.split("=", 1)[1].strip()
                    elif line.startswith("OPENAI_API_KEY="):
                        openai_key = line.split("=", 1)[1].strip()
    except Exception:
        pass
        
    # Fallback to system environment variables
    if not provider:
        provider = os.getenv("AI_PROVIDER", "gemini").lower()
    if not hf_token:
        hf_token = os.getenv("HF_TOKEN", "") or os.getenv("HUGGINGFACE_API_KEY", "")
    if not hf_token:
        hf_token = "hf_placeholder"
    if not gemini_key:
        gemini_key = os.getenv("GEMINI_API_KEY", "")
    if not openai_key:
        openai_key = os.getenv("OPENAI_API_KEY", "")

    is_broken_gemini = not gemini_key or len(gemini_key) < 20

    # Read uploaded file bytes
    image_bytes = await file.read()

    # Compress image to prevent API timeouts and payload limits (resizes to max 1000px, JPEG quality 80)
    try:
        import io
        from PIL import Image
        img = Image.open(io.BytesIO(image_bytes))
        if img.mode in ("RGBA", "P"):
            img = img.convert("RGB")
        img.thumbnail((1000, 1000), Image.Resampling.LANCZOS)
        out_io = io.BytesIO()
        img.save(out_io, format="JPEG", quality=80)
        image_bytes = out_io.getvalue()
        print(f"[OCR Compression] Image compressed from original to {len(image_bytes)} bytes")
    except Exception as compress_err:
        print(f"[OCR Compression] Image compression failed: {compress_err}. Using original image.")


    # Helper function to run OpenAI OCR
    def _run_openai_ocr(img_data: bytes, content_type: str, token: str) -> dict:
        import base64
        import urllib.request
        import json
        import ssl
        
        base64_image = base64.b64encode(img_data).decode("utf-8")
        prompt = """
        You are a highly accurate clinical OCR agent.
        Analyze the image, which can be a patient bedside vital monitor screen, a hand-written or printed vitals observation sheet, a clinical flow chart, or a patient report.

        Extract the numerical values for:
        1. Systolic Blood Pressure (systolic_bp)
        2. Diastolic Blood Pressure (diastolic_bp)
        3. Heart Rate / Pulse (heart_rate)
        4. Oxygen Saturation (spo2)
        5. Respiratory Rate (respiratory_rate)
        6. Temperature in Celsius (temperature)

        CRITICAL INSTRUCTIONS FOR SHEETS / TABLES:
        - If the image contains a table with multiple rows of historical records (e.g. an observation sheet with multiple dates/times), you MUST extract the values from the LATEST row (the bottom-most filled row or the row with the most recent timestamp).
        - If a value is missing or not readable, set it to null.
        - If the temperature is in Fahrenheit (e.g. 98.6), convert it to Celsius (37.0).

        Return ONLY a raw valid JSON object with the following fields:
        {
          "systolic_bp": number or null,
          "diastolic_bp": number or null,
          "heart_rate": number or null,
          "spo2": number or null,
          "respiratory_rate": number or null,
          "temperature": number or null
        }
        Do not output any markdown formatting, code blocks (like ```json), or explanatory text. Just raw JSON.
        """
        
        url = "https://api.openai.com/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": "gpt-4o-mini",
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:{content_type};base64,{base64_image}"
                            }
                        }
                    ]
                }
            ],
            "response_format": {"type": "json_object"}
        }
        
        context = ssl._create_unverified_context()
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers=headers
        )
        
        print("[OCR] Querying OpenAI Model (gpt-4o-mini)...")
        with urllib.request.urlopen(req, context=context, timeout=25) as response:
            body = response.read().decode("utf-8")
            res_json = json.loads(body)
            choices = res_json.get("choices", [])
            if len(choices) > 0:
                text = choices[0].get("message", {}).get("content", "").strip()
            else:
                raise Exception("Invalid API response format from OpenAI.")
            
            res = json.loads(text)
            res["parsed_by"] = "OpenAI ChatGPT (gpt-4o-mini)"
            return res

    # Helper function to run Hugging Face OCR
    def _run_hf_ocr(img_data: bytes, content_type: str, token: str) -> dict:
        import base64
        import urllib.request
        import json
        import ssl
        
        base64_image = base64.b64encode(img_data).decode("utf-8")
        prompt = """
        You are a highly accurate clinical OCR agent.
        Analyze the image, which can be a patient bedside vital monitor screen, a hand-written or printed vitals observation sheet, a clinical flow chart, or a patient report.

        Extract the numerical values for:
        1. Systolic Blood Pressure (systolic_bp)
        2. Diastolic Blood Pressure (diastolic_bp)
        3. Heart Rate / Pulse (heart_rate)
        4. Oxygen Saturation (spo2)
        5. Respiratory Rate (respiratory_rate)
        6. Temperature in Celsius (temperature)

        CRITICAL INSTRUCTIONS FOR SHEETS / TABLES:
        - If the image contains a table with multiple rows of historical records (e.g. an observation sheet with multiple dates/times), you MUST extract the values from the LATEST row (the bottom-most filled row or the row with the most recent timestamp).
        - If a value is missing or not readable, set it to null.
        - If the temperature is in Fahrenheit (e.g. 98.6), convert it to Celsius (37.0).

        Return ONLY a raw valid JSON object with the following fields:
        {
          "systolic_bp": number or null,
          "diastolic_bp": number or null,
          "heart_rate": number or null,
          "spo2": number or null,
          "respiratory_rate": number or null,
          "temperature": number or null
        }
        Do not output any markdown formatting, code blocks (like ```json), or explanatory text. Just raw JSON.
        """
        
        url = "https://router.huggingface.co/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": "Qwen/Qwen2.5-VL-72B-Instruct",
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:{content_type};base64,{base64_image}"
                            }
                        }
                    ]
                }
            ]
        }
        
        context = ssl._create_unverified_context()
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers=headers
        )
        
        print("[OCR Fallback] Querying Hugging Face Vision Model (Qwen2.5-VL) via Router...")
        with urllib.request.urlopen(req, context=context, timeout=25) as response:
            body = response.read().decode("utf-8")
            res_json = json.loads(body)
            choices = res_json.get("choices", [])
            if len(choices) > 0:
                text = choices[0].get("message", {}).get("content", "").strip()
            else:
                raise Exception("Invalid API response format from Hugging Face Vision.")
            
            if text.startswith("```"):
                text = text.split("```")[1]
                if text.startswith("json"):
                    text = text[4:]
            text = text.strip()
            res = json.loads(text)
            res["parsed_by"] = "Hugging Face (Qwen2.5-VL-72B)"
            return res

    # Helper function to run Google Gemini OCR
    def _run_gemini_ocr(img_data: bytes, content_type: str, key: str) -> dict:
        import google.generativeai as genai
        import json
        genai.configure(api_key=key)
        
        image_part = {
            "mime_type": content_type,
            "data": img_data
        }
        
        prompt = """
        You are a highly accurate clinical OCR agent.
        Analyze the image, which can be a patient bedside vital monitor screen, a hand-written or printed vitals observation sheet, a clinical flow chart, or a patient report.

        Extract the numerical values for:
        1. Systolic Blood Pressure (systolic_bp)
        2. Diastolic Blood Pressure (diastolic_bp)
        3. Heart Rate / Pulse (heart_rate)
        4. Oxygen Saturation (spo2)
        5. Respiratory Rate (respiratory_rate)
        6. Temperature in Celsius (temperature)

        CRITICAL INSTRUCTIONS FOR SHEETS / TABLES:
        - If the image contains a table with multiple rows of historical records (e.g. an observation sheet with multiple dates/times), you MUST extract the values from the LATEST row (the bottom-most filled row or the row with the most recent timestamp).
        - If a value is missing or not readable, set it to null.
        - If the temperature is in Fahrenheit (e.g. 98.6), convert it to Celsius (37.0).

        Return ONLY a raw valid JSON object with the following fields:
        {
          "systolic_bp": number or null,
          "diastolic_bp": number or null,
          "heart_rate": number or null,
          "spo2": number or null,
          "respiratory_rate": number or null,
          "temperature": number or null
        }
        Do not output any markdown formatting, code blocks (like ```json), or explanatory text. Just raw JSON.
        """
        
        models_to_try = [
            "gemini-2.0-flash",
            "gemini-flash-latest",
            "gemini-pro-latest",
            "gemini-2.5-flash",
            "gemini-2.5-flash-lite",
            "gemini-1.5-flash",
            "gemini-1.5-pro"
        ]
        
        response = None
        last_err = None
        for model_name in models_to_try:
            try:
                model = genai.GenerativeModel(model_name)
                response = model.generate_content([prompt, image_part])
                break
            except Exception as e:
                print(f"[OCR] Model {model_name} failed: {e}. Trying next...")
                last_err = e
                continue
                
        if response is None:
            raise Exception(f"All generative models failed. Last error: {last_err}")
            
        text = response.text.strip()
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        text = text.strip()
        res = json.loads(text)
        res["parsed_by"] = "Google Gemini Flash"
        return res

    # 2. Main execution flow with cascade failover
    # Order of attempt: Active Provider -> Gemini -> OpenAI -> Hugging Face
    errors = []
    
    # Try 1: Try active provider first
    if provider == "openai" and openai_key:
        try:
            return _run_openai_ocr(image_bytes, file.content_type or "image/jpeg", openai_key)
        except Exception as e:
            errors.append(f"OpenAI error: {e}")
            
    elif provider == "huggingface" and hf_token:
        try:
            return _run_hf_ocr(image_bytes, file.content_type or "image/jpeg", hf_token)
        except Exception as e:
            errors.append(f"Hugging Face error: {e}")
            
    else: # Default Gemini
        if gemini_key and not is_broken_gemini:
            try:
                return _run_gemini_ocr(image_bytes, file.content_type or "image/jpeg", gemini_key)
            except Exception as e:
                errors.append(f"Gemini error: {e}")

    # Try 2: Failover to OpenAI if available
    if openai_key:
        try:
            return _run_openai_ocr(image_bytes, file.content_type or "image/jpeg", openai_key)
        except Exception as e:
            errors.append(f"OpenAI failover error: {e}")

    # Try 3: Failover to Hugging Face if available
    if hf_token:
        try:
            return _run_hf_ocr(image_bytes, file.content_type or "image/jpeg", hf_token)
        except Exception as e:
            errors.append(f"Hugging Face failover error: {e}")

    # Try 4: Failover to Gemini if not tried already
    if gemini_key and not is_broken_gemini and "Gemini error:" not in "".join(errors):
        try:
            return _run_gemini_ocr(image_bytes, file.content_type or "image/jpeg", gemini_key)
        except Exception as e:
            errors.append(f"Gemini failover error: {e}")

    # If all failed
    raise HTTPException(
        status_code=500,
        detail=f"All parser models failed. Details: {'; '.join(errors)}"
    )


