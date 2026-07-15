import { getSession } from "./auth";

export function getBaseUrl() {
  if (typeof window === "undefined") return "http://localhost:8000";
  // Remove trailing slash if present to avoid double slashes in paths
  const stored = localStorage.getItem("nirikshamrita.backend_url");
  if (stored) return stored.replace(/\/+$/, "");
  return ""; // Relative path to proxy backend API calls through frontend server
}

export function getWsUrl(path: string) {
  const base = getBaseUrl();
  if (base === "") {
    if (typeof window === "undefined") return `ws://localhost:8000${path}`;
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${window.location.host}${path}`;
  }
  const protocol = base.startsWith("https:") ? "wss:" : "ws:";
  const host = base.replace(/^https?:\/\//, "");
  return `${protocol}//${host}${path}`;
}

function getHeaders() {
  const session = getSession();
  const token = localStorage.getItem("nirikshamrita.token") || "";
  return {
    "Content-Type": "application/json",
    "Cache-Control": "no-cache",
    "Pragma": "no-cache",
    "Expires": "0",
    "Bypass-Tunnel-Reminder": "true",  // ← Auto-bypass localtunnel security landing screens
    Authorization: token ? `Bearer ${token}` : "",
  };
}

export async function request(path: string, options: RequestInit = {}) {
  const url = `${getBaseUrl()}${path}`;
  const headers = { ...getHeaders(), ...options.headers };
  const response = await fetch(url, { credentials: "include", ...options, headers });
  
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: "Request failed" }));
    if (Array.isArray(err.detail)) {
      throw new Error(err.detail.map((e: any) => `${e.loc?.join('.')} ${e.msg}`).join(", "));
    }
    throw new Error(typeof err.detail === 'string' ? err.detail : JSON.stringify(err.detail) || "Request failed");
  }
  
  return response.json();
}

// ─────────────────────────────────────────────
// AUTH
// ─────────────────────────────────────────────
export async function loginUser(email: string, password: string) {
  const res = await request("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  
  if (res.access_token) {
    localStorage.setItem("nirikshamrita.token", res.access_token);
  }
  return res;
}

// ─────────────────────────────────────────────
// PATIENTS
// ─────────────────────────────────────────────
export async function getPatients(wardId?: number) {
  const path = wardId ? `/patients/?ward_id=${wardId}` : "/patients/";
  return request(path);
}

export async function getPatient(id: number) {
  return request(`/patients/${id}`);
}

export async function getPatientSummary(id: number) {
  return request(`/patients/${id}/summary`);
}

// ─────────────────────────────────────────────
// VITALS
// ─────────────────────────────────────────────
export interface VitalsInput {
  patient_id: number;
  shift: "Morning" | "Evening" | "Night";
  systolic_bp?: number;
  diastolic_bp?: number;
  heart_rate?: number;
  respiratory_rate?: number;
  spo2?: number;
  temperature?: number;
  consciousness?: "Alert" | "Voice" | "Pain" | "Unresponsive" | string;
  blood_glucose?: number;
  urine_output?: number;
  source?: string;
}

export async function enterVitals(vitals: VitalsInput) {
  return request("/vitals/", {
    method: "POST",
    body: JSON.stringify(vitals),
  });
}

export async function getVitalsHistory(patientId: number, limit = 15) {
  return request(`/vitals/patient/${patientId}?limit=${limit}`);
}

// Real-Time Gemini Vision OCR Vital Uploader
export async function uploadVitalsOcr(file: File) {
  const url = `${getBaseUrl()}/vitals/ocr`;
  const token = localStorage.getItem("nirikshamrita.token") || "";
  
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": token ? `Bearer ${token}` : "",
      "Bypass-Tunnel-Reminder": "true",
    },
    credentials: "include",
    body: formData,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: "OCR parsing failed" }));
    throw new Error(err.detail || "OCR parsing failed");
  }

  return response.json();
}

// ─────────────────────────────────────────────
// ALERTS
// ─────────────────────────────────────────────
export async function getAlerts(wardId?: number, patientId?: number, status?: string) {
  let params = new URLSearchParams();
  if (wardId) params.append("ward_id", String(wardId));
  if (patientId) params.append("patient_id", String(patientId));
  if (status) params.append("status", status);
  
  const query = params.toString() ? `?${params.toString()}` : "";
  return request(`/alerts/${query}`);
}

export async function acknowledgeAlert(alertId: number, actionTaken?: string) {
  return request(`/alerts/${alertId}/acknowledge`, {
    method: "POST",
    body: JSON.stringify({ alert_id: alertId, action_taken: actionTaken }),
  });
}

// ─────────────────────────────────────────────
// WARDS
// ─────────────────────────────────────────────
export async function getWards() {
  return request("/wards/");
}

// ─────────────────────────────────────────────
// NURSES
// ─────────────────────────────────────────────
export async function getNurses() {
  return request("/nurses/");
}

// ─────────────────────────────────────────────
// SBAR
// ─────────────────────────────────────────────
export async function getPatientSbars(patientId: number, limit = 10) {
  return request(`/sbar/patient/${patientId}?limit=${limit}`);
}

export async function generateSbarNow(patientId: number, lang?: string) {
  const query = lang ? `?lang=${lang}` : "";
  return request(`/sbar/generate/${patientId}${query}`, {
    method: "POST",
  });
}

export async function getSbar(sbarId: number, lang?: string) {
  const query = lang ? `?lang=${lang}` : "";
  return request(`/sbar/${sbarId}${query}`);
}

// ─────────────────────────────────────────────
// AUDIT
// ─────────────────────────────────────────────
export async function getAuditLogs(limit = 100) {
  return request(`/audit/?limit=${limit}`);
}

// ─────────────────────────────────────────────
// ANALYTICS
// ─────────────────────────────────────────────
export async function getAnalyticsSummary() {
  return request("/analytics/summary");
}

// ─────────────────────────────────────────────
// INNOVATIONS
// ─────────────────────────────────────────────
export async function askPatientRag(patientId: number, question: string) {
  return request(`/innovations/patients/${patientId}/ask`, {
    method: "POST",
    body: JSON.stringify({ question }),
  });
}

export async function getPatientPredictions(patientId: number) {
  return request(`/innovations/patients/${patientId}/predict`);
}

export async function explainAlert(alertId: number) {
  return request(`/innovations/alerts/${alertId}/explain`);
}

// ─────────────────────────────────────────────
// ADMIN OPERATIONS (CRUD)
// ─────────────────────────────────────────────
export async function createPatient(patientData: any) {
  return request("/patients/", {
    method: "POST",
    body: JSON.stringify(patientData),
  });
}

export async function updatePatient(patientId: number, patientData: any) {
  return request(`/patients/${patientId}`, {
    method: "PUT",
    body: JSON.stringify(patientData),
  });
}

export async function deletePatient(patientId: number) {
  return request(`/patients/${patientId}`, {
    method: "DELETE",
  });
}

export async function updateUser(userId: number, userData: any) {
  return request(`/auth/users/${userId}`, {
    method: "PUT",
    body: JSON.stringify(userData),
  });
}

export async function deactivateUser(userId: number) {
  return request(`/auth/users/${userId}`, {
    method: "DELETE",
  });
}

export async function registerUser(userData: any) {
  return request("/auth/register", {
    method: "POST",
    body: JSON.stringify(userData),
  });
}

export async function resetUserPassword(userId: number, passwordData: any) {
  return request(`/auth/users/${userId}/reset-password`, {
    method: "POST",
    body: JSON.stringify(passwordData),
  });
}

export async function createWard(wardData: any) {
  return request("/wards/", {
    method: "POST",
    body: JSON.stringify(wardData),
  });
}

export async function updateWard(wardId: number, wardData: any) {
  return request(`/wards/${wardId}`, {
    method: "PUT",
    body: JSON.stringify(wardData),
  });
}

export async function deleteWard(wardId: number) {
  return request(`/wards/${wardId}`, {
    method: "DELETE",
  });
}


// ─────────────────────────────────────────────
// WHATSAPP CONFIG (Admin)
// ─────────────────────────────────────────────
export async function testWhatsApp(phone: string, apikey: string) {
  return request("/alerts/whatsapp/test", {
    method: "POST",
    body: JSON.stringify({ phone, apikey }),
  });
}

export async function saveWhatsAppConfig(phone: string, apikey: string) {
  return request("/alerts/whatsapp/save-config", {
    method: "POST",
    body: JSON.stringify({ phone, apikey }),
  });
}

export async function getWhatsAppConfig() {
  return request("/alerts/whatsapp/config");
}

// ─────────────────────────────────────────────
// SMS CONFIG (Admin)
// ─────────────────────────────────────────────
export async function testSMS(toPhone: string, twilioSid?: string, twilioToken?: string, twilioFrom?: string) {
  return request("/alerts/sms/test", {
    method: "POST",
    body: JSON.stringify({
      to_phone: toPhone,
      twilio_sid: twilioSid,
      twilio_token: twilioToken,
      twilio_from: twilioFrom
    }),
  });
}

export async function saveSMSConfig(twilioSid: string, twilioToken: string, twilioFrom: string) {
  return request("/alerts/sms/save-config", {
    method: "POST",
    body: JSON.stringify({
      twilio_sid: twilioSid,
      twilio_token: twilioToken,
      twilio_from: twilioFrom
    }),
  });
}

export async function getSMSConfig() {
  return request("/alerts/sms/config");
}

// ─────────────────────────────────────────────
// FAST2SMS (FREE INDIA) CONFIG
// ─────────────────────────────────────────────
export async function testFast2SMS(toPhone: string, apiKey?: string) {
  return request("/alerts/sms/fast2sms/test", {
    method: "POST",
    body: JSON.stringify({ to_phone: toPhone, api_key: apiKey }),
  });
}

export async function saveFast2SMSConfig(apiKey: string) {
  return request("/alerts/sms/fast2sms/save-config", {
    method: "POST",
    body: JSON.stringify({ api_key: apiKey }),
  });
}

export async function getFast2SMSConfig() {
  return request("/alerts/sms/fast2sms/config");
}

// ─────────────────────────────────────────────
// TELEGRAM CONFIG (Admin)
// ─────────────────────────────────────────────
export async function testTelegram(chatId: string, botToken?: string) {
  return request("/alerts/telegram/test", {
    method: "POST",
    body: JSON.stringify({ chat_id: chatId, bot_token: botToken }),
  });
}

export async function saveTelegramConfig(botToken: string, chatIds: string) {
  return request("/alerts/telegram/save-config", {
    method: "POST",
    body: JSON.stringify({ bot_token: botToken, chat_ids: chatIds }),
  });
}

export async function getTelegramConfig() {
  return request("/alerts/telegram/config");
}

export async function discoverTelegramChats(token?: string) {
  const query = token ? `?token=${encodeURIComponent(token)}` : "";
  return request(`/alerts/telegram/discover-chats${query}`);
}

