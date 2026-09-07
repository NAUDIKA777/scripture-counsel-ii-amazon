import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { Copy, Check, X as XIcon, Loader2 } from "lucide-react";
import { useHardwareBackDismiss } from "@/hooks/useHardwareBackDismiss";

/**
 * Small modal that shows a shareable URL + quick-share buttons for X, WhatsApp,
 * Facebook, and system share (mobile). Opened after a share record is created
 * via POST /api/shares.
 */
export default function ShareLinkDialog({ open, onClose, shareUrl, verseRef, verseText }) {
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    if (!open) setCopied(false);
  }, [open]);

  // Hardware back closes the dialog instead of exiting the app (Fire OS).
  useHardwareBackDismiss(open, onClose);

  if (!open) return null;

  const tweetText = `"${verseText}" — ${verseRef} (KJV)`;
  const xUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}&url=${encodeURIComponent(shareUrl)}`;
  const waUrl = `https://wa.me/?text=${encodeURIComponent(`${tweetText}\n\n${shareUrl}`)}`;
  const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy link. Please copy it manually.");
    }
  };

  const onNativeShare = async () => {
    setSharing(true);
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${verseRef} — Wisdom & Word`,
          text: tweetText,
          url: shareUrl,
        });
      } else {
        await onCopy();
      }
    } catch (e) {
      if (e?.name !== "AbortError") console.warn(e);
    } finally {
      setSharing(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      data-testid="share-link-dialog"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-md"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative w-full max-w-md glass-strong rounded-3xl p-7 md:p-8 shadow-2xl rise-in">
        <button
          onClick={onClose}
          data-testid="share-link-close"
          className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-amber-100 hover:bg-white/5"
          aria-label="Close"
        >
          <XIcon className="w-5 h-5" strokeWidth={1.5} />
        </button>

        <div className="text-[10px] uppercase tracking-[0.4em] mb-3" style={{ color: "var(--gold)" }}>
          Share this Scripture
        </div>
        <h2 className="font-serif text-3xl text-slate-50 leading-tight">
          Send it to a friend<br />
          <span className="italic" style={{ color: "var(--gold)" }}>who needs it.</span>
        </h2>
        <p className="mt-3 text-sm text-slate-400 leading-relaxed">
          Anyone who opens the link sees the verse in a beautiful preview — and can begin their own
          journey with the Elder.
        </p>

        <div className="mt-6 flex items-center gap-2 rounded-xl bg-white/5 border border-white/15 pl-4 pr-2 py-2">
          <input
            type="text"
            value={shareUrl}
            readOnly
            data-testid="share-link-url"
            className="flex-1 bg-transparent outline-none text-slate-200 text-sm truncate"
            onClick={(e) => e.currentTarget.select()}
          />
          <button
            onClick={onCopy}
            data-testid="share-link-copy"
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs uppercase tracking-widest font-medium text-slate-950 hover:brightness-110"
            style={{ backgroundColor: "var(--gold)" }}
          >
            {copied ? <Check className="w-3.5 h-3.5" strokeWidth={2.2} /> : <Copy className="w-3.5 h-3.5" strokeWidth={2.2} />}
            <span>{copied ? "Copied" : "Copy"}</span>
          </button>
        </div>

        <div className="mt-5 text-[10px] uppercase tracking-[0.3em] text-slate-500 mb-3">Share via</div>
        <div className="grid grid-cols-4 gap-3">
          <a
            href={xUrl}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="share-to-x"
            className="flex flex-col items-center gap-1.5 rounded-xl border border-white/10 py-3 hover:border-amber-300/60 hover:bg-white/5 transition-colors"
          >
            <XIcon className="w-5 h-5 text-slate-200" strokeWidth={2} />
            <span className="text-[10px] uppercase tracking-widest text-slate-400">X</span>
          </a>
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="share-to-whatsapp"
            className="flex flex-col items-center gap-1.5 rounded-xl border border-white/10 py-3 hover:border-amber-300/60 hover:bg-white/5 transition-colors"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-slate-200" aria-hidden="true">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.966-.273-.099-.471-.148-.67.15-.198.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.148-.669-1.611-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.71.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.999-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            <span className="text-[10px] uppercase tracking-widest text-slate-400">WhatsApp</span>
          </a>
          <a
            href={fbUrl}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="share-to-facebook"
            className="flex flex-col items-center gap-1.5 rounded-xl border border-white/10 py-3 hover:border-amber-300/60 hover:bg-white/5 transition-colors"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-slate-200" aria-hidden="true">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
            </svg>
            <span className="text-[10px] uppercase tracking-widest text-slate-400">Facebook</span>
          </a>
          <button
            onClick={onNativeShare}
            disabled={sharing}
            data-testid="share-native"
            className="flex flex-col items-center gap-1.5 rounded-xl border border-white/10 py-3 hover:border-amber-300/60 hover:bg-white/5 transition-colors disabled:opacity-50"
          >
            {sharing ? (
              <Loader2 className="w-5 h-5 text-slate-200 animate-spin" strokeWidth={2} />
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-slate-200" aria-hidden="true">
                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                <polyline points="16 6 12 2 8 6" />
                <line x1="12" y1="2" x2="12" y2="15" />
              </svg>
            )}
            <span className="text-[10px] uppercase tracking-widest text-slate-400">More</span>
          </button>
        </div>

        <div className="mt-6 text-[10px] text-center text-slate-500 tracking-widest uppercase">
          Anyone with the link can view · No account needed
        </div>
      </div>
    </div>
  );
}
