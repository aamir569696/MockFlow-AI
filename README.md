<div align="center">

# ⚡ MockFlow AI

# Autonomous API Sandbox Grid

*Generate production-ready mock REST APIs from plain English in seconds.*

**Describe → Generate → Test → Export**

[🔗 mock-flow-ai.vercel.app](#) · [🎥 Demo Video](#) · [📖 Documentation](#-how-it-works)

</div>

---

# 🎯 Problem

Building a mock API usually requires manually creating resources, routes, schemas, test data, and a mock server. This slows down frontend development, API testing, rapid prototyping, and hackathon development.

# 💡 Solution

MockFlow AI lets developers describe an API in plain English and automatically generates structured resources, endpoints, schemas, and realistic mock data — instantly testable, editable, and exportable.

It combines **AI generation with a local fallback engine**, so the application keeps working even when AI generation is unavailable or rate-limited.

---
# 🚀 How It Works

```text
Plain-English Prompt
        ↓
AI / Local Fallback Engine
        ↓
Structured API Schema
        ↓
Live Mock Endpoints
        ↓
HTTP Playground (Test, Edit, Simulate Auth)
        ↓
Postman / SDK / Public Docs Export
```

**Example generated routes:**

```http
GET  /api/mock/:sessionId/products
POST /api/mock/:sessionId/products
GET  /api/mock/:sessionId/orders
PUT  /api/mock/:sessionId/orders-update
```

---

# ✨ Key Features



 🤖 AI API Generation | Generate full REST APIs from natural-language descriptions 

  🧠 Smart Mock Data | Realistic data via semantic field inference and JSON Schema types 

 🔄 Iterative NL Refinement | Modify a live API conversationally — *"add a discount field to Product"* 

 🧪 HTTP Playground | Fire live requests and inspect responses, headers, latency, and status inline 

 🔐 Auth Simulator | Toggleable authentication — invalid/missing tokens return real 401 responses 

 🤖 AI QA Test Suite | Auto-generates and runs test cases against live endpoints with pass/fail reporting 

 🚀 Stress Laboratory | Concurrent batch load-testing (50–200 requests) with latency & stability benchmarks 

 📡 Telemetry Dashboard | Tracks generation speed, request volume, and endpoint health in real time 

 🌍 Global Region Gateway | Simulated cloud latency across regions (us-east-1, eu-central-1) 

 📖 Shareable Public Docs | One-click, login-free documentation page for any generated API 

📦 Developer Exports | Postman v2.1 collections + client SDK snippets in 10 languages 

 🔀 Payload Deep Merge | Merges generated mock data with incoming request bodies 

 🔄 Local Fallback Engine | Deterministic regex-based generation/editing when AI quota is exhausted 

  💾 Persistent Sessions | Playground state survives refreshes via LocalStorage 

 📂 Workspace Switcher | Manage multiple generated API projects in one session 

 🛡️ Security Layer | Helmet, CORS, rate limiting, UUID validation, session isolation 

 📱 Responsive UI | Fully usable on desktop and mobile 

---

## ⭐ Technical Highlights

### AI + Fallback Architecture

```text
Natural Language Modification
              │
              ▼
   POST /api/generate/edit
              │
   ┌──────────┴──────────┐
   ▼                     ▼
Live AI Mode      Fallback Mode (on 429 / quota limit)
Gemini Refiner    Local Deterministic Regex Engine
   │                     │
   └──────────┬──────────┘
              ▼
   Case-Insensitive Schema Key Resolver
   (handles plural/casing variations)
              │
              ▼
   Schema Mutation + Endpoint Sync
              │
              ▼
   Live Telemetry & UI Update
```

The local fallback engine uses regex-based noun extraction, a field vocabulary of 40+ definitions, and 30 resource templates — giving the app a zero-cost, always-available generation path even without an AI provider.

### Request Processing Pipeline

```text
Incoming Request
      ↓
UUID + Session Validation
      ↓
Mock Resolver
      ↓
Data Generator
      ↓
Deep Merge (Request Body)
      ↓
Response + Header Echo
```

---

## 🧰 Tech Stack

| Technology | Version | Purpose |
|---|---:|---|
| React | 18.3 | Frontend UI |
| Express.js | 4.19 | REST API & routing |
| Zustand | 4.5 | State management |
| Gemini | 2.5 Flash | AI-powered generation & editing |
| Tailwind CSS | — | UI styling |
| Vite | — | Frontend build tooling |
| Node.js | — | Backend runtime |

> **No Gemini API key?** The local fallback engine keeps the app fully functional offline.

---

## 📊 Project Stats

| Frontend | Backend |
|---|---|
| 22 source files | 14 source files |
| 18 React components | 15 route handlers |
| 3 Zustand stores | 5 middleware layers |
| 336 KB production bundle | 30 resource templates |
| 58 KB CSS bundle | 40 field definitions |

---

🏗️ System Architecture

MockFlow AI follows a clean client-server separation: a React SPA (Landing, Playground, Dashboard, Docs pages) talks to an Express REST backend, which either calls the Gemini AI provider or falls back to a local deterministic engine for generation and editing.


                        ┌─────────────────────────┐
                        │        Frontend         │
                        │  React + Zustand + Vite │
                        │ Landing · Playground ·  │
                        │  Dashboard · Docs Pages │
                        └────────────┬────────────┘
                                     │ REST (fetch)
                                     ▼
                        ┌─────────────────────────┐
                        │        Backend          │
                        │  Express + Middleware   │
                        └────────────┬────────────┘
                                     │
                 ┌───────────────────┼───────────────────┐
                 ▼                   ▼                   ▼
          routes/generate.js   routes/mock.js       routes/auth.js
          routes/endpoints.js  MockResolver.js      routes/docs.js
          routes/traffic.js    DataGenerator.js     SessionStore.js
                 │                   │                   │
                 ▼                   ▼                   ▼
          Gemini API /        Session-Scoped        Auth Middleware
          Local Fallback      Mock Data Store        (401 Gate)




## 🚀 Run Locally

### Backend

```bash
git clone https://github.com/<you>/mockflow-ai.git
cd mockflow-ai/backend
cp .env.example .env
npm install
npm run dev
```

### Frontend

```bash
cd ../frontend
npm install
npm run dev
```

---

## 🌐 Deployment

| Platform | Purpose |
|---|---|
| GitHub | Source repository |
| Vercel | Frontend deployment |
| Render | Backend deployment |

**Environment variables:**

```text
GEMINI_API_KEY
CLIENT_ORIGIN
VITE_API_BASE_URL
```

---

## 🏆 Hackathon Value

MockFlow AI reduces the gap between an **API idea and a working development environment** to seconds.

It lets developers prototype, test, secure, load-test, and document APIs — without writing or hosting a single line of backend code.

**Built for National Hackathon 2026.**

---


## 📜 License

MIT License

<div align="center">

### ⚡ MockFlow AI
*The fastest path from API idea to live endpoint.*

</div>