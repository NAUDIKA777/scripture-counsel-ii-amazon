// Anonymous browser identity + freemium counter + Pro entitlement check via backend.
// No third-party SDK — everything routes through our own /api/subscription/* endpoints
// which talk to Stripe on the server side.

import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const APP_USER_ID_KEY = "wisdom_user_id";
const FREE_COUNT_KEY = "wisdom_free_counsel_count";
const EMAIL_KEY = "wisdom_restore_email";

export const FREE_LIMIT = parseInt(process.env.REACT_APP_FREE_COUNSEL_LIMIT || "3", 10);

export function getAppUserId() {
  let id = localStorage.getItem(APP_USER_ID_KEY);
  if (!id) {
    id = `anon-${crypto.randomUUID()}`;
    localStorage.setItem(APP_USER_ID_KEY, id);
  }
  return id;
}

export function setAppUserId(id) {
  if (id) localStorage.setItem(APP_USER_ID_KEY, id);
}

export function getFreeCount() {
  const raw = localStorage.getItem(FREE_COUNT_KEY);
  const n = raw ? parseInt(raw, 10) : 0;
  return Number.isFinite(n) ? n : 0;
}

export function incrementFreeCount() {
  const next = getFreeCount() + 1;
  localStorage.setItem(FREE_COUNT_KEY, String(next));
  return next;
}

export function getStoredEmail() {
  return localStorage.getItem(EMAIL_KEY) || "";
}

export function setStoredEmail(email) {
  if (email) localStorage.setItem(EMAIL_KEY, email);
}

export async function checkProEntitlement() {
  try {
    const res = await axios.get(`${API}/subscription/status/${encodeURIComponent(getAppUserId())}`);
    return Boolean(res.data?.pro_active);
  } catch (e) {
    console.warn("Entitlement check failed:", e);
    return false;
  }
}

export async function startCheckout(email) {
  const payload = {
    app_user_id: getAppUserId(),
    origin_url: window.location.origin,
  };
  if (email) payload.email = email.trim().toLowerCase();
  const res = await axios.post(`${API}/payments/checkout`, payload);
  return res.data; // { checkout_url, session_id }
}

export async function pollPaymentStatus(sessionId, { intervalMs = 2000, maxAttempts = 30 } = {}) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await axios.get(`${API}/payments/status/${sessionId}`);
      const { payment_status: status } = res.data;
      if (status === "paid") return { ok: true, status };
      if (status === "failed" || status === "expired") return { ok: false, status };
    } catch (e) {
      if (e?.response?.status === 404) return { ok: false, status: "not_found" };
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return { ok: false, status: "timeout" };
}

export async function restoreByEmail(email) {
  const res = await axios.post(`${API}/subscription/restore`, { email: email.trim().toLowerCase() });
  return res.data; // { app_user_id, pro_active, found }
}
