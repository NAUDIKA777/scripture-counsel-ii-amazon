# AI Rules

## Tech Stack

- **Frontend:** React 19 with plain JavaScript (`.js` / `.jsx` — this project does **not** use TypeScript), bundled by Create React App via CRACO (`frontend/`).
- **Routing:** `react-router-dom` v7, with all routes declared in `frontend/src/App.js`.
- **Styling:** Tailwind CSS 3 (config in `frontend/tailwind.config.js`, globals in `src/index.css` and `src/App.css`). No CSS-in-JS libraries.
- **UI components:** shadcn/ui components (already generated in `src/components/ui/`) built on Radix UI primitives, plus `lucide-react` for icons.
- **Backend:** Python FastAPI app in `backend/server.py`, all routes mounted under an `/api` prefix, with MongoDB accessed asynchronously through Motor.
- **AI & media:** LLM calls go through `emergentintegrations.llm.chat` (`LlmChat`), text-to-speech through the ElevenLabs SDK — both server-side only.
- **Mobile:** Capacitor 7 wraps the web build as an Android / Amazon Fire app (`frontend/android/`), with in-app purchases via `@revenuecat/purchases-capacitor`.
- **Testing:** `pytest` for backend tests in `backend/tests/`; test IDs for UI live in `src/constants/testIds/`.

## Library Rules

- **UI:** Always prefer an existing shadcn/ui component from `src/components/ui/`. Never edit files in `src/components/ui/` — wrap or create a new component in `src/components/` instead.
- **Icons:** Use `lucide-react` only. Do not add other icon packs or inline SVG sets.
- **Styling:** Use Tailwind utility classes for all layout, spacing, color, and typography. Merge conditional classes with `cn()` from `src/lib/utils.js` (`clsx` + `tailwind-merge`). Use `class-variance-authority` for variant-driven components.
- **Toasts:** Use `sonner` (the `<Toaster />` is already mounted in `App.js`). Do not use the legacy `toast.jsx` / `use-toast.js` shadcn toast.
- **HTTP:** Always call the backend through the shared `api` axios instance in `src/lib/api.js`. Never construct raw `fetch`/`axios` calls with hardcoded URLs; the base URL comes from `process.env.REACT_APP_BACKEND_URL` + `/api`. Surface errors with `safeErrorMessage()`.
- **Data fetching:** `@tanstack/react-query` is available for cached/server state; local component state is fine for simple one-off calls. Do not mix in SWR for new code.
- **Forms & validation:** `react-hook-form` with `zod` via `@hookform/resolvers`.
- **Animation:** `framer-motion` for motion; `tailwindcss-animate` classes for simple transitions.
- **Dates:** `date-fns` (`dayjs` is legacy — do not introduce it in new code).
- **Images / sharing:** `html-to-image` for rendering shareable verse cards.
- **Purchases & native:** All RevenueCat / Capacitor access must go through `src/lib/revenuecat.js` and the `useAccess` hook — never call the Capacitor plugin directly from a component.
- **Imports:** Use the `@/` alias (configured in `jsconfig.json`) for anything under `src/`.

## Structure Rules

- Pages go in `frontend/src/pages/`, reusable components in `frontend/src/components/`, hooks in `frontend/src/hooks/`, shared helpers in `frontend/src/lib/`.
- Keep components small and focused; create a new file per component.
- Backend: define Pydantic models for all request/response shapes, add routes to `api_router` (never to `app` directly), and read secrets from environment variables only — never hardcode keys.
- Add backend tests under `backend/tests/` when adding or changing API endpoints.
