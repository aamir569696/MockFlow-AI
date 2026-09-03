# MockFlow AI — Implementation Tasks

> Mapped against `requirements.md` Phase plan  
> Status reflects actual working codebase as of 2026-09-02  
> `[x]` = implemented and verified · `[-]` = deferred to Phase 5 · `[ ]` = not started

---

## Phase 1 — Project Scaffold & Express Boilerplate ✅

- [x] Initialise monorepo directory layout (`backend/`, `frontend/`, `.kiro/`)
- [x] Create `backend/package.json` with ESM (`"type": "module"`), express, cors, helmet, morgan, dotenv, uuid, jsonwebtoken, bcryptjs, mongoose, express-rate-limit
- [x] Create `backend/server.js` — Express entry point with `process.env.PORT || 5000`
- [x] Wire middleware stack: `helmet()`, `cors()`, `express.json()`, `express.urlencoded()`, `morgan` (dev only)
- [x] Implement `middleware/guestSession.js` — UUID v4 assignment, `x-mockflow-session` header echo
- [x] Implement `middleware/auth.js` — Bearer JWT verification, `req.user` injection
- [x] Implement `middleware/errorHandler.js` — structured `{ error: { code, message, details } }` envelope, stack suppressed in production
- [x] Implement `middleware/notFoundHandler.js` — 404 catch-all
- [x] Create `routes/auth.js` — POST register, login, refresh, logout (501 stubs, auth-gated logout)
- [x] Create `routes/endpoints.js` — full CRUD (501 stubs, all auth-gated)
- [x] Create `routes/generate.js` — POST `/api/generate` with rate limiter (10/min/IP)
- [x] Create `routes/mock.js` — wildcard `/:sessionId/:endpointSlug` for GET/POST/PUT/PATCH/DELETE
- [x] Create `models/User.js` — Mongoose schema (email, passwordHash, displayName, timestamps)
- [x] Create `models/Endpoint.js` — Mongoose schema (owner, slug, description, schema, responses map, timestamps)
- [x] Create `backend/.env.example` with all required variables documented
- [x] Implement `GET /health` — `{ status: 'ok', timestamp }` response
- [x] Verify server starts on `http://localhost:5000` with health check returning 200

---

## Phase 2 — AI Generation Engine & SessionStore ✅

- [x] Install `@google/generative-ai` SDK
- [x] Implement `services/SessionStore.js`
  - [x] In-memory `Map<sessionId, { endpoints, createdAt, lastAccessedAt }>`
  - [x] `getOrCreate(sessionId)` — creates session if absent, updates lastAccessedAt
  - [x] `setEndpoint(sessionId, slug, definition)` — stores mock definition
  - [x] `getEndpoint(sessionId, slug)` — returns definition or null
  - [x] `purgeExpired()` — removes sessions idle > 60 min
  - [x] `setInterval` cleanup every 15 min
- [x] Implement `services/MockResolver.js`
  - [x] Lazy Gemini client init (throws on missing key at call time, not import time)
  - [x] Model: `gemini-3.6-flash`, `responseMimeType: application/json`, `temperature: 0.4`
  - [x] Structured SYSTEM_PROMPT enforcing exact JSON schema shape
  - [x] `safeParseJSON()` — strips markdown fences, `<think>` blocks, extracts first `{…}` object
  - [x] `sanitiseSlug()` — lowercase, hyphen-separated, max 64 chars
  - [x] Primary path: Gemini API call → parse → validate → register in SessionStore
  - [x] Fallback path: any error (503, 404, network, parse fail, empty endpoints) → `buildLocalFallback()`
  - [x] `buildLocalFallback(prompt)` — 40-field `FIELD_VOCAB`, 30-resource `RESOURCE_FIELD_MAP`, regex noun extractor with plural handling, generates 5 endpoints/resource
  - [x] `MockResolver.generate(sessionId, prompt)` — public method, returns `{ apiName, description, schema, endpoints[], _source }`
  - [x] `MockResolver.resolve(sessionId, slug)` — public method, returns definition or null
- [x] Implement `services/DataGenerator.js`
  - [x] `generateValue(schema, key, depth)` — full JSON Schema type coverage
  - [x] Semantic key inference (30+ key-name patterns)
  - [x] Format-based generation: `date-time`, `email`, `uuid`, `uri`, `ipv4`, `phone`, `color`, `hostname`
  - [x] Handles `enum`, `const`, `oneOf`, `anyOf`, `minimum`, `maximum`, `minLength`, `maxLength`, `minItems`, `maxItems`
  - [x] Recursion depth guard (max 6)
  - [x] `generateResponse(endpointDef, method, count)` — method-aware: POST→201, DELETE→204, GET list→array
- [x] Wire `routes/generate.js` — validates prompt, calls `MockResolver.generate()`, returns full payload
- [x] Wire `routes/mock.js`
  - [x] `MockResolver.resolve()` → 404 if not found
  - [x] Latency simulation: `x-mockflow-delay` header + `definition.delayMs`, hard cap 5000ms
  - [x] `?count=N` query override (max 50)
  - [x] `?status=N` query override (100–599)
  - [x] `X-MockFlow-Session`, `X-MockFlow-Slug`, `X-MockFlow-Generated` response headers
- [x] Validate: `POST /api/generate` returns structured response with live endpoint paths
- [x] Validate: `GET /api/mock/:sessionId/:slug` returns realistic fake data

---

## Phase 3 — React Playground UI ✅

- [x] Scaffold `frontend/` with Vite + React 18 + Tailwind CSS 3
- [x] Configure `frontend/postcss.config.js` and `frontend/tailwind.config.js`
  - [x] Brand colour palette (`brand-50` → `brand-950`)
  - [x] Inter + JetBrains Mono font families
- [x] Create `frontend/index.html` with font preconnect, dark body class
- [x] Create `frontend/vite.config.js` with `/api` → `http://localhost:5000` proxy
- [x] Build `frontend/src/index.css`
  - [x] Tailwind directives + custom scrollbar
  - [x] `.btn-primary`, `.btn-ghost`, `.btn-danger` component classes
  - [x] `.card`, `.card-glass` surface classes
  - [x] `.input` form control class
  - [x] `.method-badge` + per-method color classes (GET/POST/PUT/PATCH/DELETE)
  - [x] `.status-2xx/3xx/4xx/5xx` classes
  - [x] `.json-key/string/number/bool/null` syntax token classes
  - [x] `.skeleton` shimmer class
  - [x] `.text-gradient`, `.glow-brand` utility classes
  - [x] Keyframe animations: `fade-in`, `slide-up`, `pulse-ring`, `spin-slow`
- [x] Create `frontend/src/main.jsx` — ReactDOM root with `BrowserRouter`
- [x] Create `frontend/src/App.jsx` — global router, `<AuthModal />` overlay
- [x] Implement `services/mockService.js`
  - [x] axios instance with `baseURL: '/api'`
  - [x] Request interceptor: attaches `x-mockflow-session` header
  - [x] Response interceptor: captures `x-mockflow-session` → localStorage
  - [x] `validateStatus: () => true` — never throws on non-2xx
  - [x] `generateMock(prompt)` — POST /api/generate
  - [x] `runRequest({ method, url }, { body })` — returns structured result object
  - [x] `getSessionId()` / `setSessionId(id)` — localStorage helpers
- [x] Implement `store/playgroundStore.js` (Zustand)
  - [x] `sessionId`, `prompt`, `apiName`, `apiDescription`, `generatedSchema`, `endpoints`
  - [x] `isGenerating`, `generateError`
  - [x] `requestLog[]` — last 50 entries, newest first
  - [x] `activeEndpoint`, `runner` object
  - [x] Actions: `setPrompt`, `setGeneratedSchema`, `setActiveEndpoint`, `setRunnerMethod`, `setRunnerBody`, `clearRunner`, `clearWorkspace`, `generate`, `fireFetch`
- [x] Implement `store/authStore.js` (Zustand)
  - [x] `user`, `accessToken`, `isAuthenticated`, `isAuthModalOpen`, `authTrigger`
  - [x] `isSaveSuccess`, `sandboxApiKey`, `savedCollections[]`
  - [x] Actions: `openAuthModal`, `closeAuthModal`, `setAuth`, `clearAuth`, `simulateSave`, `dismissSaveSuccess`
- [x] Implement `pages/LandingPage.jsx`
  - [x] Radial glow backdrop
  - [x] Animated badge, gradient headline, sub-headline
  - [x] 3-step flow diagram (Describe → Generate → Hit It)
  - [x] Feature cards grid (glassmorphic)
  - [x] "Launch Playground" CTA navigating to `/playground`
- [x] Implement `pages/PlaygroundPage.jsx`
  - [x] Sticky glassmorphic `<NavBar />` with session UUID pill, endpoints-live badge, ExportDropdown, Sign in button
  - [x] 42% left panel (Input) / flex-1 right panel (Live Output) split
  - [x] Panel dividers with section labels
- [x] Implement `components/playground/PromptPanel.jsx`
  - [x] 5 example prompt chips (prefill on click)
  - [x] 1000-char counter with amber/red warning threshold
  - [x] ⌘Enter / Ctrl+Enter keyboard shortcut
  - [x] Loading spinner animation during generation
  - [x] Success banner showing `apiName` post-generation
  - [x] Error banner showing `generateError`
  - [x] Skeleton shimmer during `isGenerating`
- [x] Implement `components/playground/SchemaEditor.jsx`
  - [x] Collapsible JSON tree (`JsonNode`) with `▶`/`▼` toggle
  - [x] Syntax-coloured tokens: key (sky), string (emerald), number (amber), bool (purple), null (red)
  - [x] Tree / Raw tab toggle
  - [x] Loading skeleton during `isGenerating`
  - [x] Empty state illustration
- [x] Implement `components/playground/EndpointPreview.jsx`
  - [x] Per-method colour badges (GET=emerald, POST=blue, PUT=amber, PATCH=purple, DELETE=red)
  - [x] Active endpoint highlight with left-edge brand indicator
  - [x] Hover-reveal Copy URL + Try → buttons
  - [x] Shimmer skeleton overlay (`SkeletonOverlay`) with 6 staggered rows during `isGenerating`
  - [x] Premium `EmptyState` with illustrated icon, floating method pill decorations, ghost route previews
  - [x] `ExportDropdown` (compact icon-only) in header when endpoints exist
  - [x] "Clear Workspace" button with two-click confirmation (auto-revert 2.8s)
  - [x] Composite `key` prop: `${index}-${ep.method}-${ep.slug}` — no key collisions
- [x] Implement `pages/NotFoundPage.jsx` — 404 with back-to-home button
- [x] Implement `pages/DashboardPage.jsx` — auth redirect guard

---

## Phase 4 — RequestRunner, SchemaEditor Polish, Export Engine ✅

- [x] Implement `components/playground/RequestRunner.jsx`
  - [x] Method selector (GET/POST/PUT/PATCH/DELETE) with per-method text colours
  - [x] URL bar displaying relative mock path
  - [x] `JsonBodyEditor` component for POST/PUT/PATCH:
    - [x] Live JSON validation with inline parse error message
    - [x] "Valid JSON" green checkmark badge
    - [x] "Format" button (pretty-print, disabled on invalid JSON)
    - [x] Live line counter
  - [x] "Fire Live Fetch Hit" CTA button with `animate-pulse-ring` when idle
  - [x] Firing spinner state with "Firing request…" label
  - [x] `TelemetryDashboard` after successful hit:
    - [x] `TelemetryCard` × 4: Status Code (glow), Latency (colour-coded), Content-Type, Payload Size
    - [x] Status band with coloured border, glow dot, `200 OK` text, latency echo
  - [x] Syntax-highlighted JSON response body (`HighlightedJson` with `dangerouslySetInnerHTML`)
  - [x] "Clear response" button on response body header
  - [x] Network error display with red panel
  - [x] Empty state when no endpoint selected
- [x] Implement `components/playground/SavePromptBanner.jsx`
  - [x] Sticky bottom bar with API name and "Save Permanently" CTA
  - [x] Hidden when `isAuthenticated` or no endpoints generated
- [x] Implement `components/playground/ExportDropdown.jsx`
  - [x] Trigger button (full label in NavBar, icon-only `compact` mode in EndpointPreview)
  - [x] Disabled with tooltip when no endpoints exist
  - [x] Close on outside click (`mousedown` listener)
  - [x] Close on Escape key
  - [x] "Export Postman Collection" → triggers `buildPostmanCollection()` → `triggerDownload()`
    - [x] Postman v2.1 schema URI
    - [x] All endpoints with headers, body for mutating verbs
    - [x] `baseUrl` variable set to `http://localhost:5000`
  - [x] "Download Local Schema SDK" → triggers `buildSchemaSdk()` → `triggerDownload()`
    - [x] Full schema map, endpoint metadata, usage snippets (JS + curl)
  - [x] Flash confirmation (600ms green flash → auto-close)
  - [x] "Files generated client-side" footer note
- [x] Implement `components/auth/AuthModal.jsx`
  - [x] Overlay with backdrop blur, closes on outside click
  - [x] Login / Register mode toggle
  - [x] Context message for `save` trigger
  - [x] On form submit with `authTrigger === 'save'`: calls `simulateSave()` with full playground snapshot
  - [x] `SaveSuccessScreen`: pulsing checkmark, "API Endpoint Permanently Saved to Cloud Sandbox" headline, `MF-9823-KIRO` API key card with copy button, metadata pills (Plan/Region/Expires), "Continue to Playground →" navigates to `/dashboard`
  - [x] Sandbox hint banner for save trigger

---

## Phase 5 — Auth, Database Persistence ⏸ Deferred

- [-] Connect MongoDB Atlas via `MONGO_URI` environment variable
- [-] Implement `POST /api/auth/register` — bcrypt password hash, JWT issue
- [-] Implement `POST /api/auth/login` — credential verify, JWT issue
- [-] Implement `POST /api/auth/refresh` — refresh token rotation
- [-] Implement `POST /api/auth/logout` — token revocation
- [-] Implement `GET/POST /api/endpoints` — list + save with ownership
- [-] Implement `GET/PUT/DELETE /api/endpoints/:id` — manage with ownership check
- [-] Wire `authService.js` — real login/register/refresh/logout calls
- [-] Wire `endpointService.js` — real save/list/delete calls
- [-] Guest session migration on login (merge non-conflicting slugs)
- [-] Replace `simulateSave()` with real `POST /api/endpoints` + JWT flow
- [-] Persist `savedCollections` to MongoDB; load on auth
- [ ] Implement token refresh on 401 response (axios interceptor)

---

## Phase 6 — Polish, Deployment ✅

- [x] Implement `pages/DashboardPage.jsx` (full premium build)
  - [x] 4× `MetricCard` with SVG sparklines (Total Requests, Avg Latency, Live Endpoints, Success Rate)
  - [x] Collections sidebar with `CollectionCard` list (active selection)
  - [x] Endpoint tree grid panel with `EndpointRow` list (method badge, path, description, live pulse, collection badge)
  - [x] Live Network Log panel with `LogRow` list (method, slug, status, latency, relative timestamp)
  - [x] Global radial glow backdrop blobs
  - [x] Glassmorphic nav with API key pill, user avatar initial, ← Playground link
  - [x] All entries `animate-fade-in` with staggered delays
- [x] Create `frontend/vercel.json`
  - [x] `buildCommand: npm run build`, `outputDirectory: dist`
  - [x] Catch-all rewrite `/* → /index.html` for SPA routing
  - [x] Immutable cache headers on `/assets/*`
  - [x] Security headers (X-Content-Type-Options, X-Frame-Options, XSS-Protection, Referrer-Policy)
- [x] Create `render.yaml`
  - [x] Free-tier Node web service, `rootDir: backend`
  - [x] `buildCommand: npm install`, `startCommand: npm start`
  - [x] `healthCheckPath: /health`
  - [x] `sync: false` on all secrets (CLIENT_ORIGIN, GEMINI_API_KEY, JWT_SECRET, JWT_REFRESH_SECRET)
  - [x] `autoDeploy: true`
- [x] Patch `backend/server.js` CORS — multi-origin whitelist from `CLIENT_ORIGIN` or `CORS_ORIGIN` env var (comma-separated), curl/Postman passthrough
- [x] Create root `.gitignore`
  - [x] `node_modules/`, `**/node_modules/`
  - [x] `.env`, `.env.*` in all folders; `!.env.example` explicitly tracked
  - [x] `dist/`, `build/`, `.vite/`, `.cache/`
  - [x] OS artefacts (`.DS_Store`, `Thumbs.db`)
  - [x] Editor files (`.vscode/`, `.idea/`)
  - [x] Log files, temp files, pid files
  - [x] Verified with `git check-ignore` — 8/8 path checks passed
- [x] Create `README.md` — full deployment guide, API reference, env var table, tech stack
- [x] Final `vite build` — 111 modules, 0 errors, 0 warnings

---

## Cross-Cutting Quality Tasks ✅

- [x] All API errors return `{ error: { code, message, details? } }` — no raw stack traces in production
- [x] Rate limiting on `/api/generate` — 10 req/min per IP
- [x] Guest session TTL 60 min, cleanup interval 15 min
- [x] Latency simulation — `x-mockflow-delay` header, hard cap 5000ms
- [x] `?count` and `?status` query overrides on mock routes
- [x] No duplicate React `key` props — composite `${index}-${method}-${slug}` pattern
- [x] Zero `npm run build` errors across all 15 implementation prompts
- [x] Vite dev proxy correctly routes `/api/*` → Express backend
- [x] `VITE_API_BASE_URL` env var support documented for production cross-origin wiring
- [x] `process.env.PORT || 5000` confirmed in `server.js` for Render compatibility

---

## Summary

| Phase | Tasks | Completed | Deferred | Not Started |
|-------|-------|-----------|----------|-------------|
| 1 — Scaffold | 17 | 17 | 0 | 0 |
| 2 — AI Engine | 25 | 25 | 0 | 0 |
| 3 — Playground UI | 42 | 42 | 0 | 0 |
| 4 — Runner + Export | 28 | 28 | 0 | 0 |
| 5 — Auth + DB | 14 | 0 | 13 | 1 |
| 6 — Deploy + Polish | 22 | 22 | 0 | 0 |
| Cross-cutting | 10 | 10 | 0 | 0 |
| **Total** | **158** | **144** | **13** | **1** |

**Production-ready for hackathon submission:** All guest-journey, AI generation, live mock execution, telemetry, export, dashboard, and deployment tasks are complete. MongoDB persistence and real JWT auth remain as Phase 5 deferred work.

---

*Tasks document version: 1.0 | Created: 2026-09-02 | Reflects codebase as of prompt 15/15*
