import { useCallback, useEffect, useState } from "react";
import {
  checkProEntitlement,
  getFreeCount,
  incrementFreeCount,
  FREE_LIMIT,
} from "@/lib/subscription";

/**
 * Combines the Stripe-backed Pro entitlement + local free-counsel counter.
 * canAsk  -> user is allowed to submit a new counsel
 * mustPay -> free counsels exhausted and no active subscription
 */
export function useAccess() {
  const [isPro, setIsPro] = useState(false);
  const [freeCount, setFreeCount] = useState(getFreeCount());
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const active = await checkProEntitlement();
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
