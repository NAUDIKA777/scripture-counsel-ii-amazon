import React, { useEffect, useState } from "react";
import axios from "axios";
import { Sun } from "lucide-react";

export default function VerseOfDay({ api }) {
  const [verse, setVerse] = useState(null);

  useEffect(() => {
    axios.get(`${api}/verse-of-day`)
      .then((r) => setVerse(r.data))
      .catch(() => {});
  }, [api]);

  if (!verse) return null;

  return (
    <div
      className="mt-14 parchment rounded-2xl px-8 md:px-12 py-10 border gold-border relative overflow-hidden rise-in"
      data-testid="verse-of-day"
    >
      <div className="flex items-center gap-3 mb-5">
        <Sun className="w-4 h-4" style={{ color: "var(--gold)" }} strokeWidth={1.5} />
        <div className="text-[11px] uppercase tracking-[0.35em] text-amber-200/80">
          Verse for Today
        </div>
      </div>
      <p className="font-serif italic text-2xl md:text-3xl leading-relaxed" style={{ color: "var(--text-scripture)" }}>
        &ldquo;{verse.text}&rdquo;
      </p>
      <div className="mt-5 text-sm uppercase tracking-[0.28em] gold-text">
        {verse.book} {verse.chapter}:{verse.verse}
      </div>
    </div>
  );
}
