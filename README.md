# ⚡ MockFlow AI

# Autonomous API Sandbox Grid

*Generate production-ready mock REST APIs from plain English in seconds.*

MockFlow AI turns a natural-language API idea into a *live, testable mock REST API*—with realistic data, an interactive HTTP playground, and exportable API definitions.

> *Describe → Generate → Test → Export*

-

# 🎯 Problem

Building a mock API usually requires manually creating resources, routes, schemas, test data, and a mock server. This slows down *frontend development, API testing, rapid prototyping, and hackathon development*.

# 💡 Solution

MockFlow AI lets developers describe an API in plain English and automatically generates structured resources, endpoints, schemas, and realistic mock data.

It combines *AI generation with a local fallback engine*, so the application can continue working even when AI generation is unavailable.

-

# 🚀 How It Works

`text
Plain-English Prompt
        ↓
AI / Local Fallback
        ↓
Structured API Schema
        ↓
Live Mock Endpoints
        ↓
HTTP Playground
        ↓
Postman / Schema Export
`

Example generated routes:

`http
GET  /api/mock/:sessionId/products
POST /api/mock/:sessionId/products
GET  /api/mock/:sessionId/orders
PUT  /api/mock/:sessionId/orders-update
`

-

# ✨ Key Features

 🤖 *AI API Generation* — Generate APIs from natural-language descriptions.
 🧠 *Smart Mock Data* — Realistic data using semantic field inference and JSON Schema types.
 🧪 *HTTP Playground* — Send live requests and inspect responses, headers, latency, and status.
 🔀 *Payload `deepMerge`* — Merge generated data with incoming request bodies.
 🌐 *CORS Gateway* — Centralized cross-origin API handling.
 💾 *Persistent State* — Playground state survives browser refreshes through LocalStorage.
 🔄 *Local Fallback Engine* — Continue generating APIs without Gemini.
 📦 *Developer Exports* — Export Postman v2.1 collections and Schema SDK JSON.
 🔐 *Security* — Helmet, CORS, rate limiting, UUID validation, and session isolation.
 📱 *Responsive UI* — Designed for desktop and mobile use.

-

# ⭐ Technical Highlights

# AI + Fallback Architecture

`text
              API Description
                    │
                    ▼
             Generation Layer
              ┌─────┴─────┐
              ▼           ▼
           Gemini      Local Engine
              │           │
              └─────┬─────┘
                    ▼
             Structured API
                    ↓
           Live Endpoints
`

The local engine uses *regex-based noun extraction, `FIELD_VOCAB`, 30 resource templates, and 40 field definitions* to provide a zero-cost fallback generation path.

# Request Processing

`text
Request
  ↓
UUID + Slug Validation
  ↓
MockResolver
  ↓
DataGenerator
  ↓
deepMerge(Request Body)
  ↓
Response + Custom Header Echo
`

-

# 🗺️ Architecture

`text
┌─────────────────────────────────────────────────────────┐
│                     FRONTEND                            │
│  React 18 · Zustand · Tailwind CSS · Vite              │
│                                                         │
│  PromptPanel → EndpointPreview → RequestRunner         │
│                         ↓                               │
│                 TelemetryDashboard                      │
└───────────────────────┬─────────────────────────────────┘
                        │ axios /api/*
                        ▼
┌─────────────────────────────────────────────────────────┐
│                     EXPRESS SERVER                     │
│                                                         │
│  Helmet → CORS → JSON → Morgan → Rate Limiter          │
│                        ↓                                │
│              POST /api/generate                        │
│                   ┌────┴────┐                          │
│                   ▼         ▼                          │
│                Gemini    Fallback                      │
│                   └────┬────┘                          │
│                        ▼                               │
│                  SessionStore                          │
│                        ↓                               │
│             /api/mock/:sessionId/:slug                │
│                        ↓                               │
│              Mock Resolver + Generator                 │
└─────────────────────────────────────────────────────────┘
`

-

# 🧰 Tech Stack

| Technology   |   Version | Purpose            |
| ------------ | --------: | ------------------ |
| React        |      18.3 | Frontend UI        |
| Express.js   |      4.19 | REST API & routing |
| Zustand      |       4.5 | State management   |
| Gemini       | 3.6-flash | AI API generation  |
| Tailwind CSS |         — | UI styling         |
| Vite         |         — | Frontend tooling   |
| Node.js      |         — | Backend runtime    |

-

# 📊 Project Stats

| Frontend                 | Backend               |
| ------------------------ | --------------------- |
| 22 source files          | 14 source files       |
| 18 React components      | 15 route handlers     |
| 3 Zustand stores         | 5 middleware layers   |
| 336 KB production bundle | 30 resource templates |
| 58 KB CSS bundle         | 40 field definitions  |

-

# 📁 Project Structure

`text
mockflow-ai/
├── .kiro/
├── backend/
│   ├── server.js
│   ├── routes/
│   ├── middleware/
│   ├── services/
│   └── models/
├── frontend/
│   ├── vercel.json
│   └── src/
│       ├── pages/
│       ├── components/
│       ├── store/
│       └── services/
├── render.yaml
├── .gitignore
└── README.md
`

--

## 🚀 Run Locally

# Backend

`bash
git clone https://github.com/<you>/mockflow-ai.git
cd mockflow-ai/backend
cp .env.example .env
npm install
npm run dev
`

### Frontend

`bash
cd ../frontend
npm install
npm run dev
`

> **No Gemini API key?** The local fallback engine can still run the application.

--

# 🌐 Deployment

| Platform   | Purpose             |
| ---------- | ------------------- |
| *GitHub* | Source repository   |
| *Vercel* | Frontend deployment |
| *Render* | Backend deployment  |

Environment variables:

`text
GEMINI_API_KEY
CLIENT_ORIGIN
VITE_API_BASE_URL
`

---

# 🏆 Hackathon Value

MockFlow AI reduces the time between an *API idea and a working development environment*.

It enables developers to prototype, test, and demonstrate APIs without first building a complete backend.

*Built for National Hackathon 2026.*

---

# 📜 License

*MIT License*

<div align="center">

# ⚡ MockFlow AI

*The fastest path from API idea to live endpoint.*

</div>
