// RevenueCat Web SDK init + freemium counter helpers.
// SDK is only initialized when REACT_APP_REVENUECAT_WEB_PUBLIC_KEY is set.
// Without the key we run in "demo mode": the paywall UI still renders but
// no real purchase can be made — great for previewing the UX before the
// dashboard is fully configured.

let _purchases = null;
let _configured = false;
let _configuring = null;

const APP_USER_ID_KEY = "wisdom_rc_app_user_id";
const FREE_COUNT_KEY = "wisdom_free_counsel_count";
const EMAIL_KEY = "wisdom_restore_email";

export const PUBLIC_KEY = process.env.REACT_APP_REVENUECAT_WEB_PUBLIC_KEY || "";
export const ENTITLEMENT_ID = process.env.REACT_APP_REVENUECAT_ENTITLEMENT_ID || "pro";
export const FREE_LIMIT = parseInt(process.env.REACT_APP_FREE_COUNSEL_LIMIT || "3", 10);

export const isRevenueCatConfigured = () => Boolean(PUBLIC_KEY);

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

export async function getPurchases() {
  if (!isRevenueCatConfigured()) return null;
  if (_purchases) return _purchases;
  if (_configuring) return _configuring;

  _configuring = (async () => {
    try {
      const { Purchases, LogLevel } = await import("@revenuecat/purchases-js");
      if (!_configured) {
        // Enable verbose SDK logs to aid debugging in sandbox mode
        try {
          if (Purchases.setLogLevel && LogLevel) Purchases.setLogLevel(LogLevel.Debug);
        } catch { /* ignore — older SDKs may not expose this */ }
        Purchases.configure({
          apiKey: PUBLIC_KEY,
          appUserId: getAppUserId(),
        });
        _configured = true;
      }
      _purchases = Purchases.getSharedInstance();
      return _purchases;
    } catch (e) {
      console.warn("RevenueCat init failed:", e);
      _configuring = null;
      return null;
    }
  })();

  return _configuring;
}

async function fetchCustomerInfoWithRetry(p, attempts = 4, delayMs = 800) {
  let lastErr = null;
  for (let i = 0; i < attempts; i++) {
    try {
      const info = await p.getCustomerInfo();
      return { info, error: null };
    } catch (e) {
      lastErr = e;
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  return { info: null, error: lastErr };
}

export async function checkProEntitlement() {
  if (!isRevenueCatConfigured()) return false;
  try {
    const p = await getPurchases();
    if (!p) return false;
    const { info } = await fetchCustomerInfoWithRetry(p, 2, 500);
    return Boolean(info?.entitlements?.active?.[ENTITLEMENT_ID]);
  } catch (e) {
    console.warn("Entitlement check failed:", e);
    return false;
  }
}

export async function fetchMonthlyPackage() {
  const p = await getPurchases();
  if (!p) return null;
  const offerings = await p.getOfferings();
  return offerings?.current?.monthly || null;
}

/**
 * Purchase outcome:
 *   { status: "unlocked" }              — entitlement is active
 *   { status: "receipt_only" }          — purchase succeeded at RC but entitlement never
 *                                          activated (usually a dashboard mapping issue)
 *   throws                              — purchase itself failed / was cancelled
 */
export async function purchaseMonthly() {
  const p = await getPurchases();
  if (!p) throw new Error("RevenueCat is not configured yet.");
  const pkg = await fetchMonthlyPackage();
  if (!pkg) throw new Error("The subscription offering is unavailable. Please try again later.");
  const result = await p.purchase({ rcPackage: pkg });

  // Immediate check
  let active = Boolean(result?.customerInfo?.entitlements?.active?.[ENTITLEMENT_ID]);

  // If not immediately active, retry a handful of times to account for RC eventual consistency
  if (!active) {
    for (let i = 0; i < 5 && !active; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      try {
        const info = await p.getCustomerInfo();
        active = Boolean(info?.entitlements?.active?.[ENTITLEMENT_ID]);
      } catch (e) {
        console.warn(`Entitlement recheck ${i + 1} failed:`, e);
      }
    }
  }

  return { status: active ? "unlocked" : "receipt_only" };
}
