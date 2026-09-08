# MockFlow AI — Design

> **Document type:** System design / architecture.
> **Status:** Describes the architecture as implemented. Component and file names below match
> the source tree.

---

## 1. High-Level Architecture

```
┌────────────────────────────── Browser ──────────────────────────────┐
│  React + Vite SPA                                                    │
│  App.jsx                                                             │
│   └─ <ReactLenis root>            (smooth scroll, lerp 0.12)         │
│        └─ <BrowserRouter>                                            │
│             ├─ <SessionRehydrator/>                                  │
│             ├─ <AuthModal/>                                          │
│             └─ <ErrorBoundary>          (class component)            │
│                  └─ <Routes>  /  /playground  /dashboard            │
│                                /docs/:sessionId  *                   │
│                                                                     │
│  Zustand stores (localStorage-persisted):                           │
│   playgroundStore · authStore · useHistoryStore                     │
│  Service layer: mockService.js  (axios, baseURL '/api')             │
└──────────────────────────────┬──────────────────────────────────────┘
                               │  HTTP (x-mockflow-session header)
┌──────────────────────────────▼──────────────────────────────────────┐
│  Node.js + Express (ESM)  — server.js                                │
│  Middleware chain (see §4)                                           │
│  Routes: auth · generate · endpoints · mock · traffic · docs        │
│  Services: MockResolver · SessionStore · DataGenerator              │
│  External: Google Gemini (optional; local fallbacks on failure)     │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 2. Frontend Design

### 2.1 Application shell (`App.jsx`)

Composition order: `ReactLenis(root)` → `BrowserRouter` → `SessionRehydrator` + `AuthModal` +
`ErrorBoundary` wrapping `Routes`. Lenis (v1.3.11) provides inertial smooth scrolling; the
`ErrorBoundary` guarantees a render failure degrades to a recoverable, view-only fallback
rather than a blank page.

### 2.2 Playground component hierarchy

`SandboxStudio.jsx` is the 4-tab shell:

| Tab       | Emoji | Accent   | Content            |
|-----------|-------|----------|--------------------|
| Workbench | 🚀    | indigo   | Prompt + runner    |
| Monitor   | 📡    | emerald  | Traffic inspector  |
| Tests     | 🧪    | sky      | Test runner        |
| Lab       | 📦    | purple   | Lambda transform   |

Supporting components under `components/playground/`: `PromptPanel`, `EndpointPreview`,
`SchemaEditor`, `ModifySchemaBar`, `RequestRunner`, `TestRunner`, `SdkGenerator`,
`ExportDropdown`, `ShareDocs`, `ShareDocsButton`, `MockHistorySidebar`, `PurgeWorkspace`,
`SavePromptBanner`.

### 2.3 Fixed-height panel hierarchy + `flex-shrink-0` swipe tabs

The sub-tab navigation bar is the key responsive element. Its container uses:

```
flex items-center gap-2 overflow-x-auto whitespace-nowrap scrollbar-none pb-1 w-full max-w-full
```

Each individual tab button carries `flex flex-shrink-0`. This combination guarantees:

- The four tabs stay on a **single horizontal row**.
- On narrow viewports (down to **320px**) the row becomes **horizontally swipeable**
  (`overflow-x-auto`) instead of squishing or clipping the trailing "Lab" tab.
- `scrollbar-none` hides the scrollbar chrome while preserving scroll.
- Tabs **never auto-switch**; switching is user-driven only. Monitor carries an unseen-count
  badge and Tests carries an unseen dot badge.

Content panels use bounded heights (e.g. the endpoint list is `max-h-[38vh]` with truncated,
`whitespace-nowrap` URLs) so long lists scroll internally rather than pushing the layout.

### 2.4 Zustand store design (3 stores)

| Store             | Persist key        | Responsibility |
|-------------------|--------------------|----------------|
| `playgroundStore` | `mf_playground`    | Active workspace: sessionId, prompt, schema, endpoints, requestLog, runner config, authSim, testSuite, edit state. |
| `authStore`       | `mf_auth`          | `user`, `accessToken`, `isAuthenticated`, `sandboxApiKey`, `savedCollections`. |
| `useHistoryStore` | `mf_mock_history`  | Up to 5 saved workspace snapshots for the switcher. |

Key `playgroundStore` actions: `generate`, `editSchema` / `undoSchemaEdit` /
`clearEditFeedback`, `fireFetch` (injects region + auth + custom headers), `switchWorkspace`,
region/lambda/auth setters, `loadAuthSim` / `setAuthEnabled` / `regenerateAuthKey`,
`generateTestSuite` / `runTestSuite(onlyFailed)`, `runLambdaTransform`, and `purgeWorkspace`.

**`purgeWorkspace` design (state-isolation contract):** it clears only the active-workspace
keys (`STORAGE_KEYS = ['mf_playground', 'mf_session_id']`) and calls `clearRegressionLog()`.
It **explicitly preserves** `mf_auth` (the user stays signed in) and `mf_mock_history` (saved
workspaces remain in the switcher). This is a deliberate design decision, not incidental.

### 2.5 Service layer (`mockService.js`)

Axios instance with `baseURL '/api'`, 20s timeout. Interceptors attach/capture the
`x-mockflow-session` header so the client and server agree on the tenant. `runRequest` is
designed to **never throw** — failures resolve to a structured result the UI can render.

---

## 3. Client-Side Sandboxed Lambda (no-RCE design)

The Lambda transformer is the most security-sensitive surface. Design constraints:

1. **Browser-only execution.** The transform runs via `new Function(...)` inside the browser
   tab. The server has no endpoint that evaluates user JavaScript — there is no server-side
   `eval`, `vm`, or `child_process` path for transforms. This removes the RCE vector entirely
   from the backend.
2. **Deep-clone isolation.** The response object is deep-cloned before being passed in, so a
   transform cannot mutate live application state by reference.
3. **Serializable-output guard.** The transform's return value is validated to be
   JSON-serializable; non-serializable output is rejected.
4. **Fail-safe.** A throwing transform is caught; it surfaces an error in the Lab UI and does
   not crash the app. Execution is gated behind `lambdaEnabled`.

> This is browser-sandbox isolation, not a hardened multi-tenant sandbox. It protects the
> server and app state; it is not a substitute for a VM-level jail for untrusted third-party
> code.

---

## 4. Backend Design

### 4.1 Express middleware chain (`server.js`, in order)

```
helmet()
  → cors({ whitelist from CLIENT_ORIGIN|CORS_ORIGIN, allow origin-less })
  → express.json()
  → express.urlencoded({ extended: true })
  → morgan('dev')                 // non-production only
  → guestSessionMiddleware        // assigns/normalizes session id
  → GET /health
  → /api/auth · /api/generate · /api/endpoints · /api/mock · /api/traffic · /api/docs
  → notFoundHandler
  → errorHandler
```

`PORT` defaults to `5000`. `guestSessionMiddleware` sets
`req.sessionId = String(existingSession).trim().toLowerCase()` — the case-normalization that
keeps auth and mock lookup keys aligned (Requirements R11).

### 4.2 Route responsibilities

| Mount             | Purpose |
|-------------------|---------|
| `/api/auth`       | Guest/user auth surface. |
| `/api/generate`   | `POST /` (prompt → schema + endpoints, rate-limited 10/min); `POST /edit` (NL schema edit); `POST /auth` (`get\|enable\|disable\|regenerate`); `POST /tests` (AI test suite). |
| `/api/endpoints`  | Endpoint CRUD/inspection for the session. |
| `/api/mock`       | Wildcard `:/sessionId/:endpointSlug` (all verbs) — the served mock API. |
| `/api/traffic`    | `GET /:sessionId` traffic history. |
| `/api/docs`       | `GET /:sessionId` public docs (no auth). |

### 4.3 Mock request pipeline (`routes/mock.js`)

Ordered stages for every `/api/mock/:sessionId/:endpointSlug` request:

1. Validate session (`validateSessionId` lowercases UUID).
2. Validate slug.
3. Traffic recorder (`res.on('finish')`; skips `x-mockflow-stress: 1` hits).
4. Resolve definition (`404` if null).
5. **Auth gate** — when `authConfig.enabled` and credentials missing/wrong Bearer/`x-api-key`:
   `401 { error: 'Unauthorized', message: 'Missing or invalid API key' }`.
6. **Error simulator** — `x-mockflow-force-status` forces a status.
7. **Schema validation** — POST/PUT/PATCH bodies validated → `422` on failure.
8. **Region latency** — `x-mockflow-region` delays response per `lib/regions.js`.
9. **Collection engine** — GET seeds, POST appends, DELETE by `?id`/`body.id` with first-item
   fallback (no id → deletes first → `204`; empty → `404 COLLECTION_EMPTY`; bad id → `404`).

### 4.4 Services

- **`SessionStore.js`** — `Map<sessionId, { endpoints: Map<slug:METHOD>, collections: Map,
  traffic: [], meta, auth, createdAt, lastAccessedAt }>`, 60-min TTL. Provides
  `setEndpoint`/`getEndpoint`/`getAllEndpoints`/`clearEndpoints`, `setMeta`/`getMeta`,
  `getAuth`/`setAuthEnabled`/`regenerateAuth` (apiKey `mf_live_` + 32 hex, JWT-style token),
  `recordTraffic` (excludes stress hits), and collection ops
  (`seedCollection`/`appendToCollection`/`deleteFromCollection`).
- **`DataGenerator.js`** — `generateValue(schema, key, depth)`, `generateResponse`, and
  `validateAgainstSchema` (validates present + known fields only → `422`; **missing fields are
  not enforced** — an intentional leniency).
- **`MockResolver.js`** — Gemini model wrapper (`getModel()` requires `GEMINI_API_KEY`,
  `responseMimeType: application/json`), system prompts for generate/edit/testgen,
  `safeParseJSON` (strips code fences / think tags / trailing commas / smart quotes),
  `safeStringify`, `buildLocalFallback` (offline generation), the local schema refiner
  (`localSchemaRefine` + `matchModelKey` + `soleResource`, used on 429), `registerEditResult`,
  `generateTests` + `computeExpected` + `buildLocalTestIntents`, and `editSchema` (AI with
  local fallback via `tryLocalFallback`).

### 4.5 AI-with-fallback pattern

Every AI path shares one shape: **try Gemini → on failure/429, run a deterministic local
engine → always return a usable `200`.** This is what lets the product remain functional when
`GEMINI_API_KEY` is absent or quota-limited (Requirements C-1). Local output is intentionally
simpler than AI output.

---

## 5. Cross-Cutting Design Notes

- **Stress vs. real traffic separation.** The `x-mockflow-stress: 1` header is the single
  source of truth that keeps synthetic load out of the traffic inspector, at both the recorder
  (server) and the inspector (client) layers.
- **Regression + stress eventing.** `StressTester` dispatches `mockflow:stressrun`;
  `RegressionLog` persists to `mockflow.regressionLog.v1` and clears via
  `mockflow:regressionclear`. `purgeWorkspace` triggers the clear.
- **Docs regenerate on view.** The public docs route reads current session schema/endpoints at
  request time, so shared docs always reflect the latest state.
- **Responsive dropdown alignment.** Floating panels (e.g. `ExportDropdown`) use
  `absolute right-0 left-auto origin-top-right w-[88vw] max-w-sm sm:w-72` to align to the
  viewport's right edge on mobile and avoid horizontal clipping.
