# MockFlow AI — Requirements

> **Document type:** Requirements specification
> **Status:** Reflects the current implemented codebase (verified against source).
> **Scope note:** This document describes what the system *actually does today*. Where a
> capability depends on an external service or degrades gracefully, that caveat is stated
> explicitly rather than glossed over.

---

## 1. Overview

MockFlow AI is a full-stack sandbox for generating, serving, and exercising mock REST APIs.
A user describes an API in natural language; the system produces a JSON schema plus a set of
endpoints, serves those endpoints from an in-memory session store, and provides tooling to
test, stress, document, and export them.

The application is split into:

- **Backend** — Node.js + Express (ESM), in-memory session state, Google Gemini for AI
  generation with deterministic local fallbacks.
- **Frontend** — React + Vite + Zustand, with `localStorage` persistence and Lenis smooth
  scrolling.

### 1.1 Global caveats (read first)

- **C-1 — AI features require a live key.** Natural-language generation, natural-language
  schema editing, and AI test-suite generation call Google Gemini and require
  `GEMINI_API_KEY` at runtime. When the key is missing or the quota is exhausted (HTTP 429),
  the system falls back to deterministic **local engines** rather than failing. Local output
  is functional but less rich than AI output.
- **C-2 — State is in-memory and ephemeral.** All session/endpoint/traffic state lives in a
  process-level `Map` with a 60-minute TTL. A server restart clears everything. There is no
  database.
- **C-3 — Dashboard metrics are session-global, not per-workspace.** Metric cards aggregate
  the current session's request log; they are not segmented per saved workspace.

---

## 2. Functional Requirements

### R1 — Dynamic Multi-Tenant AI Wildcard Router

**As a** developer, **I want** every generated endpoint to be served from a single wildcard
route keyed by session, **so that** many independent mock APIs can coexist without collisions.

**Acceptance criteria**

1. WHEN a request hits `/api/mock/:sessionId/:endpointSlug` (any HTTP verb) THE SYSTEM SHALL
   resolve the endpoint definition scoped to that `sessionId`.
2. The router SHALL treat each `sessionId` as an isolated tenant; endpoints under one session
   SHALL NOT be visible to another.
3. WHEN `sessionId` is a UUID, THE SYSTEM SHALL normalize it to lowercase before lookup so
   that case variations resolve to the same tenant.
4. WHEN no definition matches the `slug + method` pair, THE SYSTEM SHALL respond `404`.
5. The request pipeline SHALL execute in a fixed order: session validation → slug validation
   → traffic recording → definition resolution → auth gate → error simulation → schema
   validation → region latency → collection engine.

### R2 — Stateful In-Memory Session Store ("Memory Database Cache")

**As a** user, **I want** the mock API to remember data I create during a session, **so that**
GET/POST/DELETE behave like a real, stateful backend within that session.

**Acceptance criteria**

1. THE SYSTEM SHALL hold all state in an in-memory `Map<sessionId, sessionRecord>` where each
   record contains endpoints, collections, traffic, meta, auth, and timestamps.
2. Each session SHALL expire after **60 minutes** of inactivity (TTL), tracked via
   `lastAccessedAt`.
3. Collection behavior SHALL be: `GET` seeds/returns the collection, `POST` appends an item,
   `DELETE` removes by `?id`/`body.id` — with a first-item fallback when no id is supplied.
4. WHEN a `DELETE` targets an empty collection, THE SYSTEM SHALL respond `404` with
   `COLLECTION_EMPTY`; WHEN it targets a non-existent id, THE SYSTEM SHALL respond `404`.
5. **Caveat:** State does not persist across server restarts (see C-2).

### R3 — Parallel Concurrency Stress-Tester (25-per-wave batching)

**As a** user, **I want** to fire many concurrent requests against a mock endpoint, **so that**
I can observe throughput and latency behavior.

**Acceptance criteria**

1. THE SYSTEM SHALL offer selectable intensities of **50, 100, and 200** total requests.
2. Requests SHALL be dispatched in waves of **`BATCH_SIZE = 25`** using
   `Promise.allSettled`, so each wave resolves fully before results are tallied.
3. Every stress request SHALL carry the header `x-mockflow-stress: 1`.
4. Stress requests SHALL be **excluded** from the traffic inspector so synthetic load does not
   pollute real request history.
5. THE SYSTEM SHALL render a live "Stress Run Log" and dispatch a `mockflow:stressrun` event
   on completion.

### R4 — Global Edge-Region Latency Simulator

**As a** user, **I want** to simulate responses coming from different geographic regions,
**so that** I can preview latency behavior.

**Acceptance criteria**

1. THE SYSTEM SHALL support regions with fixed simulated latencies: `us-east-1` (280 ms),
   `eu-central-1` (110 ms), `ap-southeast-1` (45 ms), and `local` (0 ms).
2. WHEN a request carries `x-mockflow-region`, THE SYSTEM SHALL delay the response by that
   region's latency before returning.
3. Region selection SHALL be controllable from the request runner UI.

### R5 — Browser-Sandboxed JavaScript Lambda Transformer

**As a** user, **I want** to write a small JS transform that post-processes a mock response,
**so that** I can shape output without touching the server.

**Acceptance criteria**

1. Transforms SHALL execute **entirely in the browser** via `new Function`, never on the
   server (see Security Requirements SR-1).
2. THE SYSTEM SHALL deep-clone the response before handing it to the transform, and SHALL
   reject transform output that is not JSON-serializable.
3. Transform execution SHALL be toggleable (`lambdaEnabled`) and SHALL fail safe: a throwing
   or invalid transform SHALL NOT crash the app.

### R6 — Multi-Language Client SDK Generator

**As a** developer, **I want** ready-to-paste client code for a chosen endpoint, **so that** I
can integrate quickly.

**Acceptance criteria**

1. THE SYSTEM SHALL generate snippets for **10 runtimes**.
2. Generated snippets SHALL inject the active auth header when auth simulation is enabled.
3. THE SYSTEM SHALL also export a Postman v2.1 collection via the export dropdown.

### R7 — Workspace Switcher

**As a** returning user, **I want** to switch between previously generated APIs, **so that** I
can resume work.

**Acceptance criteria**

1. THE SYSTEM SHALL source switcher entries from the persisted history store
   (`mf_mock_history`, max **5** entries).
2. Selecting an entry SHALL rehydrate the playground via `switchWorkspace(entry)`.
3. Lookups SHALL be case-insensitive (see R11).
4. **Caveat:** Dashboard metric cards remain session-global, not per-workspace (see C-3).

### R8 — Natural-Language Schema Editing

**As a** user, **I want** to edit the generated schema in plain English, **so that** I can
refine it without hand-writing JSON.

**Acceptance criteria**

1. `POST /api/generate/edit` SHALL accept a natural-language instruction and return an updated
   schema plus an edit summary.
2. WHEN the AI call fails or is rate-limited, THE SYSTEM SHALL apply a **local regex refiner**
   supporting add / remove / rename / make-required operations, and still return `200`.
3. The UI SHALL support undo of the last edit (`undoSchemaEdit`).

### R9 — Auth Simulation

**As a** user, **I want** to toggle API-key/bearer auth on a mock, **so that** I can test
authenticated flows.

**Acceptance criteria**

1. `POST /api/generate/auth` SHALL accept `{ action: get | enable | disable | regenerate }`.
2. WHEN auth is enabled and a request is missing/invalid credentials, THE mock SHALL respond
   `401` with `{ error: 'Unauthorized', message: 'Missing or invalid API key' }`.
3. Regenerated keys SHALL follow the `mf_live_` + 32 hex format.

### R10 — Public Shareable Docs

**As a** user, **I want** a public docs page for my mock, **so that** I can share it.

**Acceptance criteria**

1. `GET /api/docs/:sessionId` SHALL return documentation for the session **without auth**.
2. Docs SHALL reflect the current schema/endpoints at view time.

### R11 — Case-Insensitive Session Lookup

**Acceptance criteria**

1. Guest session middleware SHALL normalize the session id to a trimmed, lowercased string.
2. This normalization SHALL keep the auth key and the mock lookup key aligned so
   authenticated requests do not fail on case mismatch.

### R12 — AI Test-Suite Generation

**Acceptance criteria**

1. `POST /api/generate/tests` SHALL produce a set of test cases with expected outcomes.
2. WHEN AI is unavailable, THE SYSTEM SHALL build **local test intents** deterministically.
3. The runner SHALL support running all cases or only previously failed ones.

---

## 3. Non-Functional Requirements

### R13 — Robust Error-Boundary Handling

1. A React class `ErrorBoundary` SHALL wrap the router so a render error shows a recoverable,
   view-only fallback instead of a white screen.
2. The backend SHALL terminate every request through `notFoundHandler` then `errorHandler`.
3. The frontend request service SHALL never throw from `runRequest`; failures return a
   structured result.

### R14 — Mobile Responsiveness

1. Core layouts SHALL remain usable down to **320px** viewport width.
2. The sub-tab navigation bar SHALL scroll horizontally (no clipped tabs) at 320px.
3. Floating dropdowns SHALL align to the viewport edge on small screens to avoid clipping.

---

## 4. Security Requirements

### SR-1 — No Remote Code Execution via Lambda transforms

1. User JavaScript transforms SHALL run only in the browser sandbox; the server SHALL NOT
   `eval` or otherwise execute user-supplied code.
2. The sandbox SHALL operate on a deep-cloned copy and enforce a JSON-serializable output
   guard.

### SR-2 — Transport & headers

1. The backend SHALL apply `helmet` and a CORS origin whitelist (`CLIENT_ORIGIN` /
   `CORS_ORIGIN`, comma-separated), while allowing origin-less requests (curl, health checks).

### SR-3 — Secret handling

1. `GEMINI_API_KEY` SHALL be read from the environment and never surfaced to the client.
