// Realistic dummy hospital dataset for NirikshAmrita.
// Structured so a Python backend can later replace these exports.

export type Risk = "Low" | "Moderate" | "High" | "Critical";
export type AlertSeverity = "Red" | "Orange" | "Yellow";
export type AlertStatus = "Active" | "Acknowledged" | "Resolved";
export type Shift = "Morning" | "Evening" | "Night";

export interface Ward {
  id: string;
  name: string;
  beds: number;
  occupied: number;
  patients: number;
  nurses: number;
  status: "Operational" | "Strained" | "Critical";
  riskScore: number; // 0-100
}

export interface Nurse {
  id: string;
  employeeId: string;
  name: string;
  email: string;
  phone: string;
  shift: Shift;
  ward: string;
  status: "Active" | "On Leave";
}

export interface Vitals {
  bp: string;
  hr: number;
  sugar: number;
  temp: number;
  spo2: number;
  rr: number;
  pain: number;
  urine: number;
  consciousness: "Alert" | "Drowsy" | "Confused" | "Unresponsive";
}

export interface Patient {
  id: string;
  name: string;
  age: number;
  gender: "M" | "F";
  diagnosis: string;
  ward: string;
  bed: string;
  doctor: string;
  nurseId: string;
  risk: Risk;
  admitted: string;
  vitals: Vitals;
  aiSummary: string;
}

export interface AlertItem {
  id: string;
  patientId: string;
  patientName: string;
  ward: string;
  bed: string;
  reason: string;
  severity: AlertSeverity;
  time: string;
  status: AlertStatus;
}

export const wards: Ward[] = [
  { id: "W01", name: "ICU", beds: 24, occupied: 22, patients: 22, nurses: 8, status: "Critical", riskScore: 78 },
  { id: "W02", name: "Emergency", beds: 30, occupied: 19, patients: 19, nurses: 6, status: "Strained", riskScore: 64 },
  { id: "W03", name: "General Medicine", beds: 60, occupied: 47, patients: 47, nurses: 5, status: "Operational", riskScore: 28 },
  { id: "W04", name: "Cardiology", beds: 28, occupied: 24, patients: 24, nurses: 4, status: "Operational", riskScore: 41 },
  { id: "W05", name: "Neurology", beds: 22, occupied: 18, patients: 18, nurses: 3, status: "Operational", riskScore: 36 },
  { id: "W06", name: "Orthopedics", beds: 26, occupied: 21, patients: 21, nurses: 3, status: "Operational", riskScore: 22 },
  { id: "W07", name: "Pediatrics", beds: 20, occupied: 14, patients: 14, nurses: 4, status: "Operational", riskScore: 31 },
  { id: "W08", name: "Post Operative", beds: 18, occupied: 16, patients: 16, nurses: 3, status: "Strained", riskScore: 58 },
];

const firstNames = ["Aarav","Vivaan","Aditya","Vihaan","Arjun","Sai","Reyansh","Ayaan","Krishna","Ishaan","Rohan","Kabir","Anaya","Diya","Aadhya","Saanvi","Pari","Myra","Anika","Navya","Riya","Aarohi","Ira","Kiara","Meera","Rajesh","Suresh","Priya","Lakshmi","Deepa","Kavya","Nikhil","Varun","Akash","Manish","Pooja","Neha","Sneha","Kiran","Ananya"];
const lastNames = ["Sharma","Verma","Iyer","Nair","Menon","Pillai","Reddy","Rao","Patel","Gupta","Joshi","Singh","Kumar","Krishnan","Bhat","Kurup","Warrier","Pai","Hegde","Shenoy"];

const diagnoses = [
  "Acute Myocardial Infarction","Pneumonia","Sepsis","CKD Stage 4","Stroke (Ischemic)",
  "Type 2 Diabetes — Uncontrolled","Hypertensive Urgency","Asthma Exacerbation",
  "COPD Flare","Post-op Appendectomy","Post-op CABG","Fracture — Femur",
  "UTI with Pyelonephritis","Cellulitis","Dengue Fever","Hepatic Encephalopathy",
  "Acute Pancreatitis","Bronchiolitis","Meningitis (suspected)","Anemia under workup",
];
const doctors = ["Dr. Menon","Dr. Iyer","Dr. Krishnan","Dr. Nair","Dr. Reddy","Dr. Pillai","Dr. Verma","Dr. Sharma"];

function pick<T>(arr: T[], i: number): T { return arr[i % arr.length]; }
function rand(seed: number, min: number, max: number) {
  const x = Math.sin(seed) * 10000;
  const f = x - Math.floor(x);
  return Math.floor(f * (max - min + 1)) + min;
}

function makeVitals(seed: number): Vitals {
  const sys = rand(seed, 95, 175);
  const dia = rand(seed + 1, 55, 105);
  return {
    bp: `${sys}/${dia}`,
    hr: rand(seed + 2, 58, 128),
    sugar: rand(seed + 3, 80, 260),
    temp: Number((97 + (rand(seed + 4, 0, 50) / 10)).toFixed(1)),
    spo2: rand(seed + 5, 86, 99),
    rr: rand(seed + 6, 12, 28),
    pain: rand(seed + 7, 0, 9),
    urine: rand(seed + 8, 200, 1800),
    consciousness: (["Alert","Alert","Alert","Drowsy","Confused"] as const)[rand(seed + 9, 0, 4)],
  };
}

function riskFor(v: Vitals): Risk {
  let s = 0;
  if (v.spo2 < 92) s += 3; else if (v.spo2 < 95) s += 1;
  if (v.hr > 110 || v.hr < 60) s += 2;
  if (v.rr > 22) s += 2;
  if (v.temp > 100.5) s += 1;
  if (v.consciousness !== "Alert") s += 2;
  if (v.sugar > 200 || v.sugar < 70) s += 1;
  if (s >= 6) return "Critical";
  if (s >= 4) return "High";
  if (s >= 2) return "Moderate";
  return "Low";
}

export const nurses: Nurse[] = Array.from({ length: 30 }, (_, i) => {
  const ward = wards[i % wards.length];
  return {
    id: `N${String(i + 1).padStart(3, "0")}`,
    employeeId: `AMR-N-${1000 + i}`,
    name: `${pick(firstNames, i + 7)} ${pick(lastNames, i + 3)}`,
    email: `nurse${i + 1}@amritahospital.org`,
    phone: `+91 9${rand(i + 100, 100000000, 899999999)}`,
    shift: (["Morning","Evening","Night"] as const)[i % 3],
    ward: ward.name,
    status: i % 11 === 0 ? "On Leave" : "Active",
  };
});

export const patients: Patient[] = Array.from({ length: 200 }, (_, i) => {
  const ward = wards[i % wards.length];
  const wardNurses = nurses.filter(n => n.ward === ward.name);
  const nurse = wardNurses[i % wardNurses.length] ?? nurses[0];
  const v = makeVitals(i + 17);
  const r = riskFor(v);
  return {
    id: `P${String(i + 1).padStart(4, "0")}`,
    name: `${pick(firstNames, i)} ${pick(lastNames, i + 5)}`,
    age: rand(i + 31, 4, 88),
    gender: i % 2 === 0 ? "M" : "F",
    diagnosis: pick(diagnoses, i + 2),
    ward: ward.name,
    bed: `${ward.id}-${String((i % ward.beds) + 1).padStart(2, "0")}`,
    doctor: pick(doctors, i),
    nurseId: nurse.id,
    risk: r,
    admitted: new Date(Date.now() - rand(i + 51, 0, 18) * 86400000).toISOString().slice(0, 10),
    vitals: v,
    aiSummary: r === "Critical"
      ? "Patient shows progressive desaturation with rising respiratory rate over the last 6 hours. Suggest immediate clinical review and consider oxygen titration."
      : r === "High"
      ? "Trending vitals indicate borderline instability. Recommend re-assessment within 2 hours and confirm fluid balance."
      : r === "Moderate"
      ? "Vitals within expected range for diagnosis. Continue current monitoring cadence."
      : "Stable. Routine monitoring sufficient. No escalation indicated.",
  };
});

export const alerts: AlertItem[] = patients
  .filter(p => p.risk === "Critical" || p.risk === "High")
  .slice(0, 22)
  .map((p, i) => ({
    id: `A${String(i + 1).padStart(3, "0")}`,
    patientId: p.id,
    patientName: p.name,
    ward: p.ward,
    bed: p.bed,
    reason: p.risk === "Critical"
      ? ["SpO₂ < 90%","HR > 120 sustained","Altered consciousness","BP > 170 systolic"][i % 4]
      : ["Respiratory rate elevated","Sugar > 220 mg/dL","Pain score escalating","Urine output low"][i % 4],
    severity: p.risk === "Critical" ? "Red" : i % 2 === 0 ? "Orange" : "Yellow",
    time: new Date(Date.now() - i * 11 * 60000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    status: (["Active","Active","Acknowledged","Resolved"] as const)[i % 4],
  }));

// 14-day trend per vital (Morning / Evening / Night points).
export function buildTrend(seed: number, base: number, jitter: number) {
  return Array.from({ length: 14 }, (_, d) => ({
    day: `D${d + 1}`,
    morning: base + rand(seed + d, -jitter, jitter),
    evening: base + rand(seed + d + 100, -jitter, jitter),
    night: base + rand(seed + d + 200, -jitter, jitter),
  }));
}

export const hospitalSummary = {
  admissions: 38,
  discharges: 29,
  transfers: 11,
  pendingAssessments: 17,
  vitalsCompleted: 412,
};

export const aiInsight =
  "ICU has experienced a 20% increase in high-risk alerts over the past 24 hours. Oxygen saturation alerts are trending upward, particularly during night shift handovers. Consider reviewing nurse-to-bed ratio and oxygen support availability in Bay 3 and Bay 5.";

export const admissionsTrend = Array.from({ length: 14 }, (_, d) => ({
  day: `D${d + 1}`,
  admissions: 20 + rand(d + 5, -6, 14),
  discharges: 18 + rand(d + 20, -5, 12),
}));

export const alertTrend = Array.from({ length: 14 }, (_, d) => ({
  day: `D${d + 1}`,
  red: rand(d + 1, 1, 8),
  orange: rand(d + 50, 3, 12),
  yellow: rand(d + 100, 5, 18),
}));

export function patientsForNurse(nurseId: string) {
  return patients.filter(p => p.nurseId === nurseId);
}

export function patientById(id: string) {
  return patients.find(p => p.id === id);
}