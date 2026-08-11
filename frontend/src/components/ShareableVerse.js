import React, { forwardRef } from "react";

/**
 * Off-screen 1080x1350 Instagram-story-ready share card for a scripture verse.
 * Rendered off-screen (left: -99999px) and captured via html-to-image.
 */
const ShareableVerse = forwardRef(function ShareableVerse({ book, chapter, verse, text }, ref) {
  return (
    <div
      ref={ref}
      style={{
        width: "1080px",
        height: "1350px",
        background: "linear-gradient(180deg, #030712 0%, #0f172a 60%, #030712 100%)",
        fontFamily: "'Cormorant Garamond', Georgia, serif",
        color: "#f8fafc",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "100px 90px",
        boxSizing: "border-box",
        overflow: "hidden",
      }}
    >
      {/* Ornamental top */}
      <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
        <div style={{ height: "1px", flex: 1, backgroundColor: "rgba(212,175,55,0.4)" }} />
        <div
          style={{
            color: "#d4af37",
            fontSize: "22px",
            letterSpacing: "0.5em",
            textTransform: "uppercase",
            fontFamily: "'Manrope', sans-serif",
            fontWeight: 500,
          }}
        >
          Scripture
        </div>
        <div style={{ height: "1px", flex: 1, backgroundColor: "rgba(212,175,55,0.4)" }} />
      </div>

      {/* Verse body */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <div
          style={{
            fontSize: "76px",
            lineHeight: 1.28,
            fontStyle: "italic",
            color: "#fde68a",
            textAlign: "left",
            fontWeight: 500,
            letterSpacing: "-0.005em",
          }}
        >
          &ldquo;{text}&rdquo;
        </div>

        <div
          style={{
            marginTop: "60px",
            color: "#d4af37",
            fontFamily: "'Manrope', sans-serif",
            letterSpacing: "0.35em",
            fontSize: "28px",
            textTransform: "uppercase",
            fontWeight: 600,
          }}
        >
          {book} {chapter}:{verse}
        </div>
        <div
          style={{
            marginTop: "16px",
            color: "#94a3b8",
            fontFamily: "'Manrope', sans-serif",
            fontSize: "20px",
            letterSpacing: "0.15em",
            textTransform: "uppercase",
          }}
        >
          King James Version
        </div>
      </div>

      {/* Footer brand */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontFamily: "'Manrope', sans-serif",
        }}
      >
        <div>
          <div
            style={{
              fontFamily: "'Cormorant Garamond', Georgia, serif",
              fontSize: "36px",
              color: "#f8fafc",
              letterSpacing: "-0.01em",
            }}
          >
            Wisdom &amp; Word
          </div>
          <div
            style={{
              fontSize: "16px",
              color: "#94a3b8",
              letterSpacing: "0.3em",
              textTransform: "uppercase",
              marginTop: "4px",
            }}
          >
            Counsel from Scripture
          </div>
        </div>
        <div
          style={{
            width: "72px",
            height: "72px",
            borderRadius: "50%",
            border: "2px solid #d4af37",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#d4af37",
            fontSize: "36px",
            fontFamily: "'Cormorant Garamond', serif",
            fontStyle: "italic",
          }}
        >
          W
        </div>
      </div>
    </div>
  );
});

export default ShareableVerse;
