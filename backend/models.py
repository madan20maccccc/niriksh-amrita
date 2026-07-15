from sqlalchemy import (
    Column, Integer, String, Float, Boolean, DateTime,
    ForeignKey, Text, Enum as SAEnum
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base
import enum


# ─────────────────────────────────────────────
# Enums
# ─────────────────────────────────────────────
class UserRole(str, enum.Enum):
    admin = "admin"
    nurse = "nurse"
    doctor = "doctor"
    supervisor = "supervisor"


class ShiftType(str, enum.Enum):
    morning = "morning"    # 6 AM – 2 PM
    evening = "evening"    # 2 PM – 10 PM
    night = "night"        # 10 PM – 6 AM


class RiskLevel(str, enum.Enum):
    green = "GREEN"
    yellow = "YELLOW"
    orange = "ORANGE"
    red = "RED"


class AlertStatus(str, enum.Enum):
    active = "active"
    acknowledged = "acknowledged"
    resolved = "resolved"
    escalated = "escalated"


class EscalationTarget(str, enum.Enum):
    dashboard = "Dashboard Only"
    nurse = "Assigned Nurse"
    supervisor = "Nursing Supervisor"
    duty_doctor = "Duty Doctor"
    rapid_response = "Rapid Response Team"
    icu_team = "ICU Team"


# ─────────────────────────────────────────────
# User / Auth
# ─────────────────────────────────────────────
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(String, unique=True, index=True)
    full_name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String, nullable=False)
    role = Column(SAEnum(UserRole), default=UserRole.nurse)
    department = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    assigned_patients = relationship("Patient", back_populates="assigned_nurse")
    vitals_entered = relationship("Vital", back_populates="entered_by_user")
    acknowledged_alerts = relationship("Alert", back_populates="acknowledged_by_user")
    audit_logs = relationship("AuditLog", back_populates="user")


# ─────────────────────────────────────────────
# Ward
# ─────────────────────────────────────────────
class Ward(Base):
    __tablename__ = "wards"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, unique=True)
    floor = Column(Integer, nullable=False)
    capacity = Column(Integer, default=20)
    ward_type = Column(String, default="General")  # ICU, CCU, General, Pediatric, etc.
    head_nurse_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    doctor_phone = Column(String, nullable=True)      # Ward doctor's personal phone
    callmebot_key = Column(String, nullable=True)     # Doctor's specific callmebot apikey

    patients = relationship("Patient", back_populates="ward")


# ─────────────────────────────────────────────
# Patient
# ─────────────────────────────────────────────
class Patient(Base):
    __tablename__ = "patients"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(String, unique=True, index=True)  # e.g. AMR-2024-0001
    full_name = Column(String, nullable=False)
    age = Column(Integer, nullable=False)
    gender = Column(String, nullable=False)
    bed_number = Column(String, nullable=False)
    ward_id = Column(Integer, ForeignKey("wards.id"))
    assigned_nurse_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    # Clinical context
    primary_diagnosis = Column(String, nullable=False)
    comorbidities = Column(Text, nullable=True)       # JSON string list
    current_medications = Column(Text, nullable=True)  # JSON string list
    allergies = Column(Text, nullable=True)
    admission_date = Column(DateTime(timezone=True), server_default=func.now())
    is_active = Column(Boolean, default=True)          # False = discharged

    # Risk factors
    diabetes = Column(Boolean, default=False)
    hypertension = Column(Boolean, default=False)
    copd = Column(Boolean, default=False)
    post_surgery = Column(Boolean, default=False)
    cardiac_history = Column(Boolean, default=False)

    # Relationships
    ward = relationship("Ward", back_populates="patients")
    assigned_nurse = relationship("User", back_populates="assigned_patients")
    vitals = relationship("Vital", back_populates="patient", order_by="desc(Vital.recorded_at)")
    alerts = relationship("Alert", back_populates="patient", order_by="desc(Alert.created_at)")
    sbar_reports = relationship("SBARReport", back_populates="patient")
    audit_logs = relationship("AuditLog", back_populates="patient")


# ─────────────────────────────────────────────
# Vital Signs
# ─────────────────────────────────────────────
class Vital(Base):
    __tablename__ = "vitals"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"))
    entered_by = Column(Integer, ForeignKey("users.id"))
    shift = Column(SAEnum(ShiftType), nullable=False)
    recorded_at = Column(DateTime(timezone=True), server_default=func.now())

    # Vitals
    systolic_bp = Column(Float, nullable=True)        # mmHg
    diastolic_bp = Column(Float, nullable=True)       # mmHg
    heart_rate = Column(Float, nullable=True)         # bpm
    respiratory_rate = Column(Float, nullable=True)   # breaths/min
    spo2 = Column(Float, nullable=True)               # %
    temperature = Column(Float, nullable=True)        # °C
    consciousness = Column(String, nullable=True)      # AVPU: Alert/Voice/Pain/Unresponsive
    blood_glucose = Column(Float, nullable=True)      # mg/dL
    urine_output = Column(Float, nullable=True)       # mL/hr (last 4h)

    # Computed by agents
    news2_score = Column(Integer, nullable=True)
    risk_level = Column(SAEnum(RiskLevel), nullable=True)

    # Source
    source = Column(String, default="nurse_manual")  # nurse_manual / bedside_monitor / emr

    # Validation flags
    is_validated = Column(Boolean, default=False)
    validation_notes = Column(Text, nullable=True)

    # Relationships
    patient = relationship("Patient", back_populates="vitals")
    entered_by_user = relationship("User", back_populates="vitals_entered")
    ews_score = relationship("EWSScore", back_populates="vital", uselist=False)


# ─────────────────────────────────────────────
# EWS Score (NEWS2)
# ─────────────────────────────────────────────
class EWSScore(Base):
    __tablename__ = "ews_scores"

    id = Column(Integer, primary_key=True, index=True)
    vital_id = Column(Integer, ForeignKey("vitals.id"), unique=True)
    patient_id = Column(Integer, ForeignKey("patients.id"))

    # Component scores
    resp_rate_score = Column(Integer, default=0)
    spo2_score = Column(Integer, default=0)
    temp_score = Column(Integer, default=0)
    bp_score = Column(Integer, default=0)
    hr_score = Column(Integer, default=0)
    consciousness_score = Column(Integer, default=0)

    total_score = Column(Integer, default=0)
    clinical_risk = Column(String)   # Low / Medium / High / Very High
    response_required = Column(String)

    calculated_at = Column(DateTime(timezone=True), server_default=func.now())

    vital = relationship("Vital", back_populates="ews_score")


# ─────────────────────────────────────────────
# Alert
# ─────────────────────────────────────────────
class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"))
    vital_id = Column(Integer, ForeignKey("vitals.id"), nullable=True)

    alert_type = Column(String)         # threshold / trend / ews / escalation
    risk_level = Column(SAEnum(RiskLevel), nullable=False)
    message = Column(Text, nullable=False)
    details = Column(Text, nullable=True)   # JSON: which vitals triggered it

    status = Column(SAEnum(AlertStatus), default=AlertStatus.active)
    escalation_target = Column(SAEnum(EscalationTarget), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    acknowledged_at = Column(DateTime(timezone=True), nullable=True)
    acknowledged_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)

    # Did closure agent act?
    closure_checked_at = Column(DateTime(timezone=True), nullable=True)
    re_escalated = Column(Boolean, default=False)

    # Relationships
    patient = relationship("Patient", back_populates="alerts")
    acknowledged_by_user = relationship("User", back_populates="acknowledged_alerts")


# ─────────────────────────────────────────────
# SBAR Report
# ─────────────────────────────────────────────
class SBARReport(Base):
    __tablename__ = "sbar_reports"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"))
    vital_id = Column(Integer, ForeignKey("vitals.id"), nullable=True)
    shift = Column(SAEnum(ShiftType), nullable=False)

    # LLM generated sections
    situation = Column(Text, nullable=False)
    background = Column(Text, nullable=False)
    assessment = Column(Text, nullable=False)
    recommendation = Column(Text, nullable=False)

    generated_by = Column(String, default="gemini")   # gemini / template
    generated_at = Column(DateTime(timezone=True), server_default=func.now())

    patient = relationship("Patient", back_populates="sbar_reports")


# ─────────────────────────────────────────────
# Audit Log
# ─────────────────────────────────────────────
class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=True)

    action = Column(String, nullable=False)       # vitals_entered, alert_acknowledged, sbar_generated, etc.
    entity_type = Column(String, nullable=True)   # vital, alert, patient, user
    entity_id = Column(Integer, nullable=True)
    details = Column(Text, nullable=True)         # JSON with context
    ip_address = Column(String, nullable=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="audit_logs")
    patient = relationship("Patient", back_populates="audit_logs")


# ─────────────────────────────────────────────
# Rule Suggestions (Learning Agent)
# ─────────────────────────────────────────────
class RuleSuggestion(Base):
    __tablename__ = "rule_suggestions"

    id = Column(Integer, primary_key=True, index=True)
    rule_type = Column(String, nullable=False)
    current_rule = Column(Text, nullable=False)
    suggested_rule = Column(Text, nullable=False)
    reason = Column(Text, nullable=False)
    evidence_count = Column(Integer, default=0)
    status = Column(String, default="pending")    # pending / approved / rejected
    reviewed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
