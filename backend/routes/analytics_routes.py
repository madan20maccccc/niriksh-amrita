from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta
from database import get_db
import models, schemas
from auth import get_current_user

router = APIRouter()

@router.get("/summary", response_model=schemas.AnalyticsSummary)
def get_analytics_summary(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    # Total active patients
    total_patients = db.query(func.count(models.Patient.id)).filter(models.Patient.is_active == True).scalar()

    # Active alerts count
    total_active_alerts = db.query(func.count(models.Alert.id)).filter(
        models.Alert.status == models.AlertStatus.active
    ).scalar()

    # Average response time (alert created → acknowledged)
    acked = db.query(models.Alert).filter(
        models.Alert.status == models.AlertStatus.acknowledged,
        models.Alert.acknowledged_at != None,
    ).all()
    if acked:
        total_minutes = sum(
            (a.acknowledged_at - a.created_at).total_seconds() / 60
            for a in acked
            if a.acknowledged_at and a.created_at
        )
        avg_response = round(total_minutes / len(acked), 1) if acked else None
    else:
        avg_response = None

    # Alert volume last 7 days
    days = []
    for i in range(6, -1, -1):
        day = datetime.utcnow() - timedelta(days=i)
        count = db.query(func.count(models.Alert.id)).filter(
            func.date(models.Alert.created_at) == day.date()
        ).scalar()
        days.append({"date": day.strftime("%Y-%m-%d"), "count": count or 0})

    # Get only the latest vital ID for each patient to avoid duplicate patients in top-risk
    latest_vital_sub = (
        db.query(
            models.Vital.patient_id,
            func.max(models.Vital.recorded_at).label("max_recorded_at")
        )
        .group_by(models.Vital.patient_id)
        .subquery()
    )

    top_risk = (
        db.query(models.Patient, models.Vital)
        .join(models.Vital, models.Vital.patient_id == models.Patient.id)
        .join(
            latest_vital_sub,
            (models.Vital.patient_id == latest_vital_sub.c.patient_id) &
            (models.Vital.recorded_at == latest_vital_sub.c.max_recorded_at)
        )
        .filter(models.Patient.is_active == True, models.Vital.news2_score != None)
        .order_by(models.Vital.news2_score.desc())
        .limit(5)
        .all()
    )
    top_risk_patients = [
        {
            "patient_id": p.id,
            "name": p.full_name,
            "news2": v.news2_score,
            "risk_level": v.risk_level.value if v.risk_level else "GREEN",
        }
        for p, v in top_risk
    ]

    # Ward stats
    wards = db.query(models.Ward).all()
    ward_stats = []
    for ward in wards:
        patients = db.query(models.Patient).filter(
            models.Patient.ward_id == ward.id, models.Patient.is_active == True
        ).all()
        patient_ids = [p.id for p in patients]

        risk_counts = {"GREEN": 0, "YELLOW": 0, "ORANGE": 0, "RED": 0}
        news2_scores = []
        for p in patients:
            v = db.query(models.Vital).filter(
                models.Vital.patient_id == p.id
            ).order_by(models.Vital.recorded_at.desc()).first()
            if v and v.risk_level:
                risk_counts[v.risk_level.value] += 1
            if v and v.news2_score is not None:
                news2_scores.append(v.news2_score)

        active_alerts = db.query(func.count(models.Alert.id)).filter(
            models.Alert.patient_id.in_(patient_ids),
            models.Alert.status == models.AlertStatus.active,
        ).scalar()

        ward_stats.append(schemas.WardStats(
            ward_id=ward.id,
            ward_name=ward.name,
            total_patients=len(patients),
            green_count=risk_counts["GREEN"],
            yellow_count=risk_counts["YELLOW"],
            orange_count=risk_counts["ORANGE"],
            red_count=risk_counts["RED"],
            active_alerts=active_alerts or 0,
            avg_news2=round(sum(news2_scores) / len(news2_scores), 1) if news2_scores else None,
        ))

    return schemas.AnalyticsSummary(
        total_patients=total_patients or 0,
        total_active_alerts=total_active_alerts or 0,
        avg_response_time_minutes=avg_response,
        alert_volume_by_day=days,
        top_risk_patients=top_risk_patients,
        ward_stats=ward_stats,
    )
