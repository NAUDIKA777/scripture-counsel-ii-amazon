// RevenueCat + Amazon Appstore billing wrapper.
//
// This build ships to the Amazon Appstore only. RevenueCat's native purchase
// flow is invoked via the Capacitor plugin. When the code runs in a regular
// browser (e.g. the developer preview or a desktop tester), every method here
// safely no-ops so the UI still renders — but no purchase can be attempted.
//
// Entitlement identifier is "premium" (matches the RevenueCat dashboard).
// Product SKU is the Amazon MONTHLY TERM SKU (parent.child), configured in the
// Amazon Developer Console and mirrored in the RevenueCat product catalog.

import { Capacitor } from "@capacitor/core";
import {
  Purchases,
  LOG_LEVEL,
} from "@revenuecat/purchases-capacitor";

export const PREMIUM_ENTITLEMENT = "premium";
export const AMAZON_MONTHLY_SKU = "com.wisdomandword.premium.monthly";

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
export function isNativeAmazonBuild() {
  // The Amazon Appstore edition is the only native target we ship, and it is an
  // Android (Fire OS) package. Anything else — browser preview, desktop — has
  // no Amazon IAP available.
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
  if (!isNativeAmazonBuild() || configured) return;
  // Several call sites (useAccess mount, purchase, restore) can race; configure
  // exactly once, otherwise the SDK throws "already configured".
  if (configuring) return configuring;

  const apiKey = process.env.REACT_APP_REVENUECAT_AMAZON_PUBLIC_KEY;
  if (!apiKey) {
    console.warn(
      "RevenueCat Amazon SDK key missing (REACT_APP_REVENUECAT_AMAZON_PUBLIC_KEY)"
    );
    return;
  }

  configuring = (async () => {
    await Purchases.setLogLevel({ level: LOG_LEVEL.WARN });
    // useAmazon:true routes every purchase through Amazon In-App Purchasing.
    // Google Play Billing is never initialised in this build.
    await Purchases.configure({
      apiKey,
      appUserID: getAppUserId(),
      useAmazon: true,
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
  if (!isNativeAmazonBuild()) return false;
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
  const pkg =
    current.monthly ||
    current.availablePackages?.find(
      (p) => p.product?.identifier === AMAZON_MONTHLY_SKU
    );
  if (!pkg) throw new Error("Monthly package not found in current offering.");
  return pkg;
}

// Invokes the native Amazon purchase sheet via RevenueCat.
export async function subscribeMonthly() {
  if (!isNativeAmazonBuild()) {
    throw new Error(
      "In-app purchases are only available in the Wisdom & Word Amazon Appstore edition."
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
  if (!isNativeAmazonBuild()) {
    throw new Error(
      "Purchases can only be restored inside the Wisdom & Word Amazon Appstore edition."
    );
  }
  if (!configured) await configureRevenueCat();
  const result = await Purchases.restorePurchases();
  return Boolean(
    result?.customerInfo?.entitlements?.active?.[PREMIUM_ENTITLEMENT]
  );
}
