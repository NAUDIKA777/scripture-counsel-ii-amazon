import React, { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { CheckCircle2, Loader2, ScrollText, XCircle } from "lucide-react";
import { pollPaymentStatus } from "@/lib/subscription";

export default function PaymentSuccess() {
  const [params] = useSearchParams();
  const sessionId = params.get("session_id");
  const [state, setState] = useState({ phase: "verifying", message: "Verifying your subscription..." });

  useEffect(() => {
    if (!sessionId) {
      setState({ phase: "error", message: "Missing checkout session." });
      return;
    }
    let cancelled = false;
    (async () => {
      const { ok, status } = await pollPaymentStatus(sessionId);
      if (cancelled) return;
      if (ok) {
        setState({ phase: "success", message: "Your subscription is active." });
      } else if (status === "failed" || status === "expired") {
        setState({ phase: "error", message: "The payment was not completed. Please try again." });
      } else {
        setState({
          phase: "pending",
          message: "We are still confirming your payment. It should appear shortly.",
        });
      }
    })();
    return () => { cancelled = true; };
  }, [sessionId]);

  const Icon =
    state.phase === "success"
      ? CheckCircle2
      : state.phase === "error"
      ? XCircle
      : Loader2;

  const iconClass =
    state.phase === "verifying" || state.phase === "pending" ? "animate-spin" : "";

  return (
    <div className="min-h-screen grain flex items-center justify-center p-6" data-testid="payment-success-page">
      <div className="glass-strong rounded-3xl p-10 md:p-14 max-w-lg w-full text-center rise-in">
        <div className="flex items-center justify-center gap-3 mb-6">
          <ScrollText className="w-5 h-5" style={{ color: "var(--gold)" }} strokeWidth={1.5} />
          <div className="font-serif text-xl text-slate-50">Wisdom &amp; Word</div>
        </div>

        <Icon
          className={`w-14 h-14 mx-auto mb-6 ${iconClass}`}
          style={{ color: state.phase === "error" ? "#f87171" : "var(--gold)" }}
          strokeWidth={1.5}
        />

        <h1 className="font-serif text-3xl md:text-4xl text-slate-50">
          {state.phase === "success" && "Welcome, dear friend."}
          {state.phase === "verifying" && "One moment."}
          {state.phase === "pending" && "Almost there."}
          {state.phase === "error" && "Something happened."}
        </h1>
        <p className="mt-4 text-slate-300 leading-relaxed" data-testid="payment-success-message">
          {state.message}
        </p>

        <Link
          to="/"
          data-testid="payment-success-continue"
          className="mt-8 inline-flex items-center gap-2 rounded-full px-6 py-3 font-medium text-slate-950 hover:brightness-110"
          style={{ backgroundColor: "var(--gold)" }}
        >
          <span className="uppercase tracking-widest text-sm">
            {state.phase === "success" ? "Continue to counsel" : "Back to Wisdom & Word"}
          </span>
        </Link>
      </div>
    </div>
  );
}
