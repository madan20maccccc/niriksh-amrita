# NirikshAmrita — Team Handover

Agentic Shift Safety & Early Warning System for Amrita Hospital. This doc has everything a teammate needs to pick up where we left off.

---

## 🔗 Live Links

| What | URL |
|---|---|
| **Live app (frontend)** | https://nirikshamrita-heartbeat.annamath444.workers.dev |
| **Backend API** | https://calm-motivation-production-c24c.up.railway.app |
| **API docs (Swagger)** | https://calm-motivation-production-c24c.up.railway.app/docs |
| **GitHub repo** | https://github.com/annamath444/nirikshamrita-heartbeat (branch: `master`) |

> ⚠️ Backend is on Railway free tier — it may take ~20–30 sec to "wake up" if it's been idle. Don't panic if the first load is slow.

---

## 🔑 Test Login Credentials

| Role | Email | Password |
|---|---|---|
| Admin | admin@amritahospital.org | amrita123 |
| Nurse | nurse1@amrita.org | amrita123 |

(Nurses N002–N005 also exist in the seed data — check `backend/app/seed.py` for their emails. All use the same password for now.)

---

## 🧰 Tech Stack

| Layer | Tool |
|---|---|
| Frontend | React + TanStack Router + Tailwind, built with Vite |
| Backend | Python + FastAPI |
| ORM | SQLAlchemy |
| Database | PostgreSQL (hosted on Railway) |
| Frontend hosting | Cloudflare Pages |
| Backend hosting | Railway |

---

## 🗂️ Repo Structure

```
nirikshamrita-heartbeat-main/
├── src/                ← frontend (React)
│   ├── lib/api.ts      ← all backend API calls live here
│   └── routes/         ← pages (nurse.*.tsx, admin.*.tsx)
└── backend/
    └── app/
        ├── main.py      ← FastAPI app entrypoint
        ├── models.py    ← DB tables (Patient, Vital, Alert, Nurse, Ward, AuditLog)
        ├── schemas.py   ← request/response validation
        ├── routes.py    ← all API endpoints
        ├── agents.py    ← trend detection, EWS scoring, SBAR generator, escalation logic
        ├── seed.py      ← populates DB with sample data
        ├── database.py  ← DB connection
        └── .env         ← DATABASE_URL (NOT committed to git)
```

---

## 💻 Local Setup (for teammates)

**Frontend:**
```bash
git clone https://github.com/annamath444/nirikshamrita-heartbeat.git
cd nirikshamrita-heartbeat-main
npm install
npm run dev
# runs at http://localhost:8080
```

**Backend:**
```bash
cd backend/app
python -m venv venv
venv\Scripts\activate        # Windows
pip install -r requirements.txt
```

Create a `.env` file in `backend/app/` with:
```
DATABASE_URL=<ask Acm for the Railway Postgres "Public" connection URL>
```
(Get it from Railway → Postgres service → Variables → `DATABASE_PUBLIC_URL`. The internal one only works inside Railway, not locally.)

Then run:
```bash
uvicorn main:app --reload
# runs at http://127.0.0.1:8000, docs at /docs
```

> If working locally against the **local** API instead of the live Railway one, change `BASE_URL` in `src/lib/api.ts` back to `http://127.0.0.1:8000`.

---

## ✅ What's Already Working

- Database models for patients, vitals, alerts, nurses, wards, audit logs
- API endpoints: `/patients`, `/vitals`, `/alerts`, `/wards`, `/nurses`, `/audit`, `/analyze/{id}`, `/sbar/{id}`
- AI agents (rule-based, not LLM yet):
  - Trend detection (BP/sugar/HR/SpO2 across shifts)
  - EWS (Early Warning Score) calculator
  - Absolute threshold checks
  - SBAR generator (template-based)
  - Escalation target logic
- Frontend pages live with real data: Nurse patient list, Vitals entry (saves to DB), SBAR handover view, Admin alerts (with acknowledge), Admin dashboard
- Login works for nurses (checked against real DB)
- Deployed end-to-end and database seeded with 5 sample patients

---

## 🔧 What's Left To Do

**High priority / security (do before real hospital use):**
1. Admin login is still hardcoded in frontend code — needs a real `Users`/`Admins` table + server-side check
2. Passwords are compared in plain text — need hashing (e.g. bcrypt) on the backend, not the frontend
3. `CORS` is wide open (`allow_origins=["*"]`) — restrict to the actual frontend domain
4. DB password (`amrita2024`) and other secrets are hardcoded in places — move everything to environment variables
5. No JWT/session tokens yet — login just sets local state, nothing server-verified per request

**Features:**
6. Swap the template-based SBAR for a real LLM-generated one (we paused this — Gemini API was the plan)
7. Wire up notifications for the Escalation Agent (currently just decides *who* should be notified, doesn't actually notify anyone)
8. Build a frontend page for the Audit Log (backend endpoints exist, no UI yet)
9. Check/connect remaining pages: Ward Management, Nurse Management, Reports, Settings — these may still be on old mock data
10. Add more realistic sample data (more patients/nurses/wards) for demo purposes
11. Confirm the Doctor role/portal (if planned) is connected to real data too

**Ops:**
12. Railway/Cloudflare free tiers — fine for demo, but confirm cold-start delay is acceptable for evaluation day, or consider keeping the backend "warm"

---

## 📝 Notes for Whoever Picks This Up

- Always push to GitHub after changes: `git add . && git commit -m "..." && git push`
- Pushing to `master` auto-redeploys both Cloudflare (frontend) and Railway (backend)
- If the live app shows no patient data, check that `BASE_URL` in `src/lib/api.ts` points to the Railway backend, not localhost
