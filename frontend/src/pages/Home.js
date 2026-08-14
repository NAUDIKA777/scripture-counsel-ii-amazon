import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, ScrollText, Send, BookOpen, Sparkles, History, Lock, Settings } from "lucide-react";
import Hero from "@/components/Hero";
import ConversationCard from "@/components/ConversationCard";
import VerseOfDay from "@/components/VerseOfDay";
import Paywall from "@/components/Paywall";
import { useAccess } from "@/hooks/useAccess";
import { openBillingPortal } from "@/lib/subscription";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const sessionKey = "wisdom_session_id";
const getOrCreateSession = () => {
  let s = localStorage.getItem(sessionKey);
  if (!s) {
    s = crypto.randomUUID();
    localStorage.setItem(sessionKey, s);
  }
  return s;
};

export default function Home() {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [sessionId] = useState(getOrCreateSession);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [paywallReason, setPaywallReason] = useState("limit");
  const [openingPortal, setOpeningPortal] = useState(false);
  const answersRef = useRef(null);

  const access = useAccess();

  const onManageSubscription = async () => {
    setOpeningPortal(true);
    try {
      const url = await openBillingPortal();
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Could not open the subscription portal.");
    } finally {
      setOpeningPortal(false);
    }
  };

  useEffect(() => {
    axios.get(`${API}/suggestions`)
      .then((r) => setSuggestions(r.data.prompts || []))
      .catch(() => {});
    axios.get(`${API}/history/${sessionId}`)
      .then((r) => setConversations(r.data.items || []))
      .catch(() => {});
  }, [sessionId]);

  const submit = async (text) => {
    const q = (text ?? question).trim();
    if (!q) {
      toast.error("Please share what weighs on your heart.");
      return;
    }
    // Gate: if free counsels are exhausted and no active subscription, show paywall
    if (!access.canAsk) {
      setPaywallReason("limit");
      setPaywallOpen(true);
      return;
    }
    setLoading(true);
    try {
      const res = await axios.post(`${API}/ask`, { question: q, session_id: sessionId });
      setConversations((c) => [...c, res.data]);
      setQuestion("");
      if (!access.isPro) access.recordFreeUse();
      setTimeout(() => {
        answersRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    } catch (e) {
      console.error(e);
      toast.error(e?.response?.data?.detail || "The counsel could not be delivered. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const clearSession = () => {
    localStorage.removeItem(sessionKey);
    window.location.reload();
  };

  const onUnlock = () => {
    setPaywallOpen(false);
    void access.refresh();
    toast.success("Access unlocked.");
  };

  return (
    <div className="relative min-h-screen text-slate-100" data-testid="home-page">
      {/* NAV */}
      <nav className="sticky top-0 z-40 glass-strong border-b border-white/10">
        <div className="mx-auto max-w-6xl px-6 md:px-10 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3" data-testid="brand-logo">
            <ScrollText className="w-5 h-5" style={{ color: "var(--gold)" }} strokeWidth={1.5} />
            <div className="leading-tight">
              <div className="font-serif text-xl tracking-tight text-slate-50">Wisdom &amp; Word</div>
              <div className="text-[10px] uppercase tracking-[0.25em] text-slate-400">Counsel from Scripture · KJV</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Access pill */}
            {!access.loading && (
              access.isPro ? (
                <button
                  onClick={onManageSubscription}
                  disabled={openingPortal}
                  data-testid="access-pill-pro"
                  aria-label="Manage subscription"
                  title="Manage subscription"
                  className="hidden sm:inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] uppercase tracking-widest border hover:bg-amber-500/10 disabled:opacity-60 disabled:cursor-wait"
                  style={{ borderColor: "rgba(212,175,55,0.5)", color: "var(--gold)" }}
                >
                  {openingPortal ? (
                    <Loader2 className="w-3 h-3 animate-spin" strokeWidth={2} />
                  ) : (
                    <Sparkles className="w-3 h-3" strokeWidth={2} />
                  )}
                  Pro
                  <Settings className="w-3 h-3 ml-1 opacity-70" strokeWidth={1.75} />
                </button>
              ) : (
                <button
                  onClick={() => { setPaywallReason("upgrade"); setPaywallOpen(true); }}
                  data-testid="access-pill-free"
                  className="hidden sm:inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] uppercase tracking-widest border border-white/15 text-slate-300 hover:border-amber-300/60 hover:text-amber-100"
                  title="Upgrade to Pro"
                >
                  {access.freeRemaining > 0 ? (
                    <>· {access.freeRemaining} free {access.freeRemaining === 1 ? "counsel" : "counsels"} left ·</>
                  ) : (
                    <><Lock className="w-3 h-3" strokeWidth={2} /> Upgrade</>
                  )}
                </button>
              )
            )}
            <button
              onClick={clearSession}
              data-testid="new-session-btn"
              className="text-xs uppercase tracking-widest text-slate-400 hover:text-amber-200 flex items-center gap-2"
            >
              <History className="w-3.5 h-3.5" strokeWidth={1.5} />
              New Session
            </button>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <Hero
        question={question}
        setQuestion={setQuestion}
        onSubmit={() => submit()}
        loading={loading}
        suggestions={suggestions}
        onPick={(p) => { setQuestion(p); submit(p); }}
      />

      {/* MAIN */}
      <main className="relative z-10 mx-auto max-w-5xl px-6 md:px-10 pb-32">
        <VerseOfDay api={API} />

        {conversations.length > 0 && (
          <section ref={answersRef} className="mt-16" data-testid="answers-section">
            <div className="flex items-baseline justify-between mb-8">
              <h2 className="font-serif text-3xl md:text-4xl text-slate-50">Counsel Received</h2>
              <span className="text-xs uppercase tracking-[0.25em] text-slate-500">
                {conversations.length} {conversations.length === 1 ? "reflection" : "reflections"}
              </span>
            </div>

            <div className="space-y-16">
              <AnimatePresence initial={false}>
                {conversations.map((c, idx) => (
                  <motion.div
                    key={c.id || idx}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.05 * idx }}
                  >
                    <ConversationCard convo={c} api={API} />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </section>
        )}

        {conversations.length === 0 && (
          <div className="mt-16 text-center text-slate-400" data-testid="empty-state">
            <BookOpen className="w-6 h-6 mx-auto mb-3 opacity-60" strokeWidth={1.5} />
            <p className="font-serif text-lg italic">
              &ldquo;Ask, and it shall be given you; seek, and ye shall find.&rdquo;
            </p>
            <p className="text-xs uppercase tracking-[0.3em] mt-2 text-slate-500">— Matthew 7:7</p>
          </div>
        )}
      </main>

      {/* Sticky ask bar for follow-up */}
      {conversations.length > 0 && (
        <div className="fixed bottom-0 inset-x-0 z-30 glass-strong border-t border-white/10">
          <div className="mx-auto max-w-3xl px-6 md:px-10 py-4 flex items-center gap-3">
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !loading && submit()}
              placeholder={access.mustPay ? "Subscribe to continue asking..." : "Ask another question..."}
              data-testid="followup-input"
              className="flex-1 bg-transparent outline-none text-slate-100 placeholder:text-slate-500 py-2"
            />
            <button
              onClick={() => submit()}
              disabled={loading}
              data-testid="followup-submit"
              className="inline-flex items-center gap-2 rounded-full px-5 py-2 font-medium text-slate-950 disabled:opacity-50"
              style={{ backgroundColor: "var(--gold)" }}
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : access.mustPay ? (
                <Lock className="w-4 h-4" strokeWidth={2} />
              ) : (
                <Send className="w-4 h-4" strokeWidth={2} />
              )}
              <span className="text-sm">{access.mustPay ? "Unlock" : "Ask"}</span>
            </button>
          </div>
        </div>
      )}

      <footer className="relative z-10 border-t border-white/5 py-8 text-center text-xs text-slate-500 tracking-widest uppercase">
        <Sparkles className="inline w-3 h-3 mr-2 -mt-0.5" style={{ color: "var(--gold)" }} strokeWidth={1.5} />
        Counsel drawn from the Holy Bible · King James Version
      </footer>

      <Paywall
        open={paywallOpen}
        onClose={() => setPaywallOpen(false)}
        onUnlock={onUnlock}
        reason={paywallReason}
      />
    </div>
  );
}
