from sqlalchemy import Column, Integer, String, Float, Boolean, ForeignKey, DateTime
from sqlalchemy.sql import func
from database import Base

class Patient(Base):
    """
    EMR Patient Profile Table.
    Holds demographics and physiological pre-screen flags (COPD, diabetes, hypertension).
    """
    __tablename__ = "patients"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String, nullable=False)
    age = Column(Integer, nullable=False)
    gender = Column(String, nullable=False)
    bed_number = Column(String, nullable=False, unique=True)
    primary_diagnosis = Column(String, nullable=False)
    
    # Comorbidity flags that alter EWS scoring algorithms
    diabetes = Column(Boolean, default=False)
    copd = Column(Boolean, default=False)  # Alters oxygen saturation scoring (NEWS2 scale 2)
    hypertension = Column(Boolean, default=False)
    post_surgery = Column(Boolean, default=False)


class VitalRecord(Base):
    """
    Clinical Physiological Vital Round logs.
    Saves readings, calculated risk level, and ingestion source (manual vs. OCR).
    """
    __tablename__ = "vital_records"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    recorded_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Physiological readings
    systolic_bp = Column(Float, nullable=True)
    diastolic_bp = Column(Float, nullable=True)
    heart_rate = Column(Float, nullable=True)
    spo2 = Column(Float, nullable=True)
    temperature = Column(Float, nullable=True)
    respiratory_rate = Column(Float, nullable=True)
    consciousness = Column(String, default="Alert")  # AVPU: Alert, Voice, Pain, Unresponsive
    blood_glucose = Column(Float, nullable=True)
    
    # Output scoring
    news2_score = Column(Integer, default=0)
    risk_level = Column(String, default="GREEN")  # GREEN, YELLOW, ORANGE, RED
    
    # Audit ingestion parameters
    source = Column(String, default="nurse_manual")  # nurse_manual, ocr_scan
    is_validated = Column(Boolean, default=True)
    validation_notes = Column(String, nullable=True)
