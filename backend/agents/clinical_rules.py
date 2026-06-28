# Agent 5 — Clinical Rule Engine
# Applies threshold rules, trend rules, and patient-specific rules

from typing import List, Dict, Optional


class ClinicalAlert:
    def __init__(self, rule_type: str, message: str, severity: str, details: dict = None):
        self.rule_type = rule_type      # threshold / trend / patient_specific
        self.message = message
        self.severity = severity        # LOW / MEDIUM / HIGH / CRITICAL
        self.details = details or {}


# ── 1. ABSOLUTE THRESHOLD RULES ──────────────────────────────────────
def check_threshold_rules(vitals: dict) -> List[ClinicalAlert]:
    alerts = []

    sbp = vitals.get("systolic_bp")
    hr  = vitals.get("heart_rate")
    rr  = vitals.get("respiratory_rate")
    spo2 = vitals.get("spo2")
    temp = vitals.get("temperature")
    consciousness = vitals.get("consciousness")
    glucose = vitals.get("blood_glucose")

    # Blood Pressure
    if sbp is not None:
        if sbp > 180:
            alerts.append(ClinicalAlert(
                "threshold", f"CRITICAL: Systolic BP {sbp} mmHg — hypertensive crisis",
                "CRITICAL", {"vital": "systolic_bp", "value": sbp, "threshold": 180}
            ))
        elif sbp > 160:
            alerts.append(ClinicalAlert(
                "threshold", f"HIGH: Systolic BP {sbp} mmHg — severe hypertension",
                "HIGH", {"vital": "systolic_bp", "value": sbp}
            ))
        elif sbp < 90:
            alerts.append(ClinicalAlert(
                "threshold", f"CRITICAL: Systolic BP {sbp} mmHg — hypotensive shock risk",
                "CRITICAL", {"vital": "systolic_bp", "value": sbp}
            ))

    # Heart Rate
    if hr is not None:
        if hr > 130:
            alerts.append(ClinicalAlert(
                "threshold", f"CRITICAL: Heart Rate {hr} bpm — tachycardia",
                "CRITICAL", {"vital": "heart_rate", "value": hr}
            ))
        elif hr < 40:
            alerts.append(ClinicalAlert(
                "threshold", f"CRITICAL: Heart Rate {hr} bpm — severe bradycardia",
                "CRITICAL", {"vital": "heart_rate", "value": hr}
            ))

    # Respiratory Rate
    if rr is not None:
        if rr >= 25:
            alerts.append(ClinicalAlert(
                "threshold", f"CRITICAL: Respiratory Rate {rr}/min — respiratory distress",
                "CRITICAL", {"vital": "respiratory_rate", "value": rr}
            ))
        elif rr <= 8:
            alerts.append(ClinicalAlert(
                "threshold", f"CRITICAL: Respiratory Rate {rr}/min — respiratory depression",
                "CRITICAL", {"vital": "respiratory_rate", "value": rr}
            ))

    # SpO2
    if spo2 is not None:
        if spo2 < 92:
            alerts.append(ClinicalAlert(
                "threshold", f"CRITICAL: SpO2 {spo2}% — oxygen supplementation needed",
                "CRITICAL", {"vital": "spo2", "value": spo2}
            ))
        elif spo2 < 95:
            alerts.append(ClinicalAlert(
                "threshold", f"HIGH: SpO2 {spo2}% — low oxygen saturation",
                "HIGH", {"vital": "spo2", "value": spo2}
            ))

    # Temperature
    if temp is not None:
        if temp >= 39.0:
            alerts.append(ClinicalAlert(
                "threshold", f"HIGH: Temperature {temp}°C — fever/hyperthermia",
                "HIGH", {"vital": "temperature", "value": temp}
            ))
        elif temp <= 35.0:
            alerts.append(ClinicalAlert(
                "threshold", f"CRITICAL: Temperature {temp}°C — hypothermia",
                "CRITICAL", {"vital": "temperature", "value": temp}
            ))

    # Consciousness
    if consciousness and consciousness != "Alert":
        severity = "CRITICAL" if consciousness in ["Pain", "Unresponsive"] else "HIGH"
        alerts.append(ClinicalAlert(
            "threshold", f"{severity}: Consciousness level '{consciousness}' — AVPU deterioration",
            severity, {"vital": "consciousness", "value": consciousness}
        ))

    # Blood Glucose
    if glucose is not None:
        if glucose < 70:
            alerts.append(ClinicalAlert(
                "threshold", f"CRITICAL: Blood Glucose {glucose} mg/dL — hypoglycemia",
                "CRITICAL", {"vital": "blood_glucose", "value": glucose}
            ))
        elif glucose > 400:
            alerts.append(ClinicalAlert(
                "threshold", f"HIGH: Blood Glucose {glucose} mg/dL — severe hyperglycemia",
                "HIGH", {"vital": "blood_glucose", "value": glucose}
            ))

    return alerts


# ── 2. PATIENT-SPECIFIC RULES ─────────────────────────────────────────
def check_patient_specific_rules(vitals: dict, patient_context: dict) -> List[ClinicalAlert]:
    alerts = []
    sbp = vitals.get("systolic_bp")
    glucose = vitals.get("blood_glucose")
    rr = vitals.get("respiratory_rate")

    # Diabetic patient — tighter glucose control
    if patient_context.get("diabetes") and glucose is not None:
        if glucose > 250:
            alerts.append(ClinicalAlert(
                "patient_specific",
                f"Diabetic patient: Blood glucose {glucose} mg/dL — monitor for DKA",
                "HIGH", {"vital": "blood_glucose", "value": glucose, "condition": "diabetes"}
            ))

    # COPD patient — SpO2 target is different (88–92%)
    spo2 = vitals.get("spo2")
    if patient_context.get("copd") and spo2 is not None:
        if spo2 > 92:
            alerts.append(ClinicalAlert(
                "patient_specific",
                f"COPD patient: SpO2 {spo2}% is above target range (88–92%). Risk of hypercapnia.",
                "MEDIUM", {"vital": "spo2", "value": spo2, "condition": "copd"}
            ))
        if rr and rr >= 20:
            alerts.append(ClinicalAlert(
                "patient_specific",
                f"COPD patient: RR {rr}/min — watch for acute exacerbation",
                "HIGH", {"vital": "respiratory_rate", "value": rr, "condition": "copd"}
            ))

    # Post-surgery — watch for hypo/hyperthermia
    temp = vitals.get("temperature")
    if patient_context.get("post_surgery"):
        if temp and temp >= 38.5:
            alerts.append(ClinicalAlert(
                "patient_specific",
                f"Post-surgery patient: Temp {temp}°C — possible surgical site infection",
                "HIGH", {"vital": "temperature", "value": temp, "condition": "post_surgery"}
            ))

    # Hypertension — BP still too high or dangerously low (medication effect)
    if patient_context.get("hypertension") and sbp is not None:
        if sbp > 160:
            alerts.append(ClinicalAlert(
                "patient_specific",
                f"Hypertensive patient: BP {sbp} — medication may need review",
                "HIGH", {"vital": "systolic_bp", "value": sbp, "condition": "hypertension"}
            ))
        elif sbp < 100:
            alerts.append(ClinicalAlert(
                "patient_specific",
                f"Hypertensive patient: BP {sbp} — possible over-medication, hypotension risk",
                "HIGH", {"vital": "systolic_bp", "value": sbp, "condition": "hypertension"}
            ))

    # Cardiac history — any tachycardia/bradycardia is more dangerous
    hr = vitals.get("heart_rate")
    if patient_context.get("cardiac_history") and hr is not None:
        if hr > 110 or hr < 50:
            alerts.append(ClinicalAlert(
                "patient_specific",
                f"Cardiac patient: HR {hr} bpm — arrhythmia risk elevated",
                "HIGH", {"vital": "heart_rate", "value": hr, "condition": "cardiac_history"}
            ))

    return alerts


def run_clinical_rules(vitals: dict, patient_context: dict) -> List[ClinicalAlert]:
    """Main entry — runs all rule categories"""
    alerts = []
    alerts.extend(check_threshold_rules(vitals))
    alerts.extend(check_patient_specific_rules(vitals, patient_context))
    return alerts
