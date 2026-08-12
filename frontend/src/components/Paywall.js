import React, { useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Loader2, X, Check, Sparkles, Volume2, ScrollText, Share2, Mail } from "lucide-react";
import {
  purchaseMonthly,
  isRevenueCatConfigured,
  setAppUserId,
  setStoredEmail,
} from "@/lib/revenuecat";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const benefits = [
  { icon: ScrollText, label: "Unlimited counsel from Scripture" },
  { icon: Volume2, label: "Statesman voice reading every answer aloud" },
  { icon: Share2, label: "Beautiful shareable verse images" },
  { icon: Sparkles, label: "Session history saved for reflection" },
];

export default function Paywall({ open, onClose, onUnlock, reason }) {
  const [purchasing, setPurchasing] = useState(false);
  const [showRestore, setShowRestore] = useState(false);
  const [email, setEmail] = useState("");
  const [restoring, setRestoring] = useState(false);

  if (!open) return null;

  const configured = isRevenueCatConfigured();

  const handleSubscribe = async () => {
    if (!configured) {
      toast.error(
        "Payments are not activated yet. The site owner must add the RevenueCat API key.",
        { duration: 5000 }
      );
      return;
    }
    setPurchasing(true);
    try {
      const result = await purchaseMonthly();
      if (result?.status === "unlocked") {
        toast.success("Welcome — the Elder's counsel is now unlimited to you.");
        onUnlock?.();
      } else if (result?.status === "receipt_only") {
        const activeIds = result.activeEntitlementIds || [];
        const expected = result.expectedEntitlementId;
        if (activeIds.length > 0) {
          // RC granted SOME entitlement — just not the exact identifier we expected.
          // Show a super-clear diagnostic so a case/name mismatch is obvious.
          toast.error(
            `Purchase received. Entitlement returned: "${activeIds.join('", "')}" but the app expects "${expected}". Ask the site owner to align the identifier.`,
            { duration: 15000 }
          );
        } else {
          toast.error(
            "Purchase received but no entitlement was granted. The site's monthly product is not linked to any entitlement in RevenueCat. Please contact support.",
            { duration: 12000 }
          );
        }
      } else {
        toast.error("Purchase did not complete.");
      }
    } catch (e) {
      const msg = e?.message || "Purchase failed. Please try again.";
      if (!/cancel/i.test(msg)) toast.error(msg);
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    const clean = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(clean)) {
      toast.error("Please enter a valid email address.");
      return;
    }
    setRestoring(true);
    try {
      const res = await axios.post(`${API}/subscription/restore`, { email: clean });
      const { app_user_id, pro_active } = res.data;
      if (app_user_id) {
        setAppUserId(app_user_id);
        setStoredEmail(clean);
      }
      if (pro_active) {
        toast.success("Access restored. Welcome back.");
        onUnlock?.();
      } else {
        toast.info(
          "No active subscription was found for this email. Please subscribe to continue."
        );
      }
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Restore failed. Please try again.");
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

      <div className="relative w-full max-w-lg glass-strong rounded-3xl p-8 md:p-10 shadow-2xl rise-in">
        <button
          onClick={onClose}
          data-testid="paywall-close"
          className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-amber-100 hover:bg-white/5"
          aria-label="Close"
        >
          <X className="w-5 h-5" strokeWidth={1.5} />
        </button>

        {!showRestore ? (
          <>
            <div className="text-[10px] uppercase tracking-[0.4em] mb-3" style={{ color: "var(--gold)" }}>
              {reason === "limit" ? "Free counsels received" : "Continue with the Elder"}
            </div>
            <h2 className="font-serif text-4xl md:text-5xl leading-tight text-slate-50">
              Walk further<br />
              <span className="italic" style={{ color: "var(--gold)" }}>with wisdom.</span>
            </h2>
            <p className="mt-4 text-slate-300 leading-relaxed">
              You have received your free counsel. Continue the journey — unlimited counsel from
              Scripture, spoken in a warm statesman voice.
            </p>

            <ul className="mt-6 space-y-3">
              {benefits.map(({ icon: Icon, label }, i) => (
                <li key={i} className="flex items-center gap-3 text-slate-200" data-testid={`benefit-${i}`}>
                  <span
                    className="grid place-items-center w-8 h-8 rounded-full border"
                    style={{ borderColor: "rgba(212,175,55,0.4)", color: "var(--gold)" }}
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
                  Auto-renews monthly · Cancel any time
                </div>
              </div>
              <Check className="w-5 h-5" style={{ color: "var(--gold)" }} strokeWidth={2} />
            </div>

            <button
              onClick={handleSubscribe}
              disabled={purchasing}
              data-testid="paywall-subscribe"
              className="mt-6 w-full inline-flex items-center justify-center gap-2 rounded-full py-3.5 font-medium text-slate-950 hover:brightness-110 disabled:opacity-60"
              style={{ backgroundColor: "var(--gold)" }}
            >
              {purchasing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2} />
                  <span className="uppercase tracking-widest text-sm">Processing</span>
                </>
              ) : (
                <span className="uppercase tracking-widest text-sm">Subscribe · $4.99 / month</span>
              )}
            </button>

            {!configured && (
              <div
                className="mt-4 text-xs text-amber-200/80 text-center leading-relaxed"
                data-testid="paywall-demo-notice"
              >
                Preview mode — payments are not yet active on this site.
              </div>
            )}

            <button
              onClick={() => setShowRestore(true)}
              data-testid="paywall-restore-link"
              className="mt-5 w-full text-center text-xs uppercase tracking-[0.3em] text-slate-400 hover:text-amber-100 flex items-center justify-center gap-2"
            >
              <Mail className="w-3.5 h-3.5" strokeWidth={1.5} />
              Restore access with email
            </button>

            {/* Managed paywall target (unused when using custom UI, but kept for future) */}
            <div id="revenuecat-paywall" />
          </>
        ) : (
          <>
            <div className="text-[10px] uppercase tracking-[0.4em] mb-3" style={{ color: "var(--gold)" }}>
              Restore Access
            </div>
            <h2 className="font-serif text-3xl md:text-4xl leading-tight text-slate-50">
              Welcome back.
            </h2>
            <p className="mt-3 text-slate-300 leading-relaxed">
              Enter the email you used when you subscribed. We will find your account and restore
              full access to this browser.
            </p>

            <label className="block mt-6 text-xs uppercase tracking-widest text-slate-400 mb-2">
              Email address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleRestore()}
              placeholder="you@example.com"
              data-testid="restore-email-input"
              autoComplete="email"
              className="w-full rounded-xl bg-white/5 border border-white/15 px-4 py-3 text-slate-100 placeholder:text-slate-500 focus:border-amber-300/60 outline-none"
            />

            <button
              onClick={handleRestore}
              disabled={restoring}
              data-testid="restore-submit"
              className="mt-5 w-full inline-flex items-center justify-center gap-2 rounded-full py-3 font-medium text-slate-950 hover:brightness-110 disabled:opacity-60"
              style={{ backgroundColor: "var(--gold)" }}
            >
              {restoring ? (
                <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2} />
              ) : (
                <span className="uppercase tracking-widest text-sm">Restore Access</span>
              )}
            </button>

            <button
              onClick={() => setShowRestore(false)}
              data-testid="restore-back"
              className="mt-4 w-full text-center text-xs uppercase tracking-[0.3em] text-slate-400 hover:text-amber-100"
            >
              ← Back to subscribe
            </button>
          </>
        )}
      </div>
    </div>
  );
}
