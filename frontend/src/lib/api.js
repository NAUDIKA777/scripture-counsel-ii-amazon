import axios from "axios";

// Production backend used by the packaged Amazon Appstore build. Inside the
// Capacitor WebView the page is served from http://localhost, so relative URLs
// and window.location.origin can never reach the API — an absolute HTTPS origin
// is mandatory there.
export const PRODUCTION_BACKEND_URL = "https://wisdominword.com 

function resolveBackendUrl() {
  const fromEnv = (process.env.REACT_APP_BACKEND_URL || "").trim();
  if (fromEnv && /^https?:\/\//i.test(fromEnv)) {
    return fromEnv.replace(/\/+$/, "");
  }
  // No usable env value (missing .env at build time). Never fall through to
  // "undefined/api" — that produced a hard-fail on every request in the APK.
  return PRODUCTION_BACKEND_URL;
}

const BACKEND_URL = resolveBackendUrl();
const API_BASE = `${BACKEND_URL}/api`;

// Central axios instance for the app. Every request has a 45s hard timeout so
// no call can leave the UI in a stuck loading state (Fire OS WebView can
// silently drop TLS connections on older Fire tablets — without a timeout the
// spinner would spin forever).
export const api = axios.create({
  baseURL: API_BASE,
  timeout: 45_000,
  headers: { "Content-Type": "application/json" },
});

export { API_BASE, BACKEND_URL };

/**
 * Origin to embed in publicly shared links. Inside the Capacitor WebView
 * window.location.origin is http(s)://localhost, which would hand friends a
 * dead link, so the public production host is used for any local origin.
 */
export function publicShareOrigin() {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  if (!origin || !/^https?:/i.test(origin) || /\/\/localhost(:\d+)?$/i.test(origin)) {
    return PRODUCTION_BACKEND_URL;
  }
  return origin;
}

// Maximum question length accepted by the backend. Enforced client-side so
// Fire OS soft keyboards with predictive text can't paste 100 KB of text
// into the input and blow up the render loop.
export const MAX_QUESTION_LEN = 2000;

/**
 * Coerce any axios / network error into a short, safe, human-readable string
 * suitable for toast display. Never returns objects or arrays.
 */
export function safeErrorMessage(err, fallback = "Something went wrong. Please try again.") {
  try {
    if (!err) return fallback;
    if (err.code === "ECONNABORTED" || err.message === "Network Error") {
      return "The request timed out. Please check your connection and try again.";
    }
    const detail = err?.response?.data?.detail;
    if (typeof detail === "string" && detail.trim()) return detail.slice(0, 240);
    if (Array.isArray(detail) && detail.length) {
      // FastAPI validation error shape: [{msg, loc, type}, ...]
      const first = detail[0];
      if (first && typeof first.msg === "string") return first.msg.slice(0, 240);
    }
    if (typeof err.message === "string" && err.message) {
      return err.message.slice(0, 240);
    }
    return fallback;
  } catch {
    return fallback;
  }
}

/**
 * Validate the counsel question client-side. Returns { ok, value, reason }.
 * - Empty / whitespace-only → not ok, gentle reason.
 * - Trimmed length > MAX_QUESTION_LEN → not ok, truncation reason.
 * - Otherwise → ok with the trimmed string.
 *
 * We deliberately do NOT strip special characters here — many prayers and
 * scripture questions contain quotes, apostrophes, em-dashes, and non-ASCII
 * letters. Only whitespace normalization is safe.
 */
export function validateQuestion(raw) {
  if (raw == null) return { ok: false, value: "", reason: "Please share what weighs on your heart." };
  const value = String(raw).replace(/\s+/g, " ").trim();
  if (!value) return { ok: false, value: "", reason: "Please share what weighs on your heart." };
  if (value.length > MAX_QUESTION_LEN) {
    return {
      ok: false,
      value: value.slice(0, MAX_QUESTION_LEN),
      reason: `Question is too long. Please shorten to ${MAX_QUESTION_LEN} characters or fewer.`,
    };
  }
  return { ok: true, value, reason: "" };
}
