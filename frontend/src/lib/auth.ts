// Lightweight client-only "auth" stub. Replace with API integration later.
export type Role = "admin" | "nurse";

export interface Session {
  role: Role;
  name: string;
  email: string;
  ward?: string;
  shift?: string;
  employeeId?: string;
}

const KEY = "nirikshamrita.session";

export function getSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function setSession(s: Session) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(s));
}

export function clearSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
}