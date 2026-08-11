import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import { Sun, Share2, Download, Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import { toPng } from "html-to-image";
import ShareableVerse from "@/components/ShareableVerse";

export default function VerseOfDay({ api }) {
  const [verse, setVerse] = useState(null);
  const [busy, setBusy] = useState(false);
  const [justSent, setJustSent] = useState(false);
  const shareRef = useRef(null);

  useEffect(() => {
    axios.get(`${api}/verse-of-day`)
      .then((r) => setVerse(r.data))
      .catch(() => {});
  }, [api]);

  const filename = () =>
    verse
      ? `${verse.book}-${verse.chapter}-${String(verse.verse).replace(/[^\d]/g, "-")}.png`.toLowerCase()
      : "verse.png";

  const generatePng = async () => {
    if (!shareRef.current) return null;
    if (document.fonts?.ready) { try { await document.fonts.ready; } catch { /* ignore */ } }
    return await toPng(shareRef.current, {
      pixelRatio: 2,
      cacheBust: true,
      backgroundColor: "#030712",
    });
  };

  const dataUrlToBlob = async (u) => (await fetch(u)).blob();

  const onShare = async () => {
    if (!verse) return;
    setBusy(true);
    try {
      const dataUrl = await generatePng();
      const blob = await dataUrlToBlob(dataUrl);
      const file = new File([blob], filename(), { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `${verse.book} ${verse.chapter}:${verse.verse}`,
          text: `"${verse.text}" — ${verse.book} ${verse.chapter}:${verse.verse} (KJV)`,
        });
        setJustSent(true);
        setTimeout(() => setJustSent(false), 2000);
      } else {
        const link = document.createElement("a");
        link.download = filename();
        link.href = dataUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success("Verse image downloaded — share it with a friend.");
      }
    } catch (e) {
      if (e?.name !== "AbortError") {
        console.error(e);
        toast.error("Could not create the verse image.");
      }
    } finally {
      setBusy(false);
    }
  };

  const onDownload = async () => {
    if (!verse) return;
    setBusy(true);
    try {
      const dataUrl = await generatePng();
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

  if (!verse) return null;

  return (
    <div
      className="mt-14 parchment rounded-2xl px-8 md:px-12 py-10 border gold-border relative overflow-hidden rise-in"
      data-testid="verse-of-day"
    >
      <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
        <div className="flex items-center gap-3">
          <Sun className="w-4 h-4" style={{ color: "var(--gold)" }} strokeWidth={1.5} />
          <div className="text-[11px] uppercase tracking-[0.35em] text-amber-200/80">
            Verse for Today
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onShare}
            disabled={busy}
            data-testid="share-verse-of-day"
            className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs uppercase tracking-widest border border-white/15 text-slate-300 hover:border-amber-300/60 hover:text-amber-100 hover:bg-white/5 disabled:opacity-50"
          >
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : justSent ? <Check className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}
            <span>{justSent ? "Sent" : "Share"}</span>
          </button>
          <button
            onClick={onDownload}
            disabled={busy}
            data-testid="download-verse-of-day"
            className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs uppercase tracking-widest text-slate-400 hover:text-amber-100 disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Save</span>
          </button>
        </div>
      </div>
      <p className="font-serif italic text-2xl md:text-3xl leading-relaxed" style={{ color: "var(--text-scripture)" }}>
        &ldquo;{verse.text}&rdquo;
      </p>
      <div className="mt-5 text-sm uppercase tracking-[0.28em] gold-text">
        {verse.book} {verse.chapter}:{verse.verse}
      </div>

      <div
        aria-hidden="true"
        style={{ position: "absolute", left: 0, top: 0, width: 0, height: 0, overflow: "hidden", pointerEvents: "none" }}
      >
        <ShareableVerse
          ref={shareRef}
          book={verse.book}
          chapter={verse.chapter}
          verse={verse.verse}
          text={verse.text}
        />
      </div>
    </div>
  );
}
