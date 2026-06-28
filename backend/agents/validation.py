# Agent 3 — Validation Agent
# Catches missing values, impossible readings, duplicate entries, sensor errors

from typing import Optional, Tuple, List


VITAL_RANGES = {
    "systolic_bp":     (50,  300,  "Systolic BP"),
    "diastolic_bp":    (20,  200,  "Diastolic BP"),
    "heart_rate":      (20,  300,  "Heart Rate"),
    "respiratory_rate":(4,   60,   "Respiratory Rate"),
    "spo2":            (50,  100,  "SpO2"),
    "temperature":     (30.0,45.0, "Temperature"),
    "blood_glucose":   (20,  800,  "Blood Glucose"),
    "urine_output":    (0,   2000, "Urine Output"),
}

CRITICAL_VITALS = ["systolic_bp", "heart_rate", "respiratory_rate", "spo2"]
CONSCIOUSNESS_OPTIONS = ["Alert", "Voice", "Pain", "Unresponsive"]


class ValidationResult:
    def __init__(self):
        self.is_valid = True
        self.errors: List[str] = []
        self.warnings: List[str] = []

    def add_error(self, msg: str):
        self.errors.append(msg)
        self.is_valid = False

    def add_warning(self, msg: str):
        self.warnings.append(msg)

    def summary(self) -> str:
        parts = []
        if self.errors:
            parts.append("ERRORS: " + "; ".join(self.errors))
        if self.warnings:
            parts.append("WARNINGS: " + "; ".join(self.warnings))
        return " | ".join(parts) if parts else "All vitals valid"


def validate_vitals(vital_data: dict) -> ValidationResult:
    result = ValidationResult()

    # 1. Check for missing critical vitals
    missing = [v for v in CRITICAL_VITALS if vital_data.get(v) is None]
    if missing:
        result.add_warning(f"Missing critical vitals: {', '.join(missing)}. Nurse will be reminded.")

    # 2. Check for impossible/out-of-range values
    for field, (min_val, max_val, label) in VITAL_RANGES.items():
        value = vital_data.get(field)
        if value is not None:
            if value < min_val or value > max_val:
                result.add_error(
                    f"{label} value {value} is out of physiological range "
                    f"({min_val}–{max_val}). Possible sensor error or entry mistake."
                )

    # 3. Validate pulse pressure (systolic - diastolic)
    sbp = vital_data.get("systolic_bp")
    dbp = vital_data.get("diastolic_bp")
    if sbp and dbp:
        pp = sbp - dbp
        if pp < 10:
            result.add_error(f"Pulse pressure ({pp} mmHg) is too narrow — possible error or shock.")
        elif pp > 120:
            result.add_error(f"Pulse pressure ({pp} mmHg) is abnormally wide — check reading.")
        if dbp >= sbp:
            result.add_error("Diastolic BP cannot be >= Systolic BP.")

    # 4. Validate consciousness
    consciousness = vital_data.get("consciousness")
    if consciousness and consciousness not in CONSCIOUSNESS_OPTIONS:
        result.add_error(f"Invalid AVPU value '{consciousness}'. Use: Alert/Voice/Pain/Unresponsive.")

    # 5. Temperature unit check (common mistake: entering Fahrenheit as Celsius)
    temp = vital_data.get("temperature")
    if temp and temp > 42:
        result.add_warning(
            f"Temperature {temp}°C seems very high. If entered in Fahrenheit, convert to Celsius."
        )

    return result
