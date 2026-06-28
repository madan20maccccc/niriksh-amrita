# Agent 8 — Risk Classification Agent
# GREEN / YELLOW / ORANGE / RED based on NEWS2 + clinical alerts + trends

from models import RiskLevel, EscalationTarget


def classify_risk(
    news2_score: int,
    clinical_alert_severities: list,   # ["CRITICAL", "HIGH", "MEDIUM", ...]
    trend_alert_severities: list,       # ["HIGH", "MEDIUM", ...]
    single_param_3: bool = False,       # any single NEWS2 parameter = 3
) -> tuple[RiskLevel, str, EscalationTarget]:
    """
    Returns: (risk_level, reason, escalation_target)
    """

    has_critical = "CRITICAL" in clinical_alert_severities
    has_high = "HIGH" in clinical_alert_severities or "HIGH" in trend_alert_severities
    has_medium = "MEDIUM" in clinical_alert_severities or "MEDIUM" in trend_alert_severities

    # ── RED — Critical ────────────────────────────────────────────────
    if news2_score >= 7 or has_critical:
        return (
            RiskLevel.red,
            f"NEWS2={news2_score} — Critical clinical condition. Immediate intervention required.",
            EscalationTarget.rapid_response,
        )

    # ── ORANGE — High ────────────────────────────────────────────────
    if news2_score >= 5 or (news2_score >= 3 and single_param_3) or has_high:
        return (
            RiskLevel.orange,
            f"NEWS2={news2_score} — High risk. Urgent clinical review needed within 1 hour.",
            EscalationTarget.duty_doctor,
        )

    # ── YELLOW — Moderate ────────────────────────────────────────────
    if news2_score >= 1 or has_medium or single_param_3:
        return (
            RiskLevel.yellow,
            f"NEWS2={news2_score} — Moderate risk. Increased monitoring required.",
            EscalationTarget.nurse,
        )

    # ── GREEN — Low ──────────────────────────────────────────────────
    return (
        RiskLevel.green,
        f"NEWS2={news2_score} — Low risk. Continue routine monitoring.",
        EscalationTarget.dashboard,
    )


def get_risk_color(risk_level: RiskLevel) -> str:
    return {
        RiskLevel.green: "#22c55e",
        RiskLevel.yellow: "#eab308",
        RiskLevel.orange: "#f97316",
        RiskLevel.red: "#ef4444",
    }.get(risk_level, "#6b7280")


def get_escalation_description(target: EscalationTarget) -> str:
    return {
        EscalationTarget.dashboard: "Monitor on dashboard only",
        EscalationTarget.nurse: "Notify assigned nurse immediately",
        EscalationTarget.supervisor: "Notify nursing supervisor",
        EscalationTarget.duty_doctor: "Urgent notification to duty doctor",
        EscalationTarget.rapid_response: "Activate Rapid Response Team",
        EscalationTarget.icu_team: "Transfer to ICU — notify ICU team",
    }.get(target, "Standard monitoring")
