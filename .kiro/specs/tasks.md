# MockFlow AI — Implementation Tasks

> **Document type:** Implementation task list / development timeline.
> **Status legend:** `[x]` Done · `[ ]` Not started.
> **Honesty note:** Every task below maps to code that exists in the repository. Items marked
> Done were verified at the source/build/API level (build + serve + request-level checks), not
> via live end-to-end browser click-throughs. Known runtime caveats are called out inline.

---

## Phase 1 — Core Generation & Serving

- [x] **1.1** Scaffold Express (ESM) server with `helmet`, CORS whitelist, JSON/urlencoded
  parsing, `morgan('dev')`, and `/health`. _(server.js)_
- [x] **1.2** Guest session middleware assigns + normalizes session id
  (`trim().toLowerCase()`). _(middleware/guestSession.js)_
- [x] **1.3** AI generation endpoint `POST /api/generate` (prompt → schema + endpoints),
  rate-limited to 10/min. _(routes/generate.js, MockResolver)_
- [x] **1.4** In-memory `SessionStore` with `Map` state and 60-minute TTL. _(services/SessionStore.js)_
- [x] **1.5** Dynamic wildcard mock router `/api/mock/:sessionId/:endpointSlug` (all verbs).
  _(routes/mock.js)_
- [x] **1.6** `DataGenerator` value/response generation + lenient schema validation (`422` on
  present/known fields only). _(services/DataGenerator.js)_

> **Caveat (Phase 1):** `POST /api/generate` requires `GEMINI_API_KEY`. Without it (or on 429),
> the request falls back to `buildLocalFallback` and still returns a usable schema. _(Done, with fallback.)_

## Phase 2 — Stateful Mock Behavior

- [x] **2.1** Collection engine: GET seeds, POST appends, DELETE by `?id`/`body.id`. _(mock.js)_
- [x] **2.2** DELETE **first-item fallback** when no id supplied → `204`; empty →
  `404 COLLECTION_EMPTY`; bad id → `404`. _(mock.js)_
- [x] **2.3** Traffic recording via `res.on('finish')`. _(mock.js, SessionStore.recordTraffic)_
- [x] **2.4** Traffic inspector endpoint `GET /api/traffic/:sessionId`. _(routes/traffic.js)_

## Phase 3 — Request Runner & Tooling

- [x] **3.1** Request runner with method/url/body, custom headers injection. _(RequestRunner.jsx, playgroundStore.fireFetch)_
- [x] **3.2** cURL + multi-language SDK generator (10 runtimes) with auth-header injection. _(SdkGenerator.jsx)_
- [x] **3.3** Postman v2.1 export via export dropdown. _(ExportDropdown.jsx)_
- [x] **3.4** Global edge-region latency simulator (`us-east-1`/`eu-central-1`/`ap-southeast-1`/`local`) via `x-mockflow-region`. _(lib/regions.js, mock.js)_

## Phase 4 — Lab: Browser-Sandboxed Lambda Transformer

- [x] **4.1** Browser-only Lambda transform via `new Function` — **no server-side eval**. _(playgroundStore.runLambdaTransform)_
- [x] **4.2** Deep-clone input + JSON-serializable output guard + fail-safe error handling. _(playgroundStore)_
- [x] **4.3** Toggle (`lambdaEnabled`) and Lab tab UI. _(SandboxStudio.jsx, RequestRunner.jsx)_

## Phase 5 — Load & Regression

- [x] **5.1** Concurrency stress-tester: intensities 50/100/200, waves of `BATCH_SIZE = 25`
  with `Promise.allSettled`. _(StressTester.jsx)_
- [x] **5.2** Stress requests tagged `x-mockflow-stress: 1` and **excluded** from traffic
  inspector. _(StressTester.jsx, SessionStore.recordTraffic)_
- [x] **5.3** Live "Stress Run Log" + `mockflow:stressrun` event dispatch. _(StressTester.jsx)_
- [x] **5.4** Regression log persisted to `mockflow.regressionLog.v1` + `clearRegressionLog`
  export + `mockflow:regressionclear` event. _(RegressionLog.jsx)_

## Phase 6 — Auth Simulation

- [x] **6.1** `POST /api/generate/auth` with `{ action: get | enable | disable | regenerate }`. _(routes/generate.js)_
- [x] **6.2** Mock auth gate → `401 { error: 'Unauthorized', message: 'Missing or invalid API key' }` on missing/invalid Bearer/`x-api-key`. _(mock.js)_
- [x] **6.3** Key format `mf_live_` + 32 hex; regenerate support. _(SessionStore.regenerateAuth)_
- [x] **6.4** Auth-sim UI panel + store wiring (`loadAuthSim`/`setAuthEnabled`/`regenerateAuthKey`). _(RequestRunner.jsx, playgroundStore)_

## Phase 7 — Natural-Language Schema Editing

- [x] **7.1** `POST /api/generate/edit` (NL instruction → updated schema + summary). _(routes/generate.js, MockResolver.editSchema)_
- [x] **7.2** **Local regex refiner fallback** for add / remove / rename / make-required on AI
  failure/429, still returning `200`. _(MockResolver: localSchemaRefine, matchModelKey, soleResource)_
- [x] **7.3** Undo last edit + edit feedback UI. _(ModifySchemaBar.jsx, playgroundStore.undoSchemaEdit)_

> **Caveat (Phase 7):** Rich NL edits need `GEMINI_API_KEY`. The local refiner covers the
> common structural operations deterministically when AI is unavailable. _(Done, with fallback.)_

## Phase 8 — AI Test Suite

- [x] **8.1** `POST /api/generate/tests` (AI-generated cases + expected outcomes). _(routes/generate.js, MockResolver.generateTests)_
- [x] **8.2** Local test-intent builder fallback. _(MockResolver.buildLocalTestIntents)_
- [x] **8.3** Test runner: run all / run only-failed, with summary + unseen badge. _(TestRunner.jsx, playgroundStore.runTestSuite)_

## Phase 9 — Docs & Sharing

- [x] **9.1** Public docs endpoint `GET /api/docs/:sessionId` (no auth), regenerated on view. _(routes/docs.js)_
- [x] **9.2** Share docs UI + shareable link. _(ShareDocs.jsx, ShareDocsButton.jsx)_

## Phase 10 — Workspace & History

- [x] **10.1** History store (`mf_mock_history`, max 5 entries). _(useHistoryStore.js)_
- [x] **10.2** Workspace switcher dropdown sourcing from history; `switchWorkspace(entry)` rehydration. _(DashboardPage.jsx, playgroundStore)_
- [x] **10.3** Dashboard metric cards from `requestLog`. _(DashboardPage.jsx)_

> **Caveat (Phase 10):** Metric cards are **session-global**, not per-workspace — there is no
> client-side per-session request segmentation. _(Done, as designed; documented honestly.)_

## Phase 11 — State-Isolation Fixes (Purge)

- [x] **11.1** `purgeWorkspace` clears only `mf_playground` + `mf_session_id` and calls
  `clearRegressionLog()`. _(playgroundStore.purgeWorkspace)_
- [x] **11.2** **Preserve auth on purge** — `mf_auth` is not wiped; user stays signed in. _(playgroundStore)_
- [x] **11.3** **Preserve saved workspaces on purge** — `mf_mock_history` remains intact. _(playgroundStore)_
- [x] **11.4** Purge confirmation modal. _(PurgeWorkspace.jsx)_

## Phase 12 — Resilience

- [x] **12.1** React `ErrorBoundary` class wrapping `Routes` (recoverable, view-only fallback). _(components/ErrorBoundary.jsx, App.jsx)_
- [x] **12.2** Backend `notFoundHandler` + `errorHandler` terminating the chain. _(middleware/)_
- [x] **12.3** `mockService.runRequest` never throws; returns structured results. _(mockService.js)_

## Phase 13 — Mobile / Responsive Passes

- [x] **13.1** Sub-tab nav bar single-row horizontal scroll:
  `flex items-center gap-2 overflow-x-auto whitespace-nowrap scrollbar-none pb-1 w-full max-w-full`. _(SandboxStudio.jsx)_
- [x] **13.2** `flex-shrink-0` on each tab button so "Lab" is never clipped/squished at 320px. _(SandboxStudio.jsx)_
- [x] **13.3** Export dropdown edge-aligned on mobile:
  `absolute right-0 left-auto origin-top-right w-[88vw] max-w-sm sm:w-72`. _(ExportDropdown.jsx)_
- [x] **13.4** Bounded-height panels (endpoint list `max-h-[38vh]`, truncated URLs) for 320px. _(EndpointPreview.jsx)_
- [x] **13.5** Schema editor expanded by default on mount (Graph/Tree/Raw/Docs open immediately). _(SchemaEditor.jsx)_

## Phase 14 — Session Correctness Patches

- [x] **14.1** **Case-insensitive session lookup** — session id normalized to lowercase so auth
  key and mock lookup key stay aligned. _(guestSession.js, mock.js validateSessionId)_
- [x] **14.2** **429 local refiner** engaged across all AI paths (generate/edit/tests) so the
  product stays functional under quota exhaustion. _(MockResolver)_
- [x] **14.3** Stress-vs-real traffic separation enforced at recorder + inspector layers. _(SessionStore, StressTester)_

---

## Deferred / Not Implemented (transparency)

- [ ] **D-1** Persistent storage (database) — state is intentionally in-memory/ephemeral (C-2).
- [ ] **D-2** Per-workspace metric segmentation — metrics are session-global (C-3).
- [ ] **D-3** Hardened VM-level sandbox for untrusted third-party code — current Lambda sandbox
  is browser-level isolation protecting the server/app, not a multi-tenant jail.
