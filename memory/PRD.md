# Wisdom & Word — PRD

## Problem Statement
An app that uses the Bible as a static knowledge base so when someone has an issue or a problem of any kind they can ask the app that will have a kind Statesman man voice that will answer their problem or their issue using only the knowledge in the Holy Bible.

## User Choices (locked)
- LLM: Claude Sonnet 4.6 (via Emergent Universal Key)
- Voice: ElevenLabs (statesman voice "Daniel" — voice_id `onwK4e9ZLuTAKqWW03F9`)
- Bible translation: KJV
- Auth: None (open access, session tracked via localStorage UUID)
- Feature: Show scripture references / verses cited in each response

## Architecture
- **Backend** (`/app/backend/server.py`):
  - `POST /api/ask` — sends question to Claude Sonnet 4.6 with a strict system prompt that constrains it to KJV-only counsel and enforces JSON output `{answer, references[{book,chapter,verse,text}]}`.
  - `POST /api/tts` — ElevenLabs `text_to_speech.convert` returning audio/mpeg. Returns 503 until `ELEVENLABS_API_KEY` is set in `/app/backend/.env`.
  - `GET /api/verse-of-day` — deterministic daily verse from a curated KJV list.
  - `GET /api/suggestions` — 6 example prompts.
  - `GET /api/history/{session_id}` — session history.
  - Mongo `conversations` collection stores every Q/A + references.
- **Frontend** (React + Tailwind + shadcn):
  - `/app/frontend/src/pages/Home.js` — orchestrates hero, chat, verse of day, follow-up bar.
  - Components: `Hero.js`, `ConversationCard.js`, `VerseOfDay.js`.
  - Fonts: Cormorant Garamond (headings + scripture italic) + Manrope (body).
  - Colors: `#030712` obsidian bg, `#d4af37` aged gold accent, `#fde68a` scripture text.

## Implemented (2026-02-11)
- Full end-to-end Bible counsel flow with Claude Sonnet 4.6.
- Statesman-toned system prompt with strict KJV-only constraint + JSON schema.
- ElevenLabs TTS endpoint (gracefully disabled until user provides API key).
- Beautiful "Monastic Modernism" dark UI with parchment scripture cards, hero fog imagery, gold accent.
- Session-based conversation history persisted in Mongo.
- Verse-of-Day + 6 suggestion pills for onboarding.
- All 11 backend + frontend integration tests passing (iteration_1.json).

## Backlog / Next Actions
- **P0** — Plug in ElevenLabs API key (user will provide tomorrow); TTS endpoint is ready and voice_id already chosen.
- **P1** — Streaming responses (SSE) for faster perceived latency on `/api/ask`.
- **P1** — Bookmark/save favorite counsel answers.
- **P2** — Search all past counsel by keyword.
- **P2** — Multi-voice selector (offer 2-3 statesman voices).
- **P2** — Share-as-image (verse card export to PNG).
