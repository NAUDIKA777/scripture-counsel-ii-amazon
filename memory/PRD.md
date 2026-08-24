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


## Implemented (2026-02-22) — Branding Refresh
- Renamed public brand to **"Wisdom & Word: Spoken Scripture & Archival Biblical Art"** across:
  - `/app/frontend/public/manifest.json` (name + description)
  - `/app/frontend/public/index.html` (title, meta description, OG, Twitter tags)
  - `/app/landing/index.html` and mirrored `/app/frontend/public/landing.html` (title, meta, OG, Twitter, hero eyebrow, hero lede, features section title, replaced "Verse of Today" feature card with "Archival biblical art" 1866 Gustave Doré feature)
- Verified: title, meta description, OG title, hero eyebrow, and hero lede all render the new copy on preview URL.

## Backlog / Next Actions (updated)
- **P1** — Add PWABuilder `assetlinks.json` under `/app/frontend/public/.well-known/` (blocked on user's SHA-256 fingerprint from Amazon Appstore packaging).
- **P1** — Deploy preview → production so the new "Archival Biblical Art" branding reaches live visitors.
- **P2** — Add a small "Featured today" archival Doré engraving strip on the landing page to visually anchor the new pillar.


## Implemented (2026-02-22) — Amazon Appstore Clone
This is a **separate fork** of the codebase intended only for Amazon Appstore
submission. The web production site (`wisdominword.com`) still uses Stripe.

**Removed from this clone**:
- All Stripe endpoints from `backend/server.py`: `/payments/checkout`,
  `/payments/status`, `/subscription/status`, `/subscription/portal`,
  `/subscription/restore`, `/stripe/webhook`, plus `_mark_paid` and
  `_ensure_portal_configuration`.
- `backend/setup_stripe.py` and Stripe test files under `backend/tests/`.
- Stripe env vars from `backend/.env`; `stripe` uninstalled and removed from
  `requirements.txt`.
- `frontend/src/lib/subscription.js`, `frontend/src/pages/PaymentSuccess.js`,
  `frontend/src/pages/PaymentCancel.js`, and their routes in `App.js`.
- All Stripe references in `privacy.html` and `service-worker.js`.

**Added to this clone**:
- `frontend/src/lib/revenuecat.js` — `@revenuecat/purchases-capacitor` wrapper
  that no-ops on plain web and drives native Amazon IAP on the Capacitor build.
- Rewrote `useAccess.js` to source Pro from RevenueCat `CustomerInfo`.
- Rewrote `components/Paywall.js` for Amazon compliance:
  "Subscribe via Amazon · $4.99/month" + "Restore Purchases" + full auto-
  renewal disclosure + cancel path via *Your Amazon → Memberships & Subscriptions*.
- `frontend/capacitor.config.ts` (`appId: com.wisdomandword.app`, `webDir: build`).
- `frontend/android-manifest.patch.xml` — Amazon `<queries>`, IAP receiver,
  and `launchMode="singleTop"` snippets to merge after `npx cap add android`.
- `backend/server.py → POST /api/webhooks/revenuecat` — Bearer-auth webhook
  ledger; entitlement remains client-authoritative via `CustomerInfo`.
- `/app/AMAZON_APPSTORE_SETUP.md` — end-to-end setup guide.

**Verified on 2026-02-22**:
- Paywall renders "Subscribe via Amazon · $4.99 / month" + "Restore Purchases".
- Web preview shows a graceful "install the Amazon Appstore edition" notice.
- Zero occurrences of "Stripe" in the rendered paywall HTML.
- `GET /api/health` returns `billing_provider: "revenuecat_amazon"`.

## Backlog / Next Actions (Amazon build)
- **P0** — User creates Amazon Developer account, registers app with package
  `com.wisdomandword.app`, submits monthly IAP SKU
  `com.wisdomandword.premium.monthly` at $4.99.
- **P0** — User creates RevenueCat project, connects Amazon store with the
  shared secret, and pastes the `amzn_...` public SDK key into
  `frontend/.env → REACT_APP_REVENUECAT_AMAZON_PUBLIC_KEY`.
- **P1** — Locally run `npx cap add android`, drop the PEM into
  `android/app/src/main/assets/AppstoreAuthenticationKey.pem`, merge the
  manifest patch, build signed release APK.
- **P1** — Live App Testing on Amazon to verify RevenueCat receipts before
  full submission.
- **P2** — Enable the RevenueCat webhook for cross-device analytics
  (`REVENUECAT_WEBHOOK_AUTH` on backend + webhook URL in RevenueCat).
