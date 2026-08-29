import React from "react";
import { Loader2, Send } from "lucide-react";

export default function Hero({
  question,
  setQuestion,
  onSubmit,
  loading,
  suggestions,
  onPick,
  maxLength = 2000,
}) {
  // Fire OS / Android WebViews fire an Enter keydown even while an IME
  // composition (predictive text, autocorrect suggestion) is still active.
  // Submitting during composition causes the WebView to reflow while an
  // input event is in-flight, which was the root cause of the dropped-
  // characters + crash reports from Amazon reviewers. Guard on both
  // `nativeEvent.isComposing` and legacy keyCode 229.
  const handleKeyDown = (e) => {
    if (e.nativeEvent?.isComposing || e.keyCode === 229) return;
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!loading) onSubmit();
    }
  };

  const handleChange = (e) => {
    const next = e.target.value.slice(0, maxLength);
    setQuestion(next);
  };

  return (
    <section
      className="relative isolate hero-image min-h-[92vh] flex items-center"
      data-testid="hero-section"
    >
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/40 to-slate-950 pointer-events-none" />

      <div className="relative z-10 mx-auto max-w-4xl w-full px-6 md:px-10 py-24">
        <div className="mb-10 rise-in">
          <div className="text-[11px] uppercase tracking-[0.4em] text-amber-200/80 mb-6">
            · Counsel from Scripture ·
          </div>
          <h1 className="font-serif text-5xl md:text-7xl leading-[1.05] tracking-tight text-slate-50">
            Bring what troubles you.<br />
            <span className="italic" style={{ color: "var(--gold)" }}>
              Receive ancient counsel.
            </span>
          </h1>
          <p className="mt-6 max-w-2xl text-slate-300 text-lg md:text-xl leading-relaxed">
            Ask any question that weighs upon your heart. A kind statesman will
            answer you from the Holy Bible alone &mdash; King James Version, unabridged,
            with the Scriptures cited.
          </p>
        </div>

        {/* Ask box */}
        <div
          className="glass-strong rounded-2xl p-2 md:p-3 shadow-2xl rise-in"
          style={{ animationDelay: "0.15s" }}
        >
          <div className="flex items-end gap-2">
            <textarea
              value={question}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              onCompositionEnd={(e) =>
                setQuestion(e.currentTarget.value.slice(0, maxLength))
              }
              placeholder="What weighs upon your heart today?"
              rows={2}
              maxLength={maxLength}
              data-testid="ask-input"
              aria-label="Your question"
              inputMode="text"
              enterKeyHint="send"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="sentences"
              spellCheck={false}
              className="flex-1 bg-transparent outline-none resize-none text-slate-50 placeholder:text-slate-500 text-lg md:text-xl px-4 py-3 font-serif italic"
            />
            <button
              type="button"
              onClick={() => onSubmit()}
              disabled={loading}
              data-testid="ask-submit-button"
              aria-label="Seek counsel"
              className="inline-flex items-center gap-2 rounded-full px-6 md:px-7 py-3 font-medium text-slate-950 hover:brightness-110 disabled:opacity-60"
              style={{ backgroundColor: "var(--gold)" }}
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2} />
              ) : (
                <Send className="w-4 h-4" strokeWidth={2} />
              )}
              <span className="text-sm uppercase tracking-widest">
                {loading ? "Seeking" : "Seek"}
              </span>
            </button>
          </div>
        </div>

        {/* Suggestions */}
        {suggestions?.length > 0 && (
          <div
            className="mt-8 flex flex-wrap gap-2 rise-in"
            style={{ animationDelay: "0.3s" }}
            data-testid="suggestion-pills"
          >
            {suggestions.map((s, i) => (
              <button
                type="button"
                key={i}
                onClick={() => onPick(s)}
                disabled={loading}
                data-testid={`suggestion-${i}`}
                className="text-sm rounded-full px-4 py-2 border border-white/15 text-slate-300 hover:border-amber-300/60 hover:text-amber-100 hover:bg-white/5 disabled:opacity-50"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
