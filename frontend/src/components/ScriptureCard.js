import React, { useRef, useState } from "react";
import { toast } from "sonner";
import { Quote, Share2, Download, Loader2, Check } from "lucide-react";
import { toPng } from "html-to-image";
import ShareableVerse from "@/components/ShareableVerse";

export default function ScriptureCard({ reference, index }) {
  const shareRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [justCopied, setJustCopied] = useState(false);

  const filename = () =>
    `${reference.book}-${reference.chapter}-${String(reference.verse).replace(/[^\d]/g, "-")}.png`.toLowerCase();

  const generatePng = async () => {
    if (!shareRef.current) return null;
    // Give fonts a chance to be ready
    if (document.fonts && document.fonts.ready) {
      try { await document.fonts.ready; } catch { /* ignore */ }
    }
    return await toPng(shareRef.current, {
      pixelRatio: 2,
      cacheBust: true,
      backgroundColor: "#030712",
    });
  };

  const dataUrlToBlob = async (dataUrl) => {
    const res = await fetch(dataUrl);
    return await res.blob();
  };

  const onShare = async () => {
    setBusy(true);
    try {
      const dataUrl = await generatePng();
      if (!dataUrl) throw new Error("Could not render verse");
      const blob = await dataUrlToBlob(dataUrl);
      const file = new File([blob], filename(), { type: "image/png" });

      // Prefer Web Share API with files if supported
      if (
        typeof navigator !== "undefined" &&
        navigator.canShare &&
        navigator.canShare({ files: [file] })
      ) {
        await navigator.share({
          files: [file],
          title: `${reference.book} ${reference.chapter}:${reference.verse}`,
          text: `"${reference.text}" — ${reference.book} ${reference.chapter}:${reference.verse} (KJV)`,
        });
        setJustCopied(true);
        setTimeout(() => setJustCopied(false), 2000);
      } else {
        // Fallback: trigger a download
        const link = document.createElement("a");
        link.download = filename();
        link.href = dataUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success("Verse image downloaded — share it with a friend.");
      }
    } catch (e) {
      if (e?.name === "AbortError") {
        // User cancelled the share sheet — silent
      } else {
        console.error(e);
        toast.error("Could not create the verse image. Please try again.");
      }
    } finally {
      setBusy(false);
    }
  };

  const onDownload = async () => {
    setBusy(true);
    try {
      const dataUrl = await generatePng();
      if (!dataUrl) throw new Error("Could not render verse");
      const link = document.createElement("a");
      link.download = filename();
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("Verse image saved.");
    } catch (e) {
      console.error(e);
      toast.error("Could not download the verse image.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      data-testid={`scripture-card-${index}`}
      className="parchment rounded-xl p-6 border gold-border relative overflow-hidden group"
    >
      <Quote
        className="absolute top-4 right-4 w-6 h-6"
        style={{ color: "rgba(212,175,55,0.35)" }}
        strokeWidth={1.5}
      />
      <div className="text-xs uppercase tracking-[0.28em] gold-text mb-3">
        {reference.book} {reference.chapter}:{reference.verse}
      </div>
      <p className="scripture-text">&ldquo;{reference.text}&rdquo;</p>

      {/* Actions */}
      <div className="mt-5 flex items-center gap-2 pt-4 border-t border-white/5">
        <button
          onClick={onShare}
          disabled={busy}
          data-testid={`share-verse-${index}`}
          className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs uppercase tracking-widest border border-white/15 text-slate-300 hover:border-amber-300/60 hover:text-amber-100 hover:bg-white/5 disabled:opacity-50"
        >
          {busy ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={2} />
          ) : justCopied ? (
            <Check className="w-3.5 h-3.5" strokeWidth={2} />
          ) : (
            <Share2 className="w-3.5 h-3.5" strokeWidth={2} />
          )}
          <span>{justCopied ? "Sent" : "Share"}</span>
        </button>
        <button
          onClick={onDownload}
          disabled={busy}
          data-testid={`download-verse-${index}`}
          className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs uppercase tracking-widest text-slate-400 hover:text-amber-100 disabled:opacity-50"
        >
          <Download className="w-3.5 h-3.5" strokeWidth={2} />
          <span>Save</span>
        </button>
      </div>

      {/* Off-screen render target for image capture — 0x0 wrapper hides the 1080x1350 inside */}
      <div
        aria-hidden="true"
        style={{ position: "absolute", left: 0, top: 0, width: 0, height: 0, overflow: "hidden", pointerEvents: "none" }}
      >
        <ShareableVerse
          ref={shareRef}
          book={reference.book}
          chapter={reference.chapter}
          verse={reference.verse}
          text={reference.text}
        />
      </div>
    </div>
  );
}
