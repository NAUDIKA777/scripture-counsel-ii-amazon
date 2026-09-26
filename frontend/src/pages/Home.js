import React, { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, ScrollText, Send, BookOpen, Sparkles, History, Lock } from "lucide-react";
import Hero from "@/components/Hero";
import ConversationCard from "@/components/ConversationCard";
import VerseOfDay from "@/components/VerseOfDay";
import Paywall from "@/components/Paywall";
import ErrorBoundary from "@/components/ErrorBoundary";
import { useAccess } from "@/hooks/useAccess";
import { api, safeErrorMessage, validateQuestion, MAX_QUESTION_LEN } from "@/lib/api";

const SESSION_KEY = "wisdom_session_id";
const SUBMIT_LOCKOUT_MS = 500; // Debounce submits so rapid Enter presses cannot fire concurrent /ask calls

const getOrCreateSession = () => {
  let s = null;
  try {
    s = localStorage.getItem(SESSION_KEY);
    if (!s) {
      s = crypto.randomUUID();
      localStorage.setItem(SESSION_KEY, s);
    }
  } catch {
    // Some Fire OS WebViews disable storage in private/guest mode — fall back
    // to an in-memory UUID so the app still works.
    s = crypto.randomUUID();
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
  const answersRef = useRef(null);
  const lastSubmitRef = useRef(0);
  const mountedRef = useRef(true);

  const access = useAccess();

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await api.get("/suggestions");
        if (!cancelled) setSuggestions(Array.isArray(r.data?.prompts) ? r.data.prompts : []);
      } catch {
        if (!cancelled) setSuggestions([]);
      }
    })();
    (async () => {
      try {
        const r = await api.get(`/history/${sessionId}`);
        if (!cancelled) setConversations(Array.isArray(r.data?.items) ? r.data.items : []);
      } catch {
        if (!cancelled) setConversations([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  // Guarded submit: debounced (500ms lockout), race-safe, error-safe. Never
  // leaves loading=true on the way out; always shows a user-visible outcome.
  const submit = useCallback(
    async (text) => {
      const now = Date.now();
      if (loading) return;
      if (now - lastSubmitRef.current < SUBMIT_LOCKOUT_MS) return;
      lastSubmitRef.current = now;

      const { ok, value, reason } = validateQuestion(text ?? question);
      if (!ok) {
        toast.error(reason);
        return;
      }

      if (!access.canAsk) {
        setPaywallReason("limit");
        setPaywallOpen(true);
        return;
      }

      setLoading(true);
      try {
        const res = await api.post("/ask", { question: value, session_id: sessionId });
        if (!mountedRef.current) return;
        const data = res?.data;
        if (data && typeof data === "object" && data.id) {
          setConversations((c) => [...c, data]);
          setQuestion("");
          if (!access.isPro) access.recordFreeUse();
          // Delay the scroll so the soft keyboard's viewport-resize animation
          // has time to settle on Fire OS — scrolling mid-resize is what
          // triggered ResizeObserver loop crashes in reviewer reports.
          window.setTimeout(() => {
            try {
              answersRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
            } catch {
              /* older WebViews may throw on smooth scroll — ignore */
            }
          }, 350);
        } else {
          toast.error("Counsel could not be delivered. Please try another question.");
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error("[submit]", e);
        if (mountedRef.current) toast.error(safeErrorMessage(e));
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    },
    [access, loading, question, sessionId]
  );

  const clearSession = () => {
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch {
      /* noop */
    }
    window.location.reload();
  };

  const onUnlock = () => {
    setPaywallOpen(false);
    void access.refresh();
    toast.success("Access unlocked.");
  };

  return (
    <ErrorBoundary>
      <div className="relative min-h-screen text-slate-100" data-testid="home-page">
        {/* NAV */}
        <nav className="sticky top-0 z-40 glass-strong border-b border-white/10">
          <div className="mx-auto max-w-6xl px-6 md:px-10 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3" data-testid="brand-logo">
              <ScrollText className="w-5 h-5" style={{ color: "var(--gold)" }} strokeWidth={1.5} />
              <div className="leading-tight">
                <div className="font-serif text-xl tracking-tight text-slate-50">Wisdom &amp; Word</div>
                <div className="text-[10px] uppercase tracking-[0.25em] text-slate-400">
                  Counsel from Scripture · KJV
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {!access.loading && (
                access.isPro ? (
                  <span
                    data-testid="access-pill-pro"
                    aria-label="Premium active"
                    title="Manage from Google Play → Payments & subscriptions → Subscriptions"
                    className="hidden sm:inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] uppercase tracking-widest border"
                    style={{ borderColor: "rgba(212,175,55,0.5)", color: "var(--gold)" }}
                  >
                    <Sparkles className="w-3 h-3" strokeWidth={2} />
                    Premium
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setPaywallReason("upgrade");
                      setPaywallOpen(true);
                    }}
                    data-testid="access-pill-free"
                    className="hidden sm:inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] uppercase tracking-widest border border-white/15 text-slate-300 hover:border-amber-300/60 hover:text-amber-100"
                    title="Upgrade to Premium"
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
                type="button"
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

        <Hero
          question={question}
          setQuestion={setQuestion}
          onSubmit={submit}
          loading={loading}
          suggestions={suggestions}
          onPick={(p) => submit(p)}
          maxLength={MAX_QUESTION_LEN}
        />

        <main className="relative z-10 mx-auto max-w-5xl px-6 md:px-10 pb-32">
          <VerseOfDay />

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
                      {/* Isolate each card so a single bad payload cannot crash the page */}
                      <ErrorBoundary>
                        <ConversationCard convo={c} />
                      </ErrorBoundary>
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

        {conversations.length > 0 && (
          <div
            className="fixed bottom-0 inset-x-0 z-30 glass-strong border-t border-white/10"
            style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
          >
            <div className="mx-auto max-w-3xl px-6 md:px-10 py-4 flex items-center gap-3">
              <input
                value={question}
                onChange={(e) => setQuestion(e.target.value.slice(0, MAX_QUESTION_LEN))}
                onKeyDown={(e) => {
                  // Guard against IME composition (predictive text, autocorrect)
                  if (e.nativeEvent?.isComposing || e.keyCode === 229) return;
                  if (e.key === "Enter" && !loading) {
                    e.preventDefault();
                    submit();
                  }
                }}
                onCompositionEnd={(e) => setQuestion(e.currentTarget.value.slice(0, MAX_QUESTION_LEN))}
                placeholder={access.mustPay ? "Subscribe to continue asking..." : "Ask another question..."}
                data-testid="followup-input"
                aria-label="Ask another question"
                type="text"
                inputMode="text"
                enterKeyHint="send"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="sentences"
                spellCheck={false}
                maxLength={MAX_QUESTION_LEN}
                className="flex-1 bg-transparent outline-none text-slate-100 placeholder:text-slate-500 py-2"
              />
              <button
                type="button"
                onClick={() => submit()}
                disabled={loading}
                data-testid="followup-submit"
                aria-label={access.mustPay ? "Unlock" : "Ask"}
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
          <Sparkles
            className="inline w-3 h-3 mr-2 -mt-0.5"
            style={{ color: "var(--gold)" }}
            strokeWidth={1.5}
          />
          Counsel drawn from the Holy Bible · King James Version
        </footer>

        <Paywall
          open={paywallOpen}
          onClose={() => setPaywallOpen(false)}
          onUnlock={onUnlock}
          reason={paywallReason}
        />
      </div>
    </ErrorBoundary>
  );
}
