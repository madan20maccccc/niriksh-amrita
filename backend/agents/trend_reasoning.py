# Agent 7 — Trend Reasoning Agent
# Detects worsening trends across multiple shifts and flags deterioration patterns

from typing import List, Optional
from dataclasses import dataclass


@dataclass
class TrendAlert:
    vital: str
    direction: str          # "worsening" | "improving"
    shifts_count: int
    values: List[float]
    severity: str           # LOW / MEDIUM / HIGH / CRITICAL
    message: str


VITAL_DISPLAY = {
    "systolic_bp": "Systolic BP",
    "heart_rate": "Heart Rate",
    "respiratory_rate": "Respiratory Rate",
    "spo2": "SpO2",
    "temperature": "Temperature",
    "news2_score": "NEWS2 Score",
}

# How much change per shift is "significant"
SIGNIFICANT_CHANGE = {
    "systolic_bp": 15,       # mmHg per shift
    "heart_rate": 15,        # bpm per shift
    "respiratory_rate": 4,   # breaths/min
    "spo2": 3,               # %
    "temperature": 0.8,      # °C
    "news2_score": 2,        # points
}

# SpO2 and NEWS2 worsen as they go DOWN / UP respectively
LOWER_IS_WORSE = {"spo2"}
HIGHER_IS_WORSE = {
    "systolic_bp", "heart_rate", "respiratory_rate",
    "temperature", "news2_score"
}


def detect_trends(vitals_history: List[dict], n_shifts: int = 3) -> List[TrendAlert]:
    """
    vitals_history: list of vital dicts ordered oldest → newest (last n_shifts entries)
    Returns list of TrendAlert for worsening patterns
    """
    if len(vitals_history) < 2:
        return []

    recent = vitals_history[-n_shifts:]  # last N shifts
    trend_alerts = []

    for vital_key in VITAL_DISPLAY:
        values = [v.get(vital_key) for v in recent if v.get(vital_key) is not None]
        if len(values) < 2:
            continue

        # Detect monotonic worsening trend
        worsening = _is_worsening(values, vital_key)
        if not worsening:
            continue

        # Compute total change
        total_change = abs(values[-1] - values[0])
        threshold = SIGNIFICANT_CHANGE.get(vital_key, 5)

        if total_change < threshold:
            continue  # Not significant enough

        # Determine severity
        shifts_worsening = len(values)
        if shifts_worsening >= 3 or total_change >= threshold * 2:
            severity = "HIGH"
        else:
            severity = "MEDIUM"

        # Build message
        direction_word = "falling" if vital_key in LOWER_IS_WORSE else "rising"
        label = VITAL_DISPLAY[vital_key]
        message = (
            f"⚠️ TREND: {label} has been {direction_word} across {shifts_worsening} shifts "
            f"({values[0]:.1f} → {values[-1]:.1f}). "
            f"Total change: {total_change:.1f}. Patient may be deteriorating."
        )

        if vital_key == "news2_score" and values[-1] >= 7:
            severity = "CRITICAL"
            message += " NEWS2 ≥ 7 — CRITICAL RISK."

        trend_alerts.append(TrendAlert(
            vital=vital_key,
            direction="worsening",
            shifts_count=shifts_worsening,
            values=values,
            severity=severity,
            message=message,
        ))

    return trend_alerts


def _is_worsening(values: List[float], vital_key: str) -> bool:
    """Returns True if values show a consistent worsening direction"""
    if vital_key in LOWER_IS_WORSE:
        # Worsening = decreasing
        return all(values[i] >= values[i + 1] for i in range(len(values) - 1))
    elif vital_key in HIGHER_IS_WORSE:
        # Worsening = increasing
        return all(values[i] <= values[i + 1] for i in range(len(values) - 1))
    return False


def detect_persistent_abnormality(vitals_history: List[dict]) -> List[TrendAlert]:
    """
    Checks if a vital has been abnormal for ≥ 2 consecutive shifts (persistent fever, etc.)
    """
    alerts = []
    if len(vitals_history) < 2:
        return alerts

    last2 = vitals_history[-2:]

    # Persistent fever
    temps = [v.get("temperature") for v in last2 if v.get("temperature") is not None]
    if len(temps) == 2 and all(t >= 38.5 for t in temps):
        alerts.append(TrendAlert(
            vital="temperature",
            direction="persistent",
            shifts_count=2,
            values=temps,
            severity="HIGH",
            message=f"⚠️ PERSISTENT FEVER: Temperature ≥ 38.5°C for ≥ 2 shifts ({temps}). Investigate infection source."
        ))

    # Persistent low SpO2
    spo2s = [v.get("spo2") for v in last2 if v.get("spo2") is not None]
    if len(spo2s) == 2 and all(s < 94 for s in spo2s):
        alerts.append(TrendAlert(
            vital="spo2",
            direction="persistent",
            shifts_count=2,
            values=spo2s,
            severity="HIGH",
            message=f"⚠️ PERSISTENT LOW SpO2: Below 94% for ≥ 2 shifts ({spo2s}). Consider escalation."
        ))

    # Persistent high BP
    sbps = [v.get("systolic_bp") for v in last2 if v.get("systolic_bp") is not None]
    if len(sbps) == 2 and all(s > 160 for s in sbps):
        alerts.append(TrendAlert(
            vital="systolic_bp",
            direction="persistent",
            shifts_count=2,
            values=sbps,
            severity="HIGH",
            message=f"⚠️ PERSISTENT HYPERTENSION: SBP > 160 for ≥ 2 shifts ({sbps}). Review medications."
        ))

    return alerts
