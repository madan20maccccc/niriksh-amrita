# Agent 6 — EWS (NEWS2) Calculator
# National Early Warning Score 2 — standard UK clinical protocol
# Scores each vital, sums up, classifies clinical risk

from typing import Optional


def score_resp_rate(rr: Optional[float]) -> int:
    if rr is None: return 0
    if rr <= 8:    return 3
    if rr <= 11:   return 1
    if rr <= 20:   return 0
    if rr <= 24:   return 2
    return 3  # >= 25


def score_spo2(spo2: Optional[float], copd: bool = False) -> int:
    """NEWS2 has two SpO2 scales — Scale 2 for COPD patients"""
    if spo2 is None: return 0
    if copd:
        # Scale 2: target range 88–92%
        if spo2 <= 83:    return 3
        if spo2 <= 85:    return 2
        if spo2 <= 87:    return 1
        if spo2 <= 92:    return 0
        if spo2 <= 94:    return 1
        if spo2 <= 96:    return 2
        return 3
    else:
        # Scale 1: normal target >= 95%
        if spo2 <= 91:    return 3
        if spo2 <= 93:    return 2
        if spo2 <= 95:    return 1
        return 0


def score_temperature(temp: Optional[float]) -> int:
    if temp is None: return 0
    if temp <= 35.0:   return 3
    if temp <= 36.0:   return 1
    if temp <= 38.0:   return 0
    if temp <= 39.0:   return 1
    return 2  # >= 39.1


def score_systolic_bp(sbp: Optional[float]) -> int:
    if sbp is None: return 0
    if sbp <= 90:    return 3
    if sbp <= 100:   return 2
    if sbp <= 110:   return 1
    if sbp <= 219:   return 0
    return 3  # >= 220


def score_heart_rate(hr: Optional[float]) -> int:
    if hr is None: return 0
    if hr <= 40:    return 3
    if hr <= 50:    return 1
    if hr <= 90:    return 0
    if hr <= 110:   return 1
    if hr <= 130:   return 2
    return 3  # >= 131


def score_consciousness(avpu: Optional[str]) -> int:
    if avpu is None or avpu == "Alert": return 0
    return 3  # Voice / Pain / Unresponsive all = 3


def get_clinical_risk(total: int) -> tuple[str, str]:
    """Returns (clinical_risk, response_required)"""
    if total == 0:
        return "Low", "Minimum 12-hourly monitoring"
    if total <= 4:
        return "Low", "Minimum 4–6 hourly monitoring"
    if total == 5 or total == 6:
        return "Medium", "Urgent review by ward nurse/doctor within 1 hour"
    if total >= 7:
        return "High", "Emergency assessment — continuous monitoring, consider ICU"
    # Special case: single parameter = 3
    return "Medium", "Urgent review within 1 hour"


def calculate_news2(vital_data: dict, copd: bool = False) -> dict:
    """
    vital_data: dict with keys from VitalCreate
    Returns full breakdown + total score + risk
    """
    rr_score   = score_resp_rate(vital_data.get("respiratory_rate"))
    spo2_score = score_spo2(vital_data.get("spo2"), copd)
    temp_score = score_temperature(vital_data.get("temperature"))
    bp_score   = score_systolic_bp(vital_data.get("systolic_bp"))
    hr_score   = score_heart_rate(vital_data.get("heart_rate"))
    con_score  = score_consciousness(vital_data.get("consciousness"))

    total = rr_score + spo2_score + temp_score + bp_score + hr_score + con_score

    # Check if any single parameter scores 3 (immediate concern)
    max_single = max(rr_score, spo2_score, temp_score, bp_score, hr_score, con_score)
    if max_single == 3 and total < 5:
        clinical_risk = "Medium"
        response = "Urgent review within 1 hour (single-parameter alert)"
    else:
        clinical_risk, response = get_clinical_risk(total)

    return {
        "resp_rate_score":    rr_score,
        "spo2_score":         spo2_score,
        "temp_score":         temp_score,
        "bp_score":           bp_score,
        "hr_score":           hr_score,
        "consciousness_score": con_score,
        "total_score":        total,
        "clinical_risk":      clinical_risk,
        "response_required":  response,
    }
