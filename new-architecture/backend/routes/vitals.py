from fastapi import APIRouter, Depends, HTTPException, File, UploadFile
from sqlalchemy.orm import Session
import os
import json
import models, schemas
from database import get_db

router = APIRouter()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

def calculate_news2(vitals: dict, copd: bool = False) -> tuple[int, str]:
    """
    Standard Clinical NEWS2 Scoring Logic.
    Returns: (total_score, risk_level)
    """
    score = 0
    
    # 1. Respiration Rate
    rr = vitals.get("respiratory_rate")
    if rr is not None:
        if rr <= 8 or rr >= 25: score += 3
        elif rr >= 21: score += 2
        elif rr <= 11 or rr >= 12: 
            if rr <= 11: score += 1
    
    # 2. Oxygen Saturation (Scale 1 for standard, Scale 2 for COPD)
    spo2 = vitals.get("spo2")
    if spo2 is not None:
        if copd:
            # NEWS2 Scale 2 (COPD Target: 88-92%)
            if spo2 < 83: score += 3
            elif spo2 <= 85: score += 2
            elif spo2 <= 87: score += 1
            elif spo2 >= 93:
                if spo2 <= 94: score += 1
                elif spo2 <= 96: score += 2
                else: score += 3
        else:
            # NEWS2 Scale 1 (Normal Target: 96-100%)
            if spo2 <= 91: score += 3
            elif spo2 <= 93: score += 2
            elif spo2 <= 95: score += 1

    # 3. Temperature
    t = vitals.get("temperature")
    if t is not None:
        if t <= 35.0: score += 3
        elif t >= 39.1: score += 2
        elif t <= 36.0 or t >= 38.1: score += 1

    # 4. Systolic Blood Pressure
    sbp = vitals.get("systolic_bp")
    if sbp is not None:
        if sbp <= 90 or sbp >= 220: score += 3
        elif sbp <= 100: score += 2
        elif sbp <= 111: score += 1

    # 5. Heart Rate
    hr = vitals.get("heart_rate")
    if hr is not None:
        if hr <= 40 or hr >= 131: score += 3
        elif hr >= 111: score += 2
        elif hr <= 50 or hr >= 91:
            if hr <= 50 or hr >= 91: score += 1

    # 6. Consciousness (AVPU scale)
    avpu = vitals.get("consciousness", "Alert")
    if avpu != "Alert":
        score += 3

    # Risk level classification
    if score >= 7 or any(v == 3 for v in [score]):  # Single red score parameter
        risk = "RED"
    elif score >= 5:
        risk = "ORANGE"
    elif score >= 1:
        risk = "YELLOW"
    else:
        risk = "GREEN"
        
    return score, risk


@router.post("/", response_model=schemas.VitalOut)
def enter_vitals(vital_data: schemas.VitalCreate, db: Session = Depends(get_db)):
    # Fetch Patient Context
    patient = db.query(models.Patient).filter(models.Patient.id == vital_data.patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient profile not found.")

    vitals_dict = vital_data.model_dump()
    
    # Calculate NEWS2
    score, risk = calculate_news2(vitals_dict, copd=patient.copd)

    # Perform range audit checks
    validation_notes = []
    is_valid = True
    
    if vital_data.systolic_bp and (vital_data.systolic_bp > 280 or vital_data.systolic_bp < 40):
        is_valid = False
        validation_notes.append("Systolic Blood Pressure is out of physiological limits.")
    if vital_data.heart_rate and (vital_data.heart_rate > 240 or vital_data.heart_rate < 25):
        is_valid = False
        validation_notes.append("Pulse Rate is out of physiological limits.")

    vital_record = models.VitalRecord(
        patient_id=vital_data.patient_id,
        systolic_bp=vital_data.systolic_bp,
        diastolic_bp=vital_data.diastolic_bp,
        heart_rate=vital_data.heart_rate,
        spo2=vital_data.spo2,
        temperature=vital_data.temperature,
        respiratory_rate=vital_data.respiratory_rate,
        consciousness=vital_data.consciousness,
        blood_glucose=vital_data.blood_glucose,
        news2_score=score,
        risk_level=risk,
        source=vital_data.source,
        is_validated=is_valid,
        validation_notes="; ".join(validation_notes) if validation_notes else "Vitals within plausible ranges."
    )
    
    db.add(vital_record)
    db.commit()
    db.refresh(vital_record)
    return vital_record


@router.post("/ocr")
async def extract_vitals_ocr(file: UploadFile = File(...)):
    """
    Multimodal Gemini 2.5 Flash Vision OCR image upload route.
    """
    if not GEMINI_API_KEY:
        raise HTTPException(status_code=500, detail="Gemini API Key is not configured on this server.")
        
    try:
        import google.generativeai as genai
        
        image_bytes = await file.read()
        
        genai.configure(api_key=GEMINI_API_KEY)
        image_part = {
            "mime_type": file.content_type or "image/jpeg",
            "data": image_bytes
        }
        
        prompt = """
        You are a highly accurate clinical OCR agent for hospital ICU and ward vital monitors.
        Analyze this vital monitor screen image and extract the numerical values for:
        1. Systolic Blood Pressure (systolic_bp)
        2. Diastolic Blood Pressure (diastolic_bp)
        3. Heart Rate / Pulse (heart_rate)
        4. Oxygen Saturation (spo2)
        5. Respiratory Rate (respiratory_rate)
        6. Temperature in Celsius (temperature)

        Please look at the labels (e.g. SpO2, HR, PR, NIBP, TEMP, RR) and extract the corresponding main numbers.
        If the temperature is in Fahrenheit (e.g. 98.6), convert it to Celsius (37.0).

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
        
        model = genai.GenerativeModel("gemini-2.5-flash")
        response = model.generate_content([prompt, image_part])
        text = response.text.strip()
        
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        text = text.strip()
        
        parsed = json.loads(text)
        return parsed
    except Exception as e:
        print(f"[OCR Route Error] {e}")
        raise HTTPException(status_code=500, detail=f"Failed to parse monitor image: {str(e)}")
