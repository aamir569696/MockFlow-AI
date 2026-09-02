# MockFlow AI — Requirements Blueprint

> Strategy: **Playground-First User Journey**
> Goal: Maximum hackathon impact through instant value delivery, zero-friction onboarding, and deferred authentication.

---

## 1. Product Vision

MockFlow AI lets developers generate realistic, schema-aware mock REST APIs in seconds. The core differentiator is the **guest-first playground**: no sign-up wall, no setup overhead. Users arrive, describe an API, and receive live mock endpoints instantly. Authentication gates only the persistence layer (saving, versioning, sharing).

---

## 2. User Journey Map

```
[Landing Page]
      │
      ▼
[Playground (Guest)] ──► Generate Mock API ──► Live Preview / Try Endpoint
      │                                               │
      │                          ┌────────────────────┘
      │                          ▼
      │               [Save Endpoint? → Auth Gate]
      │                          │
      │               ┌──────────┴──────────┐
      │               ▼                     ▼
      │         [Sign Up / Login]     [Continue as Guest]
      │               │                (session only, no save)
      │               ▼
      │         [Dashboard — Saved Collections]
      │               │
      └───────────────┘
```

**Key invariant:** No route that only reads/generates data requires authentication. Auth is enforced exclusively on write/persist operations.

---

## 3. High-Level Architecture

### 3.1 Stack

| Layer       | Technology                          |
|-------------|-------------------------------------|
| Frontend    | React 18 (Vite), Tailwind CSS       |
| Backend     | Node.js + Express.js                |
| AI Layer    | OpenAI API (or compatible)          |
| Database    | MongoDB (via Mongoose)              |
| Auth        | JWT (Access + Refresh token pair)   |
| Session     | In-memory guest session (UUID)      |

### 3.2 Monorepo Layout

```
mockflow-ai/
├── .kiro/
│   ├── requirements.md          ← this file
│   ├── steering/
│   │   └── project-standards.md
│   └── hooks/
├── client/                      ← React frontend (Vite)
│   ├── public/
│   └── src/
│       ├── app/
│       ├── components/
│       │   ├── playground/
│       │   ├── editor/
│       │   └── auth/
│       ├── hooks/
│       ├── store/
│       ├── services/
│       └── utils/
└── server/                      ← Express.js backend
    ├── src/
    │   ├── routes/
    │   ├── controllers/
    │   ├── middleware/
    │   ├── models/
    │   ├── services/
    │   └── utils/
    └── tests/
```

---

## 4. Express.js Dynamic Route Handler — Structural Requirements

### 4.1 Purpose

The dynamic route handler is the core engine of MockFlow AI. It must serve **any HTTP verb + path combination** that a user has generated, returning the AI-produced mock response, without requiring pre-registration of routes at server start.

### 4.2 Required Route Segments

```
/api/mock/:sessionId/:endpointSlug    (GET, POST, PUT, PATCH, DELETE)
/api/generate                         (POST — AI generation, guest-accessible)
/api/endpoints                        (GET — list, auth required)
/api/endpoints                        (POST — save, auth required)
/api/endpoints/:id                    (GET | PUT | DELETE — manage saved, auth required)
/api/auth/register                    (POST)
/api/auth/login                       (POST)
/api/auth/refresh                     (POST)
/api/auth/logout                      (POST, auth required)
```

### 4.3 Dynamic Mock Resolver — Structural Contract

The Express catch-all / dynamic handler must satisfy the following structural contract:

**Inputs it must accept:**
- HTTP method (any of: GET, POST, PUT, PATCH, DELETE)
- URL path including path parameters (e.g., `/api/mock/:sessionId/users/:id`)
- Query string parameters
- Request body (JSON)
- Optional `x-mockflow-session` header for guest session identification

**Resolution steps (ordered):**
1. Extract `sessionId` and `endpointSlug` from the URL
2. Look up the mock definition from the in-memory session store (guest) or database (authenticated user)
3. If not found → 404 with structured error
4. Evaluate any response rules (status code, delay, schema)
5. Apply optional latency simulation (configurable ms delay)
6. Return the mock JSON response with correct Content-Type and status

**Structural modules required:**
- `MockResolver` service — lookup + response assembly
- `SessionStore` — ephemeral key-value map for guest mocks (keyed by `sessionId`)
- `RouteRegistry` — maps `(sessionId, slug, method)` → mock definition
- `LatencySimulator` — wraps response in a configurable delay
- `SchemaValidator` — validates generated schema before storage

### 4.4 Middleware Stack Order

```
Request
  │
  ├─ cors()
  ├─ helmet()
  ├─ express.json()
  ├─ requestLogger
  ├─ guestSessionMiddleware    ← assigns UUID if no session header present
  ├─ [route-specific] authMiddleware  ← applied only on protected routes
  ├─ rateLimiter               ← per-IP + per-session
  └─ Route Handler
        │
        └─ errorHandler (global, last middleware)
```

### 4.5 Guest Session Lifecycle

- On first request with no `x-mockflow-session` header: server assigns a UUID v4 session ID, returned in the response header.
- Guest session data lives in `SessionStore` (in-memory Map or Redis).
- Guest sessions expire after 60 minutes of inactivity.
- On authentication, guest session data can be migrated to the user's account (merge strategy: append non-conflicting slugs).

---

## 5. React Playground Workspace — Structural Requirements

### 5.1 Purpose

The Playground is the zero-friction entry surface. It must load instantly, allow API definition and generation without login, and present results in a developer-friendly format.

### 5.2 Top-Level Component Tree

```
<App>
 └── <Router>
      ├── <LandingPage />
      ├── <PlaygroundLayout />          ← primary surface, guest-accessible
      │    ├── <PromptPanel />          ← natural language input
      │    ├── <SchemaEditor />         ← editable JSON schema (Monaco / CodeMirror)
      │    ├── <EndpointPreview />      ← generated endpoints list
      │    ├── <RequestRunner />        ← try-it-now panel (like Swagger UI)
      │    └── <SavePromptBanner />     ← non-intrusive CTA to save / sign up
      ├── <AuthModal />                 ← overlay, not a page redirect
      ├── <Dashboard />                 ← auth-gated, saved collections
      │    ├── <CollectionList />
      │    └── <EndpointDetail />
      └── <NotFound />
```

### 5.3 State Management Structure

State is divided into two slices:

**`playgroundSlice` (Zustand or Redux Toolkit)**
```
{
  sessionId: string | null,
  prompt: string,
  generatedSchema: object | null,
  endpoints: Endpoint[],
  activeEndpoint: Endpoint | null,
  isGenerating: boolean,
  requestRunnerState: {
    method: string,
    url: string,
    body: string,
    response: object | null,
    status: number | null,
    latency: number | null
  }
}
```

**`authSlice`**
```
{
  user: User | null,
  accessToken: string | null,
  isAuthenticated: boolean,
  isAuthModalOpen: boolean,
  authTrigger: 'save' | 'share' | 'manual' | null
}
```

### 5.4 Key Interaction Flows

**Flow A — Guest Generation:**
1. User types prompt in `<PromptPanel />`
2. `POST /api/generate` fires with prompt payload (no auth header)
3. Response contains `{ sessionId, endpoints[], schema }`
4. State updates: `playgroundSlice.endpoints`, `playgroundSlice.generatedSchema`
5. `<EndpointPreview />` renders the live mock URLs
6. User can immediately hit endpoints via `<RequestRunner />`

**Flow B — Save Trigger (Auth Gate):**
1. User clicks "Save" in `<SavePromptBanner />` or `<EndpointPreview />`
2. `authSlice.isAuthModalOpen = true`, `authSlice.authTrigger = 'save'`
3. `<AuthModal />` renders as overlay
4. On successful auth: `POST /api/endpoints` fires with endpoint payload + JWT
5. On dismiss: state resets, user stays in guest playground

**Flow C — Returning Authenticated User:**
1. JWT present in localStorage on load
2. `GET /api/endpoints` hydrates `<CollectionList />`
3. Playground still accessible; saved endpoints load from DB instead of session store

### 5.5 Component Responsibilities

| Component            | Responsibility                                                      |
|----------------------|---------------------------------------------------------------------|
| `PromptPanel`        | Controlled input, submit handler, loading state                    |
| `SchemaEditor`       | Renders/edits JSON schema; syncs with `generatedSchema` state      |
| `EndpointPreview`    | Lists generated endpoints; renders copy-URL + Try-it buttons       |
| `RequestRunner`      | HTTP client UI: method selector, URL, body, response display       |
| `SavePromptBanner`   | Sticky non-blocking CTA; triggers auth modal on interaction        |
| `AuthModal`          | Login/Register form as overlay; handles token storage on success   |
| `Dashboard`          | Protected route; lists saved collections, links to EndpointDetail  |

### 5.6 API Service Layer (client/src/services/)

```
mockService.ts
  ├── generateMock(prompt: string): Promise<GenerateResponse>
  ├── runRequest(endpoint: Endpoint, options: RunOptions): Promise<RunResult>
  └── getSessionId(): string  (reads/writes localStorage)

endpointService.ts
  ├── saveEndpoint(endpoint: Endpoint, token: string): Promise<SavedEndpoint>
  ├── listEndpoints(token: string): Promise<SavedEndpoint[]>
  └── deleteEndpoint(id: string, token: string): Promise<void>

authService.ts
  ├── login(credentials): Promise<AuthResponse>
  ├── register(credentials): Promise<AuthResponse>
  ├── refreshToken(): Promise<string>
  └── logout(token: string): Promise<void>
```

---

## 6. Authentication & Authorization Rules

| Operation                     | Auth Required | Notes                              |
|-------------------------------|---------------|------------------------------------|
| Generate mock (AI)            | No            | Guest session UUID assigned        |
| Hit a mock endpoint           | No            | Resolved from session or DB        |
| Save endpoint permanently     | Yes           | JWT required, triggers auth modal  |
| List saved endpoints          | Yes           | Returns only user's own endpoints  |
| Update/Delete saved endpoint  | Yes           | Ownership check enforced           |
| Migrate guest session         | Yes           | On login/register after generation |

---

## 7. Non-Functional Requirements

- **Time-to-first-mock:** < 5 seconds from prompt submission to live endpoint
- **Cold load:** Playground UI interactive within 2 seconds
- **Session persistence:** Guest session survives page refresh (stored in localStorage)
- **Rate limiting:** 10 generate requests / minute per IP (guest), 60 / minute (authenticated)
- **Error surfaces:** All API errors return `{ error: { code, message, details } }` — no raw stack traces in production
- **CORS:** Strict origin whitelist; credentials mode enabled for auth routes only

---

## 8. Implementation Phases

| Phase | Scope                                                      | Deliverable                        |
|-------|------------------------------------------------------------|------------------------------------|
| 1     | Project scaffold, Express boilerplate, guest session MW    | Running server with health check   |
| 2     | AI generation endpoint + SessionStore + RouteRegistry      | Guest mock generation working      |
| 3     | React Playground UI — PromptPanel + EndpointPreview        | Frontend generation flow complete  |
| 4     | RequestRunner (try-it panel) + SchemaEditor                | Full guest experience complete     |
| 5     | Auth (JWT), save endpoint, Dashboard                       | Authenticated persistence working  |
| 6     | Polish — latency sim, error states, rate limiting, deploy  | Hackathon submission ready         |

---

*Blueprint version: 1.0 | Created: 2026-09-02 | Status: Approved for implementation*
