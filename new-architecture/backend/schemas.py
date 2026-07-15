from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class PatientBase(BaseModel):
    full_name: str
    age: int
    gender: str
    bed_number: str
    primary_diagnosis: str
    diabetes: bool = False
    copd: bool = False
    hypertension: bool = False
    post_surgery: bool = False

class PatientCreate(PatientBase):
    pass

class PatientOut(PatientBase):
    id: int

    class Config:
        from_attributes = True


class VitalCreate(BaseModel):
    patient_id: int
    systolic_bp: Optional[float] = None
    diastolic_bp: Optional[float] = None
    heart_rate: Optional[float] = None
    spo2: Optional[float] = None
    temperature: Optional[float] = None
    respiratory_rate: Optional[float] = None
    consciousness: Optional[str] = "Alert"
    blood_glucose: Optional[float] = None
    source: Optional[str] = "nurse_manual"

class VitalOut(BaseModel):
    id: int
    patient_id: int
    recorded_at: datetime
    systolic_bp: Optional[float]
    diastolic_bp: Optional[float]
    heart_rate: Optional[float]
    spo2: Optional[float]
    temperature: Optional[float]
    respiratory_rate: Optional[float]
    consciousness: str
    blood_glucose: Optional[float]
    news2_score: int
    risk_level: str
    source: str
    is_validated: bool
    validation_notes: Optional[str]

    class Config:
        from_attributes = True
