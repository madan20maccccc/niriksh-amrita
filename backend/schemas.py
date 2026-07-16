from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime
from models import UserRole, ShiftType, RiskLevel, AlertStatus, EscalationTarget


# ─────────────────────────────────────────────
# Auth
# ─────────────────────────────────────────────
class LoginRequest(BaseModel):
    email: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str
    user: "UserOut"

class UserCreate(BaseModel):
    employee_id: str
    full_name: str
    email: str
    password: str
    role: UserRole = UserRole.nurse
    department: Optional[str] = None
    phone: Optional[str] = None

class UserOut(BaseModel):
    id: int
    employee_id: str
    full_name: str
    email: str
    role: UserRole
    department: Optional[str]
    phone: Optional[str] = None
    is_active: bool
    class Config:
        from_attributes = True


class UserUpdate(BaseModel):
    full_name: str
    email: str
    role: UserRole
    department: Optional[str] = None
    phone: Optional[str] = None

class PasswordResetRequest(BaseModel):
    password: str

# ─────────────────────────────────────────────
# Ward
# ─────────────────────────────────────────────
class WardCreate(BaseModel):
    name: str
    floor: int
    capacity: int = 20
    ward_type: str = "General"
    doctor_phone: Optional[str] = None             # Level 1: Duty Doctor
    callmebot_key: Optional[str] = None
    senior_doctor_phone: Optional[str] = None       # Level 2: Senior Doctor / Consultant
    nursing_supervisor_phone: Optional[str] = None  # Level 3: Nursing Supervisor / HOD
    admin_phone: Optional[str] = None               # Level 4: Admin Office / Med Supt

class WardOut(BaseModel):
    id: int
    name: str
    floor: int
    capacity: int
    ward_type: str
    doctor_phone: Optional[str] = None
    callmebot_key: Optional[str] = None
    senior_doctor_phone: Optional[str] = None
    nursing_supervisor_phone: Optional[str] = None
    admin_phone: Optional[str] = None
    class Config:
        from_attributes = True


# ─────────────────────────────────────────────
# Patient
# ─────────────────────────────────────────────
class PatientCreate(BaseModel):
    full_name: str
    age: int
    gender: str
    bed_number: str
    ward_id: int
    assigned_nurse_id: Optional[int] = None
    primary_diagnosis: str
    comorbidities: Optional[List[str]] = []
    current_medications: Optional[List[str]] = []
    allergies: Optional[str] = None
    diabetes: bool = False
    hypertension: bool = False
    copd: bool = False
    post_surgery: bool = False
    cardiac_history: bool = False

class PatientOut(BaseModel):
    id: int
    patient_id: str
    full_name: str
    age: int
    gender: str
    bed_number: str
    ward_id: int
    primary_diagnosis: str
    comorbidities: Optional[str]
    current_medications: Optional[str]
    diabetes: bool
    hypertension: bool
    copd: bool
    post_surgery: bool
    cardiac_history: bool
    is_active: bool
    admission_date: datetime
    assigned_nurse_id: Optional[int]
    class Config:
        from_attributes = True

class PatientSummary(BaseModel):
    """Lightweight patient card for dashboard list"""
    id: int
    patient_id: str
    full_name: str
    age: int
    gender: str
    bed_number: str
    ward_id: int
    primary_diagnosis: str
    is_active: bool = True
    assigned_nurse_id: Optional[int] = None
    latest_risk_level: Optional[str] = None
    latest_news2: Optional[int] = None
    active_alerts: int = 0
    last_vitals_at: Optional[datetime] = None
    latest_systolic_bp: Optional[float] = None
    latest_diastolic_bp: Optional[float] = None
    latest_heart_rate: Optional[float] = None
    latest_spo2: Optional[float] = None
    class Config:
        from_attributes = True


# ─────────────────────────────────────────────
# Vitals
# ─────────────────────────────────────────────
class VitalCreate(BaseModel):
    patient_id: int
    shift: ShiftType
    systolic_bp: Optional[float] = Field(None, ge=50, le=300)
    diastolic_bp: Optional[float] = Field(None, ge=30, le=200)
    heart_rate: Optional[float] = Field(None, ge=20, le=300)
    respiratory_rate: Optional[float] = Field(None, ge=4, le=60)
    spo2: Optional[float] = Field(None, ge=50, le=100)
    temperature: Optional[float] = Field(None, ge=30, le=45)
    consciousness: Optional[str] = "Alert"  # AVPU
    blood_glucose: Optional[float] = Field(None, ge=20, le=800)
    urine_output: Optional[float] = Field(None, ge=0, le=2000)
    source: str = "nurse_manual"

class VitalOut(BaseModel):
    id: int
    patient_id: int
    entered_by: int
    shift: ShiftType
    recorded_at: datetime
    systolic_bp: Optional[float]
    diastolic_bp: Optional[float]
    heart_rate: Optional[float]
    respiratory_rate: Optional[float]
    spo2: Optional[float]
    temperature: Optional[float]
    consciousness: Optional[str]
    blood_glucose: Optional[float]
    urine_output: Optional[float]
    news2_score: Optional[int]
    risk_level: Optional[RiskLevel]
    is_validated: bool
    validation_notes: Optional[str]
    source: str
    class Config:
        from_attributes = True


# ─────────────────────────────────────────────
# EWS Score
# ─────────────────────────────────────────────
class EWSScoreOut(BaseModel):
    vital_id: int
    resp_rate_score: int
    spo2_score: int
    temp_score: int
    bp_score: int
    hr_score: int
    consciousness_score: int
    total_score: int
    clinical_risk: str
    response_required: str
    class Config:
        from_attributes = True


# ─────────────────────────────────────────────
# Alert
# ─────────────────────────────────────────────
class AlertOut(BaseModel):
    id: int
    patient_id: int
    vital_id: Optional[int]
    alert_type: str
    risk_level: RiskLevel
    message: str
    details: Optional[str]
    status: AlertStatus
    escalation_target: Optional[EscalationTarget]
    created_at: datetime
    acknowledged_at: Optional[datetime]
    acknowledged_by: Optional[int]
    re_escalated: bool
    class Config:
        from_attributes = True

class AlertAcknowledge(BaseModel):
    alert_id: int
    action_taken: Optional[str] = None


# ─────────────────────────────────────────────
# SBAR
# ─────────────────────────────────────────────
class SBAROut(BaseModel):
    id: int
    patient_id: int
    shift: ShiftType
    situation: str
    background: str
    assessment: str
    recommendation: str
    generated_by: str
    generated_at: datetime
    class Config:
        from_attributes = True


# ─────────────────────────────────────────────
# Audit Log
# ─────────────────────────────────────────────
class AuditLogOut(BaseModel):
    id: int
    user_id: Optional[int]
    patient_id: Optional[int]
    action: str
    entity_type: Optional[str]
    entity_id: Optional[int]
    details: Optional[str]
    timestamp: datetime
    class Config:
        from_attributes = True


# ─────────────────────────────────────────────
# Analytics
# ─────────────────────────────────────────────
class WardStats(BaseModel):
    ward_id: int
    ward_name: str
    total_patients: int
    green_count: int
    yellow_count: int
    orange_count: int
    red_count: int
    active_alerts: int
    avg_news2: Optional[float]

class AnalyticsSummary(BaseModel):
    total_patients: int
    total_active_alerts: int
    avg_response_time_minutes: Optional[float]
    alert_volume_by_day: List[dict]
    top_risk_patients: List[dict]
    ward_stats: List[WardStats]
