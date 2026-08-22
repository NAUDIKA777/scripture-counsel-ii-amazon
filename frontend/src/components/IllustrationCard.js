import React, { useState } from "react";
import { toast } from "sonner";
import { Share2, Download, Loader2, ImageOff } from "lucide-react";

/**
 * Vintage-framed 1866 Gustave Doré Bible engraving card.
 * Displayed above the counsel answer when the LLM's illustration_theme matches
 * an entry in the cached Wikimedia catalog.
 *
 * Two actions:
 *  - Share: Web Share API (native sheet with title + verse text + image link)
 *  - Save Hi-Res: fetches the full-resolution PD engraving and downloads it
 */
export default function IllustrationCard({ illustration, quoteVerse }) {
  const [imgError, setImgError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sharing, setSharing] = useState(false);

  if (!illustration || !illustration.image_url) return null;
  const { title, image_url, hires_url, wiki_url } = illustration;

  const onShare = async () => {
    setSharing(true);
    try {
      const shareData = {
        title: `${title} — Wisdom & Word`,
        text: quoteVerse
          ? `"${quoteVerse}"\n\nIllustrated by Gustave Doré, 1866`
          : `An 1866 engraving by Gustave Doré · Wisdom & Word`,
        url: wiki_url || image_url,
      };
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(`${shareData.text}\n${shareData.url}`);
        toast.success("Link copied — share it anywhere.");
      }
    } catch (e) {
      if (e?.name !== "AbortError") console.warn(e);
    } finally {
      setSharing(false);
    }
  };

  const onSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(hires_url || image_url, { mode: "cors" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-dore-1866.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Full-resolution engraving downloaded.");
    } catch (e) {
      console.warn(e);
      // Fallback: open the file in a new tab so the user can save-as manually
      window.open(hires_url || image_url, "_blank", "noopener,noreferrer");
      toast.info("Opening the engraving in a new tab — right-click to save.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <figure
      data-testid="illustration-card"
      className="mb-8 mx-auto max-w-xl rise-in"
    >
      {/* Vintage frame — outer aged brass rule, inner ivory mat */}
      <div
        className="relative p-3 rounded-md"
        style={{
          background:
            "linear-gradient(145deg, #6b5a2a 0%, #a58947 40%, #6b5a2a 100%)",
          boxShadow:
            "0 20px 50px rgba(0,0,0,0.55), inset 0 0 0 1px rgba(0,0,0,0.5), inset 0 0 0 2px rgba(255,220,150,0.15)",
        }}
      >
        <div
          className="p-4 rounded-sm"
          style={{
            background:
              "linear-gradient(180deg, #f2e6c8 0%, #e6d5a8 100%)",
            boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.3)",
          }}
        >
          <div className="relative bg-black overflow-hidden" style={{ border: "1px solid #3b2f14" }}>
            {imgError ? (
              <div className="w-full aspect-[3/4] flex flex-col items-center justify-center text-slate-400 gap-2">
                <ImageOff className="w-8 h-8" strokeWidth={1.5} />
                <span className="text-[10px] uppercase tracking-[0.28em]">Engraving unavailable</span>
              </div>
            ) : (
              <img
                src={image_url}
                alt={title}
                loading="lazy"
                onError={() => setImgError(true)}
                data-testid="illustration-image"
                className="w-full h-auto block"
                style={{ filter: "sepia(0.08) contrast(1.02)" }}
              />
            )}
          </div>

          {/* Engraved title plate */}
          <figcaption
            className="mt-3 text-center"
            style={{ color: "#3b2f14", fontFamily: "'Cormorant Garamond', Georgia, serif" }}
          >
            <div className="text-xs uppercase tracking-[0.35em] opacity-70">Gustave Doré · 1866</div>
            <div className="text-xl italic mt-1" data-testid="illustration-title">
              {title}
            </div>
          </figcaption>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-4 flex items-center justify-center gap-3">
        <button
          onClick={onShare}
          disabled={sharing}
          data-testid="illustration-share"
          className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs uppercase tracking-widest border border-white/15 text-slate-300 hover:border-amber-300/60 hover:text-amber-100 hover:bg-white/5 disabled:opacity-50"
        >
          {sharing ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={2} />
          ) : (
            <Share2 className="w-3.5 h-3.5" strokeWidth={2} />
          )}
          <span>Share</span>
        </button>
        <button
          onClick={onSave}
          disabled={saving}
          data-testid="illustration-save"
          className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs uppercase tracking-widest text-slate-950 hover:brightness-110 disabled:opacity-50"
          style={{ backgroundColor: "var(--gold)" }}
        >
          {saving ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={2} />
          ) : (
            <Download className="w-3.5 h-3.5" strokeWidth={2} />
          )}
          <span>Save Hi-Res</span>
        </button>
      </div>
      <div className="mt-2 text-center text-[10px] uppercase tracking-[0.28em] text-slate-500">
        Public domain · Wikimedia Commons
      </div>
    </figure>
  );
}
