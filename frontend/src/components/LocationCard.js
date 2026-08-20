import React, { useState } from "react";
import { MapPin, ExternalLink, ImageOff } from "lucide-react";

/**
 * Photo card for a biblical location referenced in the counsel.
 * Uses Wikimedia Commons imagery (via Wikipedia REST) — free, credited to
 * the source Wikipedia page as the Creative Commons attribution requires.
 */
export default function LocationCard({ location, index }) {
  const [imgError, setImgError] = useState(false);

  if (!location) return null;

  const {
    ancient_name,
    significance,
    modern_name,
    image_url,
    wiki_url,
    wiki_extract,
  } = location;

  const hasImage = Boolean(image_url) && !imgError;

  return (
    <div
      data-testid={`location-card-${index}`}
      className="glass rounded-2xl overflow-hidden border border-white/10 hover:border-amber-300/40 transition-colors flex flex-col"
    >
      {/* Photo */}
      <div className="relative aspect-[16/10] bg-slate-900/70 overflow-hidden">
        {hasImage ? (
          <img
            src={image_url}
            alt={`${ancient_name}${modern_name ? " — " + modern_name : ""}`}
            loading="lazy"
            onError={() => setImgError(true)}
            data-testid={`location-image-${index}`}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 gap-2">
            <ImageOff className="w-6 h-6" strokeWidth={1.5} />
            <span className="text-[10px] uppercase tracking-[0.28em]">No photo available</span>
          </div>
        )}
        {/* Overlay title band */}
        <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/85 via-black/40 to-transparent">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-amber-200/90">
            <MapPin className="w-3 h-3" strokeWidth={2} />
            {modern_name || "Biblical place"}
          </div>
          <div className="font-serif text-2xl md:text-3xl text-slate-50 leading-tight mt-1">
            {ancient_name}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="p-5 flex-1 flex flex-col">
        {significance && (
          <p className="text-sm text-slate-300 leading-relaxed">{significance}</p>
        )}
        {wiki_extract && (
          <p
            className="text-xs text-slate-500 mt-3 leading-relaxed italic"
            data-testid={`location-wiki-extract-${index}`}
          >
            {wiki_extract}
          </p>
        )}

        {wiki_url && (
          <a
            href={wiki_url}
            target="_blank"
            rel="noopener noreferrer"
            data-testid={`location-wiki-link-${index}`}
            className="mt-4 inline-flex items-center gap-1.5 self-start rounded-full px-3 py-1.5 text-[10px] uppercase tracking-widest border border-white/15 text-slate-300 hover:border-amber-300/60 hover:text-amber-100 hover:bg-white/5"
            title="Photo &amp; details via Wikipedia / Wikimedia Commons"
          >
            <ExternalLink className="w-3 h-3" strokeWidth={2} />
            Learn more
          </a>
        )}
      </div>
    </div>
  );
}
