import { useCallback, useEffect, useState } from "react";
import {
  configureRevenueCat,
  isPremiumActive,
  getFreeCount,
  incrementFreeCount,
  FREE_LIMIT,
} from "@/lib/revenuecat";

/**
 * Access gate for the Amazon Appstore build.
 * - 1 free counsel (trial) tracked locally in localStorage.
 * - "Pro" entitlement comes from RevenueCat CustomerInfo (Amazon store) —
 *   authoritative on device, refreshed on mount and on demand.
 * - In a plain web browser (no Capacitor), isPro will always be false;
 *   the paywall messaging directs the user to the Amazon build.
 */
export function useAccess() {
  const [isPro, setIsPro] = useState(false);
  const [freeCount, setFreeCount] = useState(getFreeCount());
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      await configureRevenueCat();
      const active = await isPremiumActive();
      setIsPro(active);
    } finally {
      setFreeCount(getFreeCount());
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const recordFreeUse = useCallback(() => {
    const n = incrementFreeCount();
    setFreeCount(n);
    return n;
  }, []);

  const freeRemaining = Math.max(0, FREE_LIMIT - freeCount);
  const mustPay = !isPro && freeRemaining <= 0;
  const canAsk = isPro || freeRemaining > 0;

  return {
    isPro,
    loading,
    freeCount,
    freeRemaining,
    freeLimit: FREE_LIMIT,
    mustPay,
    canAsk,
    refresh,
    recordFreeUse,
  };
}
