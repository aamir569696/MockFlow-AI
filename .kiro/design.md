# MockFlow AI — System Design Document

> Derived from: `requirements.md` + live codebase audit  
> Status: **Reflects current working implementation**  
> Last updated: 2026-09-02

---

## 1. Actual vs Planned Deviations

The following decisions were made during implementation that differ from the initial requirements blueprint:

| Area | Planned | Actual | Reason |
|------|---------|--------|--------|
| AI provider | OpenAI API | Google Gemini (`gemini-3.6-flash`) | Free tier, zero cost |
| Folder names | `client/` + `server/` | `frontend/` + `backend/` | Standard naming |
| Auth persistence | JWT + MongoDB | Simulated sandbox (mock token) | Credit conservation; Phase 5 deferred |
| RouteRegistry module | Separate module | Merged into `MockResolver` | Simpler, equivalent |
| LatencySimulator module | Separate module | Inline in `routes/mock.js` | Simpler, no benefit to extract |
| SchemaValidator module | Separate module | Inline in `MockResolver.buildLocalFallback` | Sufficient for current scope |

---

## 2. System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  BROWSER                                                        │
│                                                                 │
│  React 18 + Vite + Tailwind CSS                                 │
│  ┌──────────────┐  ┌──────────────────────────────────────────┐ │
│  │  Zustand     │  │  React Router v6                         │ │
│  │  playgroundStore │  /          → LandingPage               │ │
│  │  authStore   │  │  /playground → PlaygroundPage            │ │
│  └──────────────┘  │  /dashboard  → DashboardPage (auth-gated)│ │
│                    │  *           → NotFoundPage              │ │
│                    └──────────────────────────────────────────┘ │
│                                │                                │
│         axios (baseURL='/api') │ Vite dev proxy                │
└────────────────────────────────┼────────────────────────────────┘
                                 │ HTTP
┌────────────────────────────────▼────────────────────────────────┐
│  EXPRESS SERVER  (Node.js ESM, port 5000 / process.env.PORT)   │
│                                                                 │
│  Middleware stack (in order):                                   │
│    helmet() → cors() → express.json() → morgan (dev only)      │
│    → guestSessionMiddleware → [route] authMiddleware            │
│    → rateLimiter (generate route) → route handler              │
│    → notFoundHandler → errorHandler                             │
│                                                                 │
│  Routes:                                                        │
│    GET  /health                    → inline handler             │
│    POST /api/generate              → routes/generate.js         │
│    *    /api/mock/:sid/:slug        → routes/mock.js             │
│    *    /api/auth/*                → routes/auth.js (stubs)     │
│    *    /api/endpoints/*           → routes/endpoints.js (stubs)│
│                                                                 │
│  Services:                                                      │
│    MockResolver  → SessionStore                                 │
│                  → Gemini API (or local fallback)               │
│    DataGenerator → pure-Node fake data engine                   │
│    SessionStore  → in-memory Map, 60 min TTL, 15 min cleanup    │
│                                                                 │
│  Models (Mongoose — connected only when MONGO_URI set):         │
│    User, Endpoint                                               │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼ (optional)
┌─────────────────────────┐     ┌───────────────────────────────┐
│  MongoDB Atlas           │     │  Google Gemini API            │
│  (Phase 5 — not wired)   │     │  gemini-3.6-flash             │
│  User, Endpoint models   │     │  responseMimeType: JSON       │
│  saved endpoint persist  │     │  fallback: buildLocalFallback │
└─────────────────────────┘     └───────────────────────────────┘
```

---

## 3. Backend Route Map

All routes are mounted in `backend/server.js`.

### 3.1 Health

| Method | Path | Auth | Handler | Status |
|--------|------|------|---------|--------|
| GET | `/health` | None | Inline | ✅ Live |

### 3.2 AI Generation

| Method | Path | Auth | Rate Limit | Handler |
|--------|------|------|-----------|---------|
| POST | `/api/generate` | None (guest) | 10/min per IP | `routes/generate.js` |

**Request body:**
```json
{ "prompt": "string (1–1000 chars)" }
```

**Response:**
```json
{
  "sessionId": "uuid-v4",
  "apiName": "string",
  "description": "string",
  "schema": { "<ResourceName>": { "type": "object", "properties": {} } },
  "endpoints": [
    {
      "slug": "string",
      "method": "GET|POST|PUT|PATCH|DELETE",
      "description": "string",
      "isCollection": true,
      "path": "/api/mock/:sessionId/:slug",
      "_source": "ai|local"
    }
  ]
}
```

**Error codes:** `INVALID_PROMPT` (400) · `PROMPT_TOO_LONG` (400) · `RATE_LIMITED` (429) · `AI_GENERATION_FAILED` (502)

### 3.3 Dynamic Mock Handler

| Method | Path | Auth | Handler |
|--------|------|------|---------|
| GET/POST/PUT/PATCH/DELETE | `/api/mock/:sessionId/:endpointSlug` | None | `routes/mock.js` |

**Query overrides:**
- `?count=N` — force list of N items (max 50)
- `?status=N` — override HTTP status code (100–599)

**Request headers:**
- `x-mockflow-session` — guest session UUID
- `x-mockflow-delay` — latency simulation in ms (max 5000)

**Response headers set:**
- `X-MockFlow-Session`
- `X-MockFlow-Slug`
- `X-MockFlow-Generated: true`

### 3.4 Auth Routes (Stubs — Phase 5)

| Method | Path | Auth | Status |
|--------|------|------|--------|
| POST | `/api/auth/register` | None | 501 stub |
| POST | `/api/auth/login` | None | 501 stub |
| POST | `/api/auth/refresh` | None | 501 stub |
| POST | `/api/auth/logout` | Bearer JWT | 501 stub |

### 3.5 Endpoint Management Routes (Stubs — Phase 5)

| Method | Path | Auth | Status |
|--------|------|------|--------|
| GET | `/api/endpoints` | Bearer JWT | 501 stub |
| POST | `/api/endpoints` | Bearer JWT | 501 stub |
| GET | `/api/endpoints/:id` | Bearer JWT | 501 stub |
| PUT | `/api/endpoints/:id` | Bearer JWT | 501 stub |
| DELETE | `/api/endpoints/:id` | Bearer JWT | 501 stub |

---

## 4. Middleware Stack Detail

```
backend/middleware/
├── guestSession.js    Reads x-mockflow-session header; assigns UUID v4 if absent;
│                      echoes session ID in response header; sets req.sessionId
├── auth.js            Validates Bearer JWT; sets req.user; returns 401/TOKEN_INVALID
├── errorHandler.js    Global error handler; returns { error: { code, message, details } }
│                      Stack traces suppressed in production
└── notFoundHandler.js Catch-all 404; returns { error: { code: NOT_FOUND, message } }
```

---

## 5. Service Layer

### 5.1 MockResolver (`services/MockResolver.js`)

**Public methods:**

| Method | Signature | Description |
|--------|-----------|-------------|
| `generate` | `(sessionId: string, prompt: string) → Promise<Result>` | Two-tier: tries Gemini first, falls back to local engine |
| `resolve` | `(sessionId: string, slug: string) → Definition \| null` | Looks up a registered endpoint from SessionStore |

**AI generation pipeline:**
```
prompt
  │
  ▼
getModel() — lazy init of GoogleGenerativeAI client
  │           model: gemini-3.6-flash
  │           responseMimeType: application/json
  │           temperature: 0.4
  ▼
generateContent(SYSTEM_PROMPT + prompt)
  │
  ├─ success → safeParseJSON()
  │              strips markdown fences
  │              strips <think>…</think> blocks
  │              extracts first { … } object
  │
  ├─ parse error → local fallback
  ├─ empty endpoints → local fallback
  └─ any exception (503, 404, network) → local fallback
         │
         ▼ buildLocalFallback(prompt)
              extractResources(prompt) — regex noun tokeniser
              RESOURCE_FIELD_MAP[resource] — curated field sets (30 resources)
              FIELD_VOCAB[field] — JSON Schema definitions (40 fields)
              generates 5 endpoints per resource: list, create, by-id, update, delete
  │
  ▼
Register each endpoint in SessionStore
  │
  ▼
Return { apiName, description, schema, endpoints[], _source }
```

### 5.2 SessionStore (`services/SessionStore.js`)

In-memory `Map<sessionId, { endpoints: Map<slug, Definition>, createdAt, lastAccessedAt }>`.

| Method | Description |
|--------|-------------|
| `getOrCreate(sessionId)` | Returns or creates session entry; updates lastAccessedAt |
| `setEndpoint(sessionId, slug, definition)` | Stores a mock definition |
| `getEndpoint(sessionId, slug)` | Returns definition or null |
| `purgeExpired()` | Deletes sessions idle > 60 min; runs every 15 min via setInterval |

### 5.3 DataGenerator (`services/DataGenerator.js`)

Zero external dependencies. Generates fake data from a JSON Schema node.

| Function | Signature | Description |
|----------|-----------|-------------|
| `generateValue` | `(schema, key?, depth?) → any` | Recursively generates a value matching the schema |
| `generateResponse` | `(endpointDef, method, count?) → { status, body }` | Assembles a full HTTP response |

**Type coverage:** `string`, `number`, `integer`, `boolean`, `array`, `object`, `null`  
**Format coverage:** `date`, `date-time`, `email`, `uuid`, `uri`, `hostname`, `ipv4`, `phone`, `color`  
**Semantic inference:** key-name hints (e.g. field named `email` → fake email, `createdAt` → ISO timestamp)  
**Method semantics:** POST/PUT/PATCH → 201/200 + single object; DELETE → 204 no content; GET → collection or single based on `isCollection`

---

## 6. Frontend Architecture

### 6.1 Route Map (`frontend/src/App.jsx`)

| Path | Component | Auth Required | Notes |
|------|-----------|--------------|-------|
| `/` | `LandingPage` | No | Hero + features grid |
| `/playground` | `PlaygroundPage` | No | Primary surface |
| `/dashboard` | `DashboardPage` | Yes | Redirects to `/playground` if not authed |
| `*` | `NotFoundPage` | No | 404 |

`<AuthModal />` is rendered globally above all routes (overlay pattern).

### 6.2 Component Tree

```
<App>
 ├── <AuthModal />               Global overlay; save success screen
 └── <Routes>
      ├── / → <LandingPage />
      │         Hero, 3-step flow, feature cards
      │
      ├── /playground → <PlaygroundPage />
      │    ├── <NavBar />             Sticky glassmorphic; session pill; export button
      │    │
      │    ├── LEFT PANEL (42%)
      │    │   ├── <PromptPanel />    Textarea, example chips, char counter,
      │    │   │                      ⌘Enter, success/error banners, loading skeleton
      │    │   └── <SchemaEditor />   Collapsible JSON tree + raw toggle
      │    │
      │    ├── RIGHT PANEL (flex-1)
      │    │   ├── <EndpointPreview /> Method badges, active highlight, shimmer skeleton,
      │    │   │                        premium empty state, Clear Workspace button,
      │    │   │                        ExportDropdown (compact)
      │    │   └── <RequestRunner />  Method selector, URL bar, JsonBodyEditor
      │    │                          (live validation + Format), Fire Live Fetch Hit,
      │    │                          TelemetryDashboard (4 metric cards), response viewer
      │    │
      │    └── <SavePromptBanner />   Sticky bottom CTA; hidden when authed
      │
      ├── /dashboard → <DashboardPage />
      │    ├── NavBar               API key pill, user avatar
      │    ├── 4× MetricCard        SVG sparklines (request volume, avg latency, endpoints, success rate)
      │    ├── Collections sidebar  CollectionCard list
      │    ├── Endpoint tree grid   EndpointRow list for active collection
      │    └── Live network log     LogRow list from requestLog[]
      │
      └── * → <NotFoundPage />

Shared components:
  ├── <ExportDropdown />    Postman v2.1 + Schema SDK download; close on Escape/outside click
```

### 6.3 Zustand State — `playgroundStore`

```typescript
{
  // Session
  sessionId: string | null           // persisted in localStorage (key: mf_session_id)

  // Generation
  prompt: string
  apiName: string
  apiDescription: string
  generatedSchema: object | null
  endpoints: Endpoint[]
  isGenerating: boolean
  generateError: string | null

  // Request log (last 50 entries, newest first)
  requestLog: Array<{
    id: string
    ts: string                       // ISO-8601
    method: string
    slug: string
    status: number | null
    latency: number | null
    error: string | null
  }>

  // Active endpoint + runner
  activeEndpoint: Endpoint | null
  runner: {
    method: string
    url: string                      // relative to axios baseURL (/api), e.g. /mock/:sid/:slug
    body: string
    isFiring: boolean
    response: any | null
    status: number | null
    latency: number | null
    error: string | null
    responseHeaders: object | null
  }

  // Actions
  setPrompt(prompt)
  setGeneratedSchema(schema)
  setActiveEndpoint(endpoint)        // also resets runner state
  setRunnerMethod(method)
  setRunnerBody(body)
  clearRunner()                      // clears response/status/latency/error only
  clearWorkspace()                   // full reset; preserves sessionId
  generate(prompt)                   // async: POST /api/generate
  fireFetch()                        // async: fires live HTTP request; appends to requestLog
}
```

### 6.4 Zustand State — `authStore`

```typescript
{
  user: { id, email, displayName } | null
  accessToken: string | null
  isAuthenticated: boolean
  isAuthModalOpen: boolean
  authTrigger: 'save' | 'share' | 'manual' | null
  isSaveSuccess: boolean
  sandboxApiKey: string | null       // 'MF-9823-KIRO' after simulateSave

  // Saved collections (in-memory, populated by simulateSave)
  savedCollections: Array<{
    id: string
    savedAt: string                  // ISO-8601
    apiName: string
    apiDescription: string
    sessionId: string
    endpoints: Endpoint[]
    schema: object
    apiKey: string
  }>

  // Actions
  openAuthModal(trigger)
  closeAuthModal()
  setAuth(user, accessToken)         // Phase 5 — real JWT
  clearAuth()
  simulateSave({ apiName, apiDescription, sessionId, endpoints, schema })
                                     // instant mock save — no network
  dismissSaveSuccess()               // closes modal; sets isSaveSuccess=false
}
```

### 6.5 API Service Layer

```
frontend/src/services/
├── mockService.js
│     axios instance: baseURL = '/api'
│     Request interceptor:  attaches x-mockflow-session header
│     Response interceptor: captures x-mockflow-session header → localStorage
│     validateStatus: () => true  (never throws on non-2xx)
│
│     generateMock(prompt)         POST /api/generate
│     runRequest({ method, url }, { body? })
│                                  returns { status, response, latency, responseHeaders, error }
│     getSessionId()               localStorage.getItem('mf_session_id')
│     setSessionId(id)             localStorage.setItem('mf_session_id', id)
│
├── authService.js                 Stubs: login, register, refreshToken, logout
└── endpointService.js             Stubs: listEndpoints, saveEndpoint, deleteEndpoint
```

### 6.6 Vite Dev Proxy

```javascript
// frontend/vite.config.js
server: {
  port: 5173,
  proxy: {
    '/api': {
      target: 'http://localhost:5000',
      changeOrigin: true,
    }
  }
}
```

All `axios` calls use relative URLs (e.g. `/api/generate`) which Vite proxies to `http://localhost:5000/api/generate` in development. In production the `VITE_API_BASE_URL` env var is used to construct the absolute URL.

---

## 7. Export Engine

`ExportDropdown` component generates files client-side (no network call).

### 7.1 Postman Collection v2.1

- Schema: `https://schema.getpostman.com/json/collection/v2.1.0/collection.json`
- All endpoints as named items under a folder
- Per-request headers: `Content-Type: application/json` + `x-mockflow-session`
- Body auto-included for POST/PUT/PATCH
- Variable: `baseUrl = http://localhost:5000`
- Filename: `<api-name>-postman-collection.json`

### 7.2 Schema SDK

- `$schema: https://mockflow.ai/sdk/v1/schema`
- Full resource schema map
- All endpoints with URLs, headers, `isCollection`, example shapes
- Usage snippets: JavaScript fetch + curl
- Filename: `<api-name>-sdk.json`

---

## 8. Deployment Architecture

```
GitHub repo
  │
  ├── /frontend  ──► Vercel (free)
  │    vercel.json:
  │      buildCommand: npm run build → dist/
  │      rewrites: /* → /index.html   (SPA routing)
  │      headers: security + immutable asset cache
  │
  └── /backend   ──► Render (free tier)
       render.yaml:
         rootDir: backend
         buildCommand: npm install
         startCommand: npm start   (node server.js)
         healthCheckPath: /health
         PORT: injected by Render
         secrets: CLIENT_ORIGIN, GEMINI_API_KEY, JWT_SECRET, JWT_REFRESH_SECRET
```

**CORS configuration** (`server.js`):  
`CLIENT_ORIGIN` or `CORS_ORIGIN` env var accepts comma-separated origins.  
Requests with no `Origin` header (curl, Postman) are always allowed.

---

## 9. Data Flow — Full Guest Generation Sequence

```
User types prompt
     │
     ▼
PromptPanel.handleSubmit()
     │  calls playgroundStore.generate(prompt)
     ▼
mockService.generateMock(prompt)
     │  POST /api/generate  { prompt }
     │  header: x-mockflow-session (from localStorage or absent)
     ▼
Express: guestSessionMiddleware
     │  assigns/reads UUID → req.sessionId
     │  echoes x-mockflow-session in response header
     ▼
routes/generate.js → MockResolver.generate(sessionId, prompt)
     │
     ├─ Try Gemini gemini-3.6-flash
     │    SYSTEM_PROMPT + prompt → generateContent()
     │    safeParseJSON(rawText)
     │    validate endpoints array
     │
     └─ On any failure → buildLocalFallback(prompt)
          extractResources() → RESOURCE_FIELD_MAP → FIELD_VOCAB → schema
          5 endpoints per resource
     │
     ▼
SessionStore.setEndpoint(sessionId, slug, definition)  [for each endpoint]
     │
     ▼
Response: { sessionId, apiName, description, schema, endpoints[] }
     │
     ▼ mockService response interceptor
     │  saves x-mockflow-session → localStorage
     ▼
playgroundStore: set endpoints[], generatedSchema, apiName, apiDescription
     │
     ▼
React re-render:
  EndpointPreview → shows shimmer skeleton → then endpoint list (animate-slide-up)
  SchemaEditor   → shows JSON tree
  SavePromptBanner → appears at bottom
```

---

## 10. Data Flow — Live Mock Request Sequence

```
User clicks "Try →" on an endpoint
     │
     ▼
playgroundStore.setActiveEndpoint(ep)
     │  runner.url = /mock/:sessionId/:slug
     │  runner.method = ep.method
     ▼
RequestRunner renders method bar + JsonBodyEditor + Fire button
     │
User clicks "Fire Live Fetch Hit"
     │
     ▼
playgroundStore.fireFetch()
     │
mockService.runRequest({ method, url }, { body })
     │  axios.request → /api/mock/:sessionId/:slug
     │  validates status → true (never throws)
     ▼
routes/mock.js handleMock()
     │
     ├─ MockResolver.resolve(sessionId, slug) → definition from SessionStore
     ├─ latency delay (x-mockflow-delay header or definition.delayMs)
     ├─ DataGenerator.generateResponse(definition, method, count)
     │    generateValue(schema, key, depth)
     │    semantic key inference → realistic fake values
     └─ res.json(body) with X-MockFlow-* headers
     │
     ▼
runRequest returns { status, response, latency, responseHeaders, error }
     │
     ▼
playgroundStore: set runner.{response, status, latency, responseHeaders}
                 prepend to requestLog[]
     │
     ▼
RequestRunner renders TelemetryDashboard:
  StatusCard (200 OK, glow) · LatencyCard (Xms) · ContentTypeCard · PayloadSizeCard
  HighlightedJson response body viewer
```

---

*Design document version: 1.0 | Created: 2026-09-02 | Reflects codebase as of prompt 15/15*
