"""
Seed file — populates NurseWatch AI with realistic Amrita Hospital demo data
Run: python seed.py
"""
from database import SessionLocal, engine, Base
from models import *
from auth import hash_password
import json

Base.metadata.drop_all(bind=engine)
Base.metadata.create_all(bind=engine)
db = SessionLocal()

def seed():
    print("[*] Seeding NurseWatch AI database...")

    # ── WARDS ──────────────────────────────────────────────────────────
    wards_data = [
        {"name": "General Medicine - Ward A",  "floor": 1, "capacity": 24, "ward_type": "General"},
        {"name": "Cardiology - Ward B",        "floor": 2, "capacity": 16, "ward_type": "Cardiology"},
        {"name": "ICU",                         "floor": 3, "capacity": 10, "ward_type": "ICU"},
        {"name": "Post-Surgical - Ward C",     "floor": 2, "capacity": 20, "ward_type": "Surgical"},
        {"name": "Respiratory - Ward D",       "floor": 1, "capacity": 18, "ward_type": "Respiratory"},
    ]
    wards = []
    for wd in wards_data:
        w = Ward(**wd)
        db.add(w)
        wards.append(w)
    db.commit()
    for w in wards: db.refresh(w)
    print(f"  [OK] {len(wards)} wards created")

    # ── USERS ──────────────────────────────────────────────────────────
    users_data = [
        {"employee_id": "ADM001", "full_name": "Dr. Admin Sharma",     "email": "admin@amritahospital.org",  "password": "amrita123", "role": UserRole.admin,      "department": "Administration"},
        {"employee_id": "NRS001", "full_name": "Nurse Priya Nair",     "email": "nurse1@amrita.org",         "password": "amrita123", "role": UserRole.nurse,      "department": "General Medicine"},
        {"employee_id": "NRS002", "full_name": "Nurse Kavitha Pillai", "email": "nurse2@amrita.org",         "password": "amrita123", "role": UserRole.nurse,      "department": "Cardiology"},
        {"employee_id": "NRS003", "full_name": "Nurse Deepa Menon",    "email": "nurse3@amrita.org",         "password": "amrita123", "role": UserRole.nurse,      "department": "ICU"},
        {"employee_id": "NRS004", "full_name": "Nurse Anitha Kumar",   "email": "nurse4@amrita.org",         "password": "amrita123", "role": UserRole.nurse,      "department": "Post-Surgical"},
        {"employee_id": "SUP001", "full_name": "Sr. Nurse Lalitha",    "email": "supervisor@amrita.org",    "password": "amrita123", "role": UserRole.supervisor, "department": "All Wards"},
        {"employee_id": "DOC001", "full_name": "Dr. Ramesh Iyer",      "email": "doctor@amrita.org",         "password": "amrita123", "role": UserRole.doctor,     "department": "General Medicine"},
    ]
    users = []
    for ud in users_data:
        u = User(
            employee_id=ud["employee_id"],
            full_name=ud["full_name"],
            email=ud["email"],
            hashed_password=hash_password(ud["password"]),
            role=ud["role"],
            department=ud["department"],
        )
        db.add(u)
        users.append(u)
    db.commit()
    for u in users: db.refresh(u)
    print(f"  [OK] {len(users)} users created")

    nurses = [u for u in users if u.role == UserRole.nurse]

    # ── PATIENTS ───────────────────────────────────────────────────────
    patients_data = [
        {
            "patient_id": "AMR-2024-001", "full_name": "Rajan Krishnamurthy", "age": 68, "gender": "Male",
            "bed_number": "A-01", "ward_id": wards[0].id, "assigned_nurse_id": nurses[0].id,
            "primary_diagnosis": "Type 2 Diabetes Mellitus with Hypertension",
            "comorbidities": json.dumps(["Chronic Kidney Disease Stage 2", "Obesity"]),
            "current_medications": json.dumps(["Metformin 500mg", "Amlodipine 5mg", "Losartan 50mg"]),
            "diabetes": True, "hypertension": True, "copd": False, "post_surgery": False, "cardiac_history": False,
        },
        {
            "patient_id": "AMR-2024-002", "full_name": "Meenakshi Sundaram", "age": 55, "gender": "Female",
            "bed_number": "B-03", "ward_id": wards[1].id, "assigned_nurse_id": nurses[1].id,
            "primary_diagnosis": "Acute Coronary Syndrome",
            "comorbidities": json.dumps(["Hypertension", "Dyslipidemia"]),
            "current_medications": json.dumps(["Aspirin 75mg", "Atorvastatin 40mg", "Bisoprolol 5mg", "Nitroglycerine PRN"]),
            "diabetes": False, "hypertension": True, "copd": False, "post_surgery": False, "cardiac_history": True,
        },
        {
            "patient_id": "AMR-2024-003", "full_name": "Suresh Babu", "age": 45, "gender": "Male",
            "bed_number": "ICU-02", "ward_id": wards[2].id, "assigned_nurse_id": nurses[2].id,
            "primary_diagnosis": "Severe Community-Acquired Pneumonia",
            "comorbidities": json.dumps(["COPD", "Smoking History"]),
            "current_medications": json.dumps(["Meropenem 1g IV", "Azithromycin 500mg", "Salbutamol inhaler"]),
            "diabetes": False, "hypertension": False, "copd": True, "post_surgery": False, "cardiac_history": False,
        },
        {
            "patient_id": "AMR-2024-004", "full_name": "Anjali Devi", "age": 38, "gender": "Female",
            "bed_number": "C-07", "ward_id": wards[3].id, "assigned_nurse_id": nurses[3].id,
            "primary_diagnosis": "Post Appendectomy",
            "comorbidities": json.dumps(["Nil significant"]),
            "current_medications": json.dumps(["Paracetamol 650mg", "Ondansetron 4mg", "Amoxicillin-Clavulanate"]),
            "diabetes": False, "hypertension": False, "copd": False, "post_surgery": True, "cardiac_history": False,
        },
        {
            "patient_id": "AMR-2024-005", "full_name": "Govind Patel", "age": 72, "gender": "Male",
            "bed_number": "D-04", "ward_id": wards[4].id, "assigned_nurse_id": nurses[0].id,
            "primary_diagnosis": "COPD Exacerbation",
            "comorbidities": json.dumps(["COPD Grade 3", "Cor Pulmonale"]),
            "current_medications": json.dumps(["Ipratropium inhaler", "Prednisolone 40mg", "Doxycycline 100mg"]),
            "diabetes": False, "hypertension": False, "copd": True, "post_surgery": False, "cardiac_history": True,
        },
        {
            "patient_id": "AMR-2024-006", "full_name": "Lakshmi Prabha", "age": 60, "gender": "Female",
            "bed_number": "A-05", "ward_id": wards[0].id, "assigned_nurse_id": nurses[0].id,
            "primary_diagnosis": "Hypertensive Emergency",
            "comorbidities": json.dumps(["Diabetes Type 2", "Retinopathy"]),
            "current_medications": json.dumps(["Labetalol IV", "Amlodipine 10mg", "Insulin Glargine"]),
            "diabetes": True, "hypertension": True, "copd": False, "post_surgery": False, "cardiac_history": False,
        },
    ]
    patients = []
    for pd_data in patients_data:
        p = Patient(**pd_data)
        db.add(p)
        patients.append(p)
    db.commit()
    for p in patients: db.refresh(p)
    print(f"  [OK] {len(patients)} patients created")

    # ── SAMPLE VITALS (with multi-shift history to populate charts and trigger linear regression predictions) ──
    import datetime
    vitals_samples = []

    # Patient 1 (Rajan Krishnamurthy) - Diabetic, Hypertensive - Worsening over 4 shifts
    p1_vitals = [
        {"systolic_bp": 130, "diastolic_bp": 80, "heart_rate": 80, "respiratory_rate": 16, "spo2": 98, "temperature": 36.8, "consciousness": "Alert", "blood_glucose": 120, "news2_score": 0, "risk_level": RiskLevel.green},
        {"systolic_bp": 140, "diastolic_bp": 85, "heart_rate": 82, "respiratory_rate": 18, "spo2": 97, "temperature": 37.0, "consciousness": "Alert", "blood_glucose": 160, "news2_score": 0, "risk_level": RiskLevel.green},
        {"systolic_bp": 150, "diastolic_bp": 90, "heart_rate": 85, "respiratory_rate": 18, "spo2": 96, "temperature": 37.1, "consciousness": "Alert", "blood_glucose": 220, "news2_score": 1, "risk_level": RiskLevel.yellow},
        {"systolic_bp": 158, "diastolic_bp": 95, "heart_rate": 88, "respiratory_rate": 18, "spo2": 96, "temperature": 37.2, "consciousness": "Alert", "blood_glucose": 280, "news2_score": 2, "risk_level": RiskLevel.yellow}
    ]
    
    # Patient 2 (Meenakshi Sundaram) - Cardiac - Hemodynamics deteriorating
    p2_vitals = [
        {"systolic_bp": 120, "diastolic_bp": 80, "heart_rate": 75, "respiratory_rate": 15, "spo2": 98, "temperature": 36.5, "consciousness": "Alert", "blood_glucose": None, "news2_score": 0, "risk_level": RiskLevel.green},
        {"systolic_bp": 110, "diastolic_bp": 70, "heart_rate": 85, "respiratory_rate": 18, "spo2": 97, "temperature": 36.8, "consciousness": "Alert", "blood_glucose": None, "news2_score": 0, "risk_level": RiskLevel.green},
        {"systolic_bp": 102, "diastolic_bp": 65, "heart_rate": 98, "respiratory_rate": 20, "spo2": 95, "temperature": 37.2, "consciousness": "Alert", "blood_glucose": None, "news2_score": 2, "risk_level": RiskLevel.yellow},
        {"systolic_bp": 95,  "diastolic_bp": 65, "heart_rate": 115, "respiratory_rate": 22, "spo2": 94, "temperature": 37.8, "consciousness": "Alert", "blood_glucose": None, "news2_score": 6, "risk_level": RiskLevel.orange}
    ]

    # Patient 3 (Suresh Babu) - Pneumonia in ICU - Severe deterioration
    p3_vitals = [
        {"systolic_bp": 115, "diastolic_bp": 75, "heart_rate": 80, "respiratory_rate": 18, "spo2": 96, "temperature": 37.0, "consciousness": "Alert", "blood_glucose": None, "news2_score": 0, "risk_level": RiskLevel.green},
        {"systolic_bp": 105, "diastolic_bp": 70, "heart_rate": 95, "respiratory_rate": 20, "spo2": 94, "temperature": 38.2, "consciousness": "Alert", "blood_glucose": None, "news2_score": 2, "risk_level": RiskLevel.yellow},
        {"systolic_bp": 95,  "diastolic_bp": 62, "heart_rate": 110, "respiratory_rate": 24, "spo2": 91, "temperature": 38.9, "consciousness": "Alert", "blood_glucose": None, "news2_score": 6, "risk_level": RiskLevel.orange},
        {"systolic_bp": 88,  "diastolic_bp": 58, "heart_rate": 128, "respiratory_rate": 28, "spo2": 89, "temperature": 39.5, "consciousness": "Voice", "blood_glucose": None, "news2_score": 9, "risk_level": RiskLevel.red}
    ]

    # Patient 4 (Anjali Devi) - Post Appendectomy - Recovering well (Green)
    p4_vitals = [
        {"systolic_bp": 100, "diastolic_bp": 60, "heart_rate": 90, "respiratory_rate": 20, "spo2": 96, "temperature": 38.0, "consciousness": "Alert", "blood_glucose": None, "news2_score": 2, "risk_level": RiskLevel.yellow},
        {"systolic_bp": 110, "diastolic_bp": 68, "heart_rate": 86, "respiratory_rate": 18, "spo2": 97, "temperature": 37.8, "consciousness": "Alert", "blood_glucose": None, "news2_score": 0, "risk_level": RiskLevel.green},
        {"systolic_bp": 115, "diastolic_bp": 72, "heart_rate": 84, "respiratory_rate": 16, "spo2": 98, "temperature": 37.5, "consciousness": "Alert", "blood_glucose": None, "news2_score": 0, "risk_level": RiskLevel.green},
        {"systolic_bp": 118, "diastolic_bp": 75, "heart_rate": 82, "respiratory_rate": 16, "spo2": 98, "temperature": 37.4, "consciousness": "Alert", "blood_glucose": None, "news2_score": 0, "risk_level": RiskLevel.green}
    ]

    # Patient 5 (Govind Patel) - COPD - Respiratory deteriorating
    p5_vitals = [
        {"systolic_bp": 120, "diastolic_bp": 80, "heart_rate": 80, "respiratory_rate": 18, "spo2": 94, "temperature": 37.0, "consciousness": "Alert", "blood_glucose": None, "news2_score": 0, "risk_level": RiskLevel.green},
        {"systolic_bp": 124, "diastolic_bp": 82, "heart_rate": 85, "respiratory_rate": 20, "spo2": 93, "temperature": 37.4, "consciousness": "Alert", "blood_glucose": None, "news2_score": 0, "risk_level": RiskLevel.green},
        {"systolic_bp": 128, "diastolic_bp": 80, "heart_rate": 90, "respiratory_rate": 22, "spo2": 91, "temperature": 37.8, "consciousness": "Alert", "blood_glucose": None, "news2_score": 4, "risk_level": RiskLevel.yellow},
        {"systolic_bp": 132, "diastolic_bp": 82, "heart_rate": 95, "respiratory_rate": 24, "spo2": 90, "temperature": 38.2, "consciousness": "Alert", "blood_glucose": None, "news2_score": 5, "risk_level": RiskLevel.orange}
    ]

    # Patient 6 (Lakshmi Prabha) - Hypertensive Emergency
    p6_vitals = [
        {"systolic_bp": 140, "diastolic_bp": 90,  "heart_rate": 80,  "respiratory_rate": 16, "spo2": 97, "temperature": 36.8, "consciousness": "Alert", "blood_glucose": 180, "news2_score": 1, "risk_level": RiskLevel.yellow},
        {"systolic_bp": 160, "diastolic_bp": 100, "heart_rate": 88,  "respiratory_rate": 18, "spo2": 96, "temperature": 37.0, "consciousness": "Alert", "blood_glucose": 220, "news2_score": 2, "risk_level": RiskLevel.yellow},
        {"systolic_bp": 180, "diastolic_bp": 110, "heart_rate": 95,  "respiratory_rate": 20, "spo2": 95, "temperature": 37.2, "consciousness": "Alert", "blood_glucose": 260, "news2_score": 4, "risk_level": RiskLevel.yellow},
        {"systolic_bp": 195, "diastolic_bp": 118, "heart_rate": 102, "respiratory_rate": 20, "spo2": 95, "temperature": 37.6, "consciousness": "Alert", "blood_glucose": 320, "news2_score": 5, "risk_level": RiskLevel.orange}
    ]

    all_vitals_configs = [p1_vitals, p2_vitals, p3_vitals, p4_vitals, p5_vitals, p6_vitals]
    
    # Helper to generate timestamps going backwards (Morning/Evening/Night)
    now = datetime.datetime.now()
    shifts_seq = [ShiftType.morning, ShiftType.evening, ShiftType.night, ShiftType.morning]
    
    for pat_idx, pat in enumerate(patients):
        configs = all_vitals_configs[pat_idx]
        nurse_id = pat.assigned_nurse_id or nurses[0].id
        for i, config in enumerate(configs):
            # Space the recorded times by 8 hours
            time_delta = datetime.timedelta(hours=8 * (3 - i))
            recorded_time = now - time_delta
            
            v = Vital(
                patient_id=pat.id,
                entered_by=nurse_id,
                shift=shifts_seq[i],
                recorded_at=recorded_time,
                systolic_bp=config["systolic_bp"],
                diastolic_bp=config["diastolic_bp"],
                heart_rate=config["heart_rate"],
                respiratory_rate=config["respiratory_rate"],
                spo2=config["spo2"],
                temperature=config["temperature"],
                consciousness=config["consciousness"],
                blood_glucose=config["blood_glucose"],
                news2_score=config["news2_score"],
                risk_level=config["risk_level"],
                is_validated=True,
                validation_notes="Seeded historical record"
            )
            db.add(v)
            db.commit()
            db.refresh(v)
            
            # Seed corresponding EWS Score details
            from agents.ews_calculator import calculate_news2
            vitals_dict = {
                "systolic_bp": v.systolic_bp,
                "diastolic_bp": v.diastolic_bp,
                "heart_rate": v.heart_rate,
                "respiratory_rate": v.respiratory_rate,
                "spo2": v.spo2,
                "temperature": v.temperature,
                "consciousness": v.consciousness
            }
            ews_data = calculate_news2(vitals_dict, copd=pat.copd)
            ews_record = EWSScore(
                vital_id=v.id,
                patient_id=pat.id,
                **ews_data,
                calculated_at=recorded_time
            )
            db.add(ews_record)
            db.commit()

    print(f"  [OK] Successfully seeded multi-shift vitals for {len(patients)} patients.")

    print("\nNurseWatch AI seeded successfully!")
    print("\nLogin Credentials:")
    print("  Admin:      admin@amritahospital.org   / amrita123")
    print("  Nurse 1:    nurse1@amrita.org          / amrita123")
    print("  Nurse 2:    nurse2@amrita.org          / amrita123")
    print("  Supervisor: supervisor@amrita.org      / amrita123")
    print("  Doctor:     doctor@amrita.org          / amrita123")
    print("\nStart backend: uvicorn main:app --reload --host 0.0.0.0 --port 8000")
    print("API Docs:      http://localhost:8000/docs")

if __name__ == "__main__":
    seed()
    db.close()
