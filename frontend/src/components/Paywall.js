import React, { useState } from "react";
import { toast } from "sonner";
import {
  Loader2,
  X,
  Check,
  Sparkles,
  Volume2,
  ScrollText,
  Share2,
  RefreshCw,
} from "lucide-react";
import {
  subscribeMonthly,
  restorePurchases,
  isNativeAmazonBuild,
} from "@/lib/revenuecat";
import { useHardwareBackDismiss } from "@/hooks/useHardwareBackDismiss";

const benefits = [
  { icon: ScrollText, label: "Unlimited counsel from Scripture" },
  { icon: Volume2, label: "Statesman voice reading every answer aloud" },
  { icon: Share2, label: "Beautiful shareable verse images" },
  { icon: Sparkles, label: "Session history saved for reflection" },
];

export default function Paywall({ open, onClose, onUnlock, reason }) {
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);

  // Hardware back closes the paywall instead of exiting the app (Fire OS).
  useHardwareBackDismiss(open && !purchasing, onClose);

  if (!open) return null;

  const native = isNativeAmazonBuild();

  const handleSubscribe = async () => {
    if (!native) {
      toast.error(
        "In-app purchases are only available in the Amazon Appstore edition of Wisdom & Word."
      );
      return;
    }
    setPurchasing(true);
    try {
      const nowPro = await subscribeMonthly();
      if (nowPro) {
        toast.success("Premium is active. Welcome.");
        onUnlock?.();
      } else {
        toast.error(
          "Purchase completed, but premium is not yet active. Try Restore Purchases."
        );
      }
    } catch (e) {
      // RevenueCat throws { code: "PURCHASE_CANCELLED" } when the user dismisses
      // the Amazon dialog — no toast needed for that case.
      const code = e?.code || e?.userCancelled;
      if (code !== "PURCHASE_CANCELLED" && code !== true) {
        toast.error(e?.message || "Purchase could not be completed.");
      }
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    if (!native) {
      toast.error(
        "Purchases can only be restored inside the Amazon Appstore edition of Wisdom & Word."
      );
      return;
    }
    setRestoring(true);
    try {
      const nowPro = await restorePurchases();
      if (nowPro) {
        toast.success("Access restored. Welcome back.");
        onUnlock?.();
      } else {
        toast.error("No active premium purchase was found for this Amazon account.");
      }
    } catch (e) {
      toast.error(e?.message || "Restore failed. Please try again.");
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      data-testid="paywall-modal"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-md"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative w-full max-w-lg glass-strong rounded-3xl p-8 md:p-10 shadow-2xl rise-in max-h-[92vh] overflow-y-auto">
        <button
          onClick={onClose}
          data-testid="paywall-close"
          className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-amber-100 hover:bg-white/5"
          aria-label="Close"
        >
          <X className="w-5 h-5" strokeWidth={1.5} />
        </button>

        <div
          className="text-[10px] uppercase tracking-[0.4em] mb-3"
          style={{ color: "var(--gold)" }}
        >
          {reason === "limit" ? "Free counsel received" : "Continue with the Elder"}
        </div>
        <h2 className="font-serif text-4xl md:text-5xl leading-tight text-slate-50">
          Walk further<br />
          <span className="italic" style={{ color: "var(--gold)" }}>
            with wisdom.
          </span>
        </h2>
        <p className="mt-4 text-slate-300 leading-relaxed">
          You have received your free counsel. Continue the journey — unlimited
          counsel from Scripture, spoken in a warm statesman voice.
        </p>

        <ul className="mt-6 space-y-3">
          {benefits.map(({ icon: Icon, label }, i) => (
            <li
              key={i}
              className="flex items-center gap-3 text-slate-200"
              data-testid={`benefit-${i}`}
            >
              <span
                className="grid place-items-center w-8 h-8 rounded-full border"
                style={{
                  borderColor: "rgba(212,175,55,0.4)",
                  color: "var(--gold)",
                }}
              >
                <Icon className="w-4 h-4" strokeWidth={1.5} />
              </span>
              <span className="text-sm md:text-base">{label}</span>
            </li>
          ))}
        </ul>

        <div className="mt-8 rounded-2xl border gold-border p-5 flex items-baseline justify-between">
          <div>
            <div className="font-serif text-3xl text-slate-50">
              $4.99<span className="text-lg text-slate-400 ml-1">/month</span>
            </div>
            <div className="text-xs uppercase tracking-widest text-slate-400 mt-1">
              Auto-renewing subscription · Charged to your Amazon account
            </div>
          </div>
          <Check className="w-5 h-5" style={{ color: "var(--gold)" }} strokeWidth={2} />
        </div>

        <button
          onClick={handleSubscribe}
          disabled={purchasing || restoring}
          data-testid="paywall-subscribe"
          className="mt-6 w-full inline-flex items-center justify-center gap-2 rounded-full py-3.5 font-medium text-slate-950 hover:brightness-110 disabled:opacity-60"
          style={{ backgroundColor: "var(--gold)" }}
        >
          {purchasing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2} />
              <span className="uppercase tracking-widest text-sm">Opening Amazon…</span>
            </>
          ) : (
            <span className="uppercase tracking-widest text-sm">
              Subscribe via Amazon · $4.99 / month
            </span>
          )}
        </button>

        <button
          onClick={handleRestore}
          disabled={purchasing || restoring}
          data-testid="paywall-restore"
          className="mt-3 w-full inline-flex items-center justify-center gap-2 rounded-full py-3 border border-white/15 text-slate-200 hover:border-amber-300/60 hover:text-amber-100 disabled:opacity-60"
        >
          {restoring ? (
            <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2} />
          ) : (
            <>
              <RefreshCw className="w-4 h-4" strokeWidth={1.5} />
              <span className="uppercase tracking-widest text-sm">Restore Purchases</span>
            </>
          )}
        </button>

        <p className="mt-5 text-[11px] leading-relaxed text-slate-400">
          Payment is charged to your Amazon account. The subscription renews
          automatically every month at $4.99 unless you cancel at least 24
          hours before the end of the current period. Manage or cancel any time
          from <span className="text-slate-300">Your Amazon → Memberships &amp; Subscriptions</span>.
        </p>

        {!native && (
          <p
            className="mt-4 text-[11px] uppercase tracking-widest text-amber-200/70 text-center"
            data-testid="paywall-web-notice"
          >
            Preview mode · install the Amazon Appstore edition to subscribe
          </p>
        )}
      </div>
    </div>
  );
}
