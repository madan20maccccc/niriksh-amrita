from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from database import get_db
import models, schemas
from auth import get_current_user
from agents.shift_handover import generate_shift_sbar, get_current_shift
from innovations.multilingual import translate_sbar

router = APIRouter()

@router.get("/patient/{patient_id}", response_model=List[schemas.SBAROut])
def get_patient_sbars(
    patient_id: int,
    limit: int = 10,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    reports = (
        db.query(models.SBARReport)
        .filter(models.SBARReport.patient_id == patient_id)
        .order_by(models.SBARReport.generated_at.desc())
        .limit(limit)
        .all()
    )
    return [schemas.SBAROut.model_validate(r) for r in reports]


@router.post("/generate/{patient_id}", response_model=schemas.SBAROut)
def generate_sbar_now(
    patient_id: int,
    lang: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Manually trigger SBAR generation for a patient"""
    shift = get_current_shift()
    
    # Try to find an existing SBAR for this patient and shift
    report = (
        db.query(models.SBARReport)
        .filter(models.SBARReport.patient_id == patient_id, models.SBARReport.shift == shift)
        .order_by(models.SBARReport.generated_at.desc())
        .first()
    )
    
    if not report:
        # Fallback: find any SBAR generated in the last 4 hours
        from datetime import datetime, timedelta
        four_hours_ago = datetime.now() - timedelta(hours=4)
        report = (
            db.query(models.SBARReport)
            .filter(models.SBARReport.patient_id == patient_id, models.SBARReport.generated_at >= four_hours_ago)
            .order_by(models.SBARReport.generated_at.desc())
            .first()
        )
        
    if not report:
        report = generate_shift_sbar(db, patient_id, shift)
        
    if not report:
        raise HTTPException(status_code=404, detail="No vitals found for this shift to generate SBAR")
    
    sbar_out = schemas.SBAROut.model_validate(report)
    if lang:
        translated = translate_sbar(sbar_out.model_dump(mode="json"), lang)
        sbar_out.situation = translated.get("situation", sbar_out.situation)
        sbar_out.background = translated.get("background", sbar_out.background)
        sbar_out.assessment = translated.get("assessment", sbar_out.assessment)
        sbar_out.recommendation = translated.get("recommendation", sbar_out.recommendation)
        sbar_out.generated_by = f"{sbar_out.generated_by} (Translated: {translated.get('language', lang)})"
        
    return sbar_out


@router.get("/{sbar_id}", response_model=schemas.SBAROut)
def get_sbar(
    sbar_id: int,
    lang: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    report = db.query(models.SBARReport).filter(models.SBARReport.id == sbar_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="SBAR report not found")
        
    sbar_out = schemas.SBAROut.model_validate(report)
    if lang:
        translated = translate_sbar(sbar_out.model_dump(mode="json"), lang)
        sbar_out.situation = translated.get("situation", sbar_out.situation)
        sbar_out.background = translated.get("background", sbar_out.background)
        sbar_out.assessment = translated.get("assessment", sbar_out.assessment)
        sbar_out.recommendation = translated.get("recommendation", sbar_out.recommendation)
        sbar_out.generated_by = f"{sbar_out.generated_by} (Translated: {translated.get('language', lang)})"
        
    return sbar_out

