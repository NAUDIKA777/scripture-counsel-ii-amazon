import { useEffect, useRef } from "react";

const SENTINEL = "wwOverlay";

/**
 * Fire OS / Android hardware-back support for overlays.
 *
 * Capacitor's BridgeActivity routes the hardware back button to
 * WebView.goBack() when browser history exists, and finishes the activity when
 * it does not. Modals rendered in React are invisible to that logic, so a back
 * press used to close the whole app while the paywall or share dialog was open
 * — an Amazon Appstore review failure.
 *
 * When the overlay opens we push a throw-away history entry; a back press pops
 * it and dismisses the overlay instead of exiting. If the user closes the
 * overlay with the UI, we pop our own entry so the next back press exits
 * normally. Escape is mapped to the same path for keyboard/remote users.
 */
export function useHardwareBackDismiss(open, onDismiss) {
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;

  useEffect(() => {
    if (!open) return undefined;

    let dismissedByBack = false;
    try {
      window.history.pushState({ [SENTINEL]: true }, "");
    } catch {
      // Some Fire OS WebViews block pushState in guest mode — the overlay is
      // still closable from its own buttons.
      return undefined;
    }

    const onPopState = () => {
      dismissedByBack = true;
      dismissRef.current?.();
    };
    const onKeyDown = (e) => {
      if (e.key === "Escape") window.history.back();
    };

    window.addEventListener("popstate", onPopState);
    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("keydown", onKeyDown);
      if (!dismissedByBack && window.history.state?.[SENTINEL]) {
        window.history.back();
      }
    };
  }, [open]);
}
