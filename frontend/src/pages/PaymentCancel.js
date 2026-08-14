import React from "react";
import { Link } from "react-router-dom";
import { ScrollText, XCircle } from "lucide-react";

export default function PaymentCancel() {
  return (
    <div className="min-h-screen grain flex items-center justify-center p-6" data-testid="payment-cancel-page">
      <div className="glass-strong rounded-3xl p-10 md:p-14 max-w-lg w-full text-center rise-in">
        <div className="flex items-center justify-center gap-3 mb-6">
          <ScrollText className="w-5 h-5" style={{ color: "var(--gold)" }} strokeWidth={1.5} />
          <div className="font-serif text-xl text-slate-50">Wisdom &amp; Word</div>
        </div>

        <XCircle className="w-14 h-14 mx-auto mb-6 text-slate-400" strokeWidth={1.5} />

        <h1 className="font-serif text-3xl md:text-4xl text-slate-50">Checkout cancelled.</h1>
        <p className="mt-4 text-slate-300 leading-relaxed">
          No charge was made. The Elder is here whenever you are ready.
        </p>

        <Link
          to="/"
          data-testid="payment-cancel-continue"
          className="mt-8 inline-flex items-center gap-2 rounded-full px-6 py-3 font-medium text-slate-950 hover:brightness-110"
          style={{ backgroundColor: "var(--gold)" }}
        >
          <span className="uppercase tracking-widest text-sm">Back to Wisdom &amp; Word</span>
        </Link>
      </div>
    </div>
  );
}
