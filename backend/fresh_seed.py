"""
Fresh Seed — NirikshAmrita
Resets the database to a blank production-ready state.
- Drops all existing data
- Creates 5 hospital wards
- Creates 1 admin account
- NO patients, NO nurses (admin adds them from the UI)

Run: python fresh_seed.py
"""
from database import SessionLocal, engine, Base
from models import Ward, User, UserRole
from auth import hash_password

# ── Nuke everything and recreate schema ────────────────────────
print("[*] Dropping and recreating all tables...")
Base.metadata.drop_all(bind=engine)
Base.metadata.create_all(bind=engine)

db = SessionLocal()

# ── 5 Hospital Wards ───────────────────────────────────────────
wards_data = [
    {"name": "General Medicine - Ward A",  "floor": 1, "capacity": 24, "ward_type": "General"},
    {"name": "Cardiology - Ward B",        "floor": 2, "capacity": 16, "ward_type": "Cardiology"},
    {"name": "ICU",                        "floor": 3, "capacity": 10, "ward_type": "ICU"},
    {"name": "Post-Surgical - Ward C",     "floor": 2, "capacity": 20, "ward_type": "Surgical"},
    {"name": "Respiratory - Ward D",       "floor": 1, "capacity": 18, "ward_type": "Respiratory"},
]
for wd in wards_data:
    db.add(Ward(**wd))
db.commit()
print(f"  [OK] {len(wards_data)} wards created")

# ── 1 Admin Account ────────────────────────────────────────────
admin = User(
    employee_id="ADM001",
    full_name="Hospital Administrator",
    email="admin@amritahospital.org",
    hashed_password=hash_password("amrita@2024"),
    role=UserRole.admin,
    department="Administration",
)
db.add(admin)
db.commit()
print("  [OK] Admin account created")

db.close()

print("\n" + "="*55)
print("  NirikshAmrita — Fresh Database Ready!")
print("="*55)
print("")
print("  Admin Login:")
print("    Email:    admin@amritahospital.org")
print("    Password: amrita@2024")
print("")
print("  Next Steps:")
print("  1. Start backend: uvicorn main:app --reload --port 8000")
print("  2. Login as admin")
print("  3. Go to Admin > Nurses > Add Nurse (create real nurse accounts)")
print("  4. Go to Admin > Patients > Admit Patient (add real patients)")
print("  5. Configure WhatsApp in Admin > Settings")
print("  6. Share nurse login with the actual nurse")
print("")
print("  API Docs: http://localhost:8000/docs")
print("="*55)
