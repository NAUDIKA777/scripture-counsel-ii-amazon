import React, { useState } from "react";
import { toast } from "sonner";
import { Loader2, X, Check, Sparkles, Volume2, ScrollText, Share2, Mail } from "lucide-react";
import { startCheckout, restoreByEmail, setAppUserId, setStoredEmail } from "@/lib/subscription";

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
  const [checkoutEmail, setCheckoutEmail] = useState("");
  const [restoring, setRestoring] = useState(false);

  if (!open) return null;

  const handleSubscribe = async () => {
    setPurchasing(true);
    try {
      const { checkout_url } = await startCheckout(checkoutEmail || undefined);
      if (!checkout_url) throw new Error("No checkout URL returned.");
      // Redirect to Stripe Checkout
      window.location.href = checkout_url;
    } catch (e) {
      console.error(e);
      toast.error(e?.response?.data?.detail || e?.message || "Could not start checkout. Please try again.");
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
      const { app_user_id, pro_active, found } = await restoreByEmail(clean);
      if (app_user_id) {
        setAppUserId(app_user_id);
        setStoredEmail(clean);
      }
      if (pro_active) {
        toast.success("Access restored. Welcome back.");
        onUnlock?.();
      } else {
        toast.error(
          found
            ? "This subscription is no longer active. Please subscribe again."
            : "No subscription was found for this email. Please subscribe to continue.",
          { duration: 6000 }
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

      <div className="relative w-full max-w-lg glass-strong rounded-3xl p-8 md:p-10 shadow-2xl rise-in max-h-[92vh] overflow-y-auto">
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

            <label className="block mt-6 text-[10px] uppercase tracking-[0.3em] text-slate-400 mb-2">
              Email (for receipts &amp; access recovery — optional)
            </label>
            <input
              type="email"
              value={checkoutEmail}
              onChange={(e) => setCheckoutEmail(e.target.value)}
              placeholder="you@example.com"
              data-testid="checkout-email-input"
              autoComplete="email"
              className="w-full rounded-xl bg-white/5 border border-white/15 px-4 py-3 text-slate-100 placeholder:text-slate-500 focus:border-amber-300/60 outline-none"
            />

            <button
              onClick={handleSubscribe}
              disabled={purchasing}
              data-testid="paywall-subscribe"
              className="mt-5 w-full inline-flex items-center justify-center gap-2 rounded-full py-3.5 font-medium text-slate-950 hover:brightness-110 disabled:opacity-60"
              style={{ backgroundColor: "var(--gold)" }}
            >
              {purchasing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2} />
                  <span className="uppercase tracking-widest text-sm">Redirecting</span>
                </>
              ) : (
                <span className="uppercase tracking-widest text-sm">Subscribe · $4.99 / month</span>
              )}
            </button>

            <div className="mt-3 text-[10px] text-center text-slate-500 tracking-widest uppercase">
              Secure checkout by Stripe · Test card 4242 4242 4242 4242
            </div>

            <button
              onClick={() => setShowRestore(true)}
              data-testid="paywall-restore-link"
              className="mt-5 w-full text-center text-xs uppercase tracking-[0.3em] text-slate-400 hover:text-amber-100 flex items-center justify-center gap-2"
            >
              <Mail className="w-3.5 h-3.5" strokeWidth={1.5} />
              Restore access with email
            </button>
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
              Enter the email you used at checkout. We will find your subscription and restore full
              access to this browser.
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
