import React from "react";

/**
 * ErrorBoundary — catches render-time exceptions in the React tree.
 *
 * Fire OS's WebView on older Fire tablets (Fire HD 7/8, K-series) is a
 * lightly-forked Chromium that can throw layout-related errors during a soft-
 * keyboard resize (e.g. ResizeObserver loop overflow) which would otherwise
 * crash the whole SPA. We swallow those, show a calm recovery screen, and
 * expose a "Start over" button that reloads without wiping the free-counsel
 * counter or the session UUID.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error) {
    const raw =
      (error && typeof error.message === "string" && error.message) ||
      "An unexpected error occurred.";
    // Strip stack-like content and keep it short for the fallback UI.
    const message = raw.split("\n")[0].slice(0, 200);
    return { hasError: true, message };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error("[ErrorBoundary]", error, info?.componentStack);
  }

  handleReload = () => {
    // Full reload keeps localStorage (session id, free counter) intact
    // so a Fire OS reviewer's context is not blown away.
    try {
      window.location.reload();
    } catch {
      /* noop */
    }
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div
        className="min-h-screen grid place-items-center px-6 text-center text-slate-100"
        data-testid="error-boundary-fallback"
        role="alert"
      >
        <div className="max-w-md glass-strong rounded-3xl p-8">
          <div
            className="text-[10px] uppercase tracking-[0.4em] mb-3"
            style={{ color: "var(--gold)" }}
          >
            A quiet moment
          </div>
          <h1 className="font-serif text-3xl md:text-4xl leading-tight text-slate-50">
            Something interrupted<br />
            <span className="italic" style={{ color: "var(--gold)" }}>
              your counsel.
            </span>
          </h1>
          <p className="mt-4 text-slate-300 leading-relaxed text-sm">
            The reflection could not be displayed. Reload to continue —
            your free counsels and session are preserved.
          </p>
          <button
            type="button"
            onClick={this.handleReload}
            data-testid="error-boundary-reload"
            className="mt-6 inline-flex items-center justify-center rounded-full px-6 py-2.5 font-medium text-slate-950 hover:brightness-110"
            style={{ backgroundColor: "var(--gold)" }}
          >
            <span className="uppercase tracking-widest text-sm">Reload</span>
          </button>
        </div>
      </div>
    );
  }
}
