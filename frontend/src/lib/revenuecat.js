// RevenueCat + Google Play Billing wrapper.
//
// This build ships to Google Play only. RevenueCat's native purchase flow is
// invoked via the Capacitor plugin. When the code runs in a regular browser
// (e.g. the developer preview or a desktop tester), every method here safely
// no-ops so the UI still renders — but no purchase can be attempted.
//
// Entitlement identifier is "premium" (matches the RevenueCat dashboard).
// Product is the Google Play monthly subscription, configured in the Play
// Console and mirrored in the RevenueCat product catalog.

import { Capacitor } from "@capacitor/core";
import {
  Purchases,
  LOG_LEVEL,
} from "@revenuecat/purchases-capacitor";

export const PREMIUM_ENTITLEMENT = "premium";
export const GOOGLE_PLAY_MONTHLY_SUBSCRIPTION_ID = "com.wisdomandword.premium.monthly";

const APP_USER_ID_KEY = "wisdom_user_id";
const FREE_COUNT_KEY = "wisdom_free_counsel_count";

export const FREE_LIMIT = parseInt(
  process.env.REACT_APP_FREE_COUNSEL_LIMIT || "1",
  10
);

// -------------- Anonymous user id + free counter (unchanged) -----------------
export function getAppUserId() {
  let id = localStorage.getItem(APP_USER_ID_KEY);
  if (!id) {
    id = `anon-${crypto.randomUUID()}`;
    localStorage.setItem(APP_USER_ID_KEY, id);
  }
  return id;
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

// -------------- Platform detection ------------------------------------------
export function isNativeAndroidBuild() {
  // The Google Play edition is the only native target we ship. Anything else —
  // browser preview, desktop — has no Play Billing available.
  try {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
  } catch {
    return false;
  }
}

// -------------- RevenueCat lifecycle ----------------------------------------
let configured = false;
let configuring = null;

export async function configureRevenueCat() {
  if (!isNativeAndroidBuild() || configured) return;
  // Several call sites (useAccess mount, purchase, restore) can race; configure
  // exactly once, otherwise the SDK throws "already configured".
  if (configuring) return configuring;

  const apiKey = process.env.REACT_APP_REVENUECAT_GOOGLE_PUBLIC_KEY;
  if (!apiKey) {
    console.warn(
      "RevenueCat Google SDK key missing (REACT_APP_REVENUECAT_GOOGLE_PUBLIC_KEY)"
    );
    return;
  }

  configuring = (async () => {
    await Purchases.setLogLevel({ level: LOG_LEVEL.WARN });
    // Google Play Billing is RevenueCat's default store on Android; no
    // store flag is needed.
    await Purchases.configure({
      apiKey,
      appUserID: getAppUserId(),
    });
    configured = true;
  })();

  try {
    await configuring;
  } finally {
    configuring = null;
  }
}

// Returns true if the "premium" entitlement is active on the current device.
export async function isPremiumActive() {
  if (!isNativeAndroidBuild()) return false;
  try {
    if (!configured) await configureRevenueCat();
    const { customerInfo } = await Purchases.getCustomerInfo();
    return Boolean(customerInfo?.entitlements?.active?.[PREMIUM_ENTITLEMENT]);
  } catch (e) {
    console.warn("RevenueCat getCustomerInfo failed", e);
    return false;
  }
}

// Returns the monthly package from the current RevenueCat offering, or null.
async function getMonthlyPackage() {
  const offerings = await Purchases.getOfferings();
  const current = offerings?.current;
  if (!current) throw new Error("No RevenueCat offering configured.");
  // Play subscription products are identified as "<subscriptionId>:<basePlanId>".
  const pkg =
    current.monthly ||
    current.availablePackages?.find((p) => {
      const id = p.product?.identifier || "";
      return (
        id === GOOGLE_PLAY_MONTHLY_SUBSCRIPTION_ID ||
        id.startsWith(`${GOOGLE_PLAY_MONTHLY_SUBSCRIPTION_ID}:`)
      );
    });
  if (!pkg) throw new Error("Monthly package not found in current offering.");
  return pkg;
}

// Invokes the native Google Play purchase sheet via RevenueCat.
export async function subscribeMonthly() {
  if (!isNativeAndroidBuild()) {
    throw new Error(
      "In-app purchases are only available in the Wisdom & Word Google Play edition."
    );
  }
  if (!configured) await configureRevenueCat();
  const pkg = await getMonthlyPackage();
  const result = await Purchases.purchasePackage({ aPackage: pkg });
  return Boolean(
    result?.customerInfo?.entitlements?.active?.[PREMIUM_ENTITLEMENT]
  );
}

export async function restorePurchases() {
  if (!isNativeAndroidBuild()) {
    throw new Error(
      "Purchases can only be restored inside the Wisdom & Word Google Play edition."
    );
  }
  if (!configured) await configureRevenueCat();
  const result = await Purchases.restorePurchases();
  return Boolean(
    result?.customerInfo?.entitlements?.active?.[PREMIUM_ENTITLEMENT]
  );
}
