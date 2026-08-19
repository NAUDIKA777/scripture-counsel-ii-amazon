import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Volume2, Pause, Loader2 } from "lucide-react";
import ScriptureCard from "@/components/ScriptureCard";
import LocationCard from "@/components/LocationCard";

const audioBars = [0, 1, 2, 3, 4];

export default function ConversationCard({ convo, api }) {
  const [audioUrl, setAudioUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef(null);

  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  const toggleAudio = async () => {
    // If audio already generated, toggle playback
    if (audioUrl && audioRef.current) {
      if (playing) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      return;
    }
    setLoading(true);
    try {
      const res = await axios.post(
        `${api}/tts`,
        { text: convo.answer },
        { responseType: "blob" }
      );
      const url = URL.createObjectURL(res.data);
      setAudioUrl(url);
      setTimeout(() => audioRef.current?.play(), 50);
    } catch (e) {
      const msg = e?.response?.data
        ? (typeof e.response.data === "string" ? e.response.data : "The statesman voice is not yet configured.")
        : "Could not load audio.";
      // Try parse blob error
      try {
        const text = await e.response.data.text();
        const j = JSON.parse(text);
        toast.error(j.detail || msg);
      } catch {
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <article className="rise-in" data-testid="conversation-card">
      {/* Question */}
      <div className="mb-6 flex justify-end">
        <div className="max-w-2xl glass rounded-2xl rounded-tr-sm px-5 py-3 text-slate-200 text-sm md:text-base" data-testid="user-question">
          <div className="text-[10px] uppercase tracking-[0.3em] text-slate-500 mb-1">You asked</div>
          <div>{convo.question}</div>
        </div>
      </div>

      {/* Answer */}
      <div className="pl-6 md:pl-8 border-l-2" style={{ borderColor: "rgba(212,175,55,0.5)" }} data-testid="counsel-answer">
        <div className="flex items-center gap-4 mb-4">
          <div className="text-[10px] uppercase tracking-[0.35em]" style={{ color: "var(--gold)" }}>
            The Elder speaks
          </div>
          <div className="h-px flex-1 bg-white/10" />
          <button
            onClick={toggleAudio}
            data-testid="play-audio-button"
            className="group inline-flex items-center gap-2 rounded-full pl-2 pr-4 py-1.5 border border-white/15 hover:border-amber-300/60 hover:bg-white/5"
          >
            <span
              className="grid place-items-center w-8 h-8 rounded-full text-slate-950"
              style={{ backgroundColor: "var(--gold)" }}
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2.2} />
              ) : playing ? (
                <Pause className="w-4 h-4" strokeWidth={2.2} />
              ) : (
                <Volume2 className="w-4 h-4" strokeWidth={2.2} />
              )}
            </span>
            <span className="text-xs uppercase tracking-widest text-slate-200 group-hover:text-amber-100">
              {playing ? "Pause" : loading ? "Preparing" : "Listen"}
            </span>
            {playing && (
              <span className="flex items-end gap-0.5 h-4 ml-1" aria-hidden="true">
                {audioBars.map((i) => (
                  <span
                    key={i}
                    className="audio-bar w-0.5 rounded-sm"
                    style={{
                      height: "100%",
                      backgroundColor: "var(--gold)",
                      animationDelay: `${i * 0.12}s`,
                    }}
                  />
                ))}
              </span>
            )}
          </button>
        </div>

        <p className="answer-body whitespace-pre-line">{convo.answer}</p>

        {audioUrl && (
          <audio
            ref={audioRef}
            src={audioUrl}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => setPlaying(false)}
            className="hidden"
          />
        )}
      </div>

      {/* References */}
      {convo.references?.length > 0 && (
        <div className="mt-8" data-testid="scripture-references">
          <div className="text-[10px] uppercase tracking-[0.35em] text-slate-500 mb-4 pl-8">
            Scriptures Cited
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-8">
            {convo.references.map((r, i) => (
              <ScriptureCard key={i} reference={r} index={i} />
            ))}
          </div>
        </div>
      )}

      {/* Locations referenced in Scripture */}
      {convo.locations?.length > 0 && (
        <div className="mt-8" data-testid="scripture-locations">
          <div className="text-[10px] uppercase tracking-[0.35em] text-slate-500 mb-4 pl-8">
            Places in Scripture
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-8">
            {convo.locations.map((loc, i) => (
              <LocationCard key={i} location={loc} index={i} />
            ))}
          </div>
        </div>
      )}
    </article>
  );
}
