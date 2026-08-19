import React from "react";
import { MapPin, ExternalLink } from "lucide-react";

/**
 * Renders a single biblical location referenced in a counsel.
 * The map link uses Google Maps' universal search URL — works without any API key.
 * When a paid maps provider (Google Maps Platform / Mapbox / OSM) is wired in
 * later, this component will render an inline map card instead of just a link.
 */
export default function LocationCard({ location, index }) {
  if (!location) return null;

  const {
    ancient_name,
    significance,
    modern_name,
    lat,
    lng,
    map_query,
    display_name,
  } = location;

  const hasCoords = typeof lat === "number" && typeof lng === "number";
  const mapsHref = hasCoords
    ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(map_query || ancient_name)}`;

  return (
    <div
      data-testid={`location-card-${index}`}
      className="glass rounded-xl p-5 border border-white/10 hover:border-amber-300/40 transition-colors"
    >
      <div className="flex items-start gap-3">
        <span
          className="grid place-items-center w-9 h-9 rounded-full flex-shrink-0 mt-0.5"
          style={{
            border: "1px solid rgba(212,175,55,0.4)",
            color: "var(--gold)",
          }}
        >
          <MapPin className="w-4 h-4" strokeWidth={1.75} />
        </span>
        <div className="flex-1 min-w-0">
          <div className="font-serif text-xl leading-tight text-slate-50">
            {ancient_name}
          </div>
          {modern_name && (
            <div className="text-[10px] uppercase tracking-[0.25em] text-amber-200/70 mt-1">
              {modern_name}
            </div>
          )}
          {significance && (
            <p className="text-sm text-slate-300 mt-3 leading-relaxed">
              {significance}
            </p>
          )}

          {display_name && (
            <p
              className="text-[11px] text-slate-500 mt-3 leading-relaxed italic"
              data-testid={`location-display-name-${index}`}
              title="Canonical name from OpenStreetMap"
            >
              {display_name}
            </p>
          )}

          <div className="mt-4 flex items-center gap-3 flex-wrap">
            <a
              href={mapsHref}
              target="_blank"
              rel="noopener noreferrer"
              data-testid={`location-open-map-${index}`}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] uppercase tracking-widest border border-white/15 text-slate-300 hover:border-amber-300/60 hover:text-amber-100 hover:bg-white/5"
            >
              <ExternalLink className="w-3 h-3" strokeWidth={2} />
              Open on Map
            </a>
            {hasCoords && (
              <span className="text-[10px] uppercase tracking-[0.25em] text-slate-500">
                {lat.toFixed(4)}, {lng.toFixed(4)}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
