# MockFlow AI

> **Generate realistic mock REST APIs from a plain-English prompt — instantly, with zero sign-up.**

Powered by Google Gemini AI · Built with React + Express · Deployed on Vercel + Render

---

## Live Demo

| Service  | URL |
|----------|-----|
| Frontend | `https://mockflow-ai.vercel.app` *(replace after deploy)* |
| Backend  | `https://mockflow-ai-backend.onrender.com` *(replace after deploy)* |
| Health   | `https://mockflow-ai-backend.onrender.com/health` |

---

## Features

- **Playground-First** — generate live mock endpoints as a guest, no account required
- **Gemini AI** — natural-language prompt → full JSON schema + CRUD endpoints in < 5 s
- **Local fallback engine** — works offline if Gemini is unavailable (zero-cost path)
- **Dynamic mock resolver** — any HTTP verb on `/api/mock/:sessionId/:slug` returns realistic fake data
- **Live Telemetry Dashboard** — status badge, latency, content-type, payload size per request
- **Export Code Bundle** — Postman v2.1 collection + Schema SDK JSON download
- **Analytics Dashboard** — endpoint tree, sparkline charts, live network log

---

## Project Structure

```
mockflow-ai/
├── backend/                  Express.js API server
│   ├── server.js             Entry point — process.env.PORT || 5000
│   ├── routes/               auth · generate · endpoints · mock
│   ├── middleware/           guestSession · auth · errorHandler
│   ├── services/             MockResolver (Gemini) · SessionStore · DataGenerator
│   └── models/               User · Endpoint (Mongoose)
├── frontend/                 React 18 + Vite + Tailwind CSS
│   ├── vercel.json           Vercel deployment config (SPA rewrites)
│   ├── src/
│   │   ├── pages/            Landing · Playground · Dashboard
│   │   ├── components/       PromptPanel · SchemaEditor · EndpointPreview
│   │   │                     RequestRunner · ExportDropdown · AuthModal
│   │   ├── store/            playgroundStore · authStore (Zustand)
│   │   └── services/         mockService · authService · endpointService
├── render.yaml               Render.com backend deployment config
├── .gitignore
└── README.md
```

---

## Local Development

### Prerequisites

- Node.js ≥ 18
- npm ≥ 9
- A free [Google AI Studio](https://aistudio.google.com/app/apikey) API key

### 1 — Clone & install

```bash
git clone https://github.com/<your-username>/mockflow-ai.git
cd mockflow-ai

# Backend
cd backend && npm install

# Frontend
cd ../frontend && npm install
```

### 2 — Configure environment

```bash
# backend/.env  (copy from .env.example)
cp backend/.env.example backend/.env
```

Open `backend/.env` and fill in:

```env
PORT=5000
NODE_ENV=development
GEMINI_API_KEY=AIza...          # from aistudio.google.com
CLIENT_ORIGIN=http://localhost:5173
JWT_SECRET=replace_with_random_64_char_string
JWT_REFRESH_SECRET=replace_with_another_random_64_char_string
```

### 3 — Run

```bash
# Terminal 1 — backend (http://localhost:5000)
cd backend && npm run dev

# Terminal 2 — frontend (http://localhost:5173)
cd frontend && npm run dev
```

Open **http://localhost:5173** — the Playground loads immediately with no login required.

---

## Deployment

### Frontend → Vercel (free)

**One-click deploy:**

1. Push the repo to GitHub
2. Go to [vercel.com](https://vercel.com) → **New Project** → import the repo
3. Set **Root Directory** to `frontend`
4. Vercel auto-detects Vite. Build settings are in `frontend/vercel.json`:
   - **Build command:** `npm run build`
   - **Output directory:** `dist`
5. Add one **Environment Variable** in the Vercel dashboard:

   | Key | Value |
   |-----|-------|
   | `VITE_API_BASE_URL` | your Render backend URL (e.g. `https://mockflow-ai-backend.onrender.com`) |

6. Click **Deploy**

The `vercel.json` catch-all rewrite (`/* → /index.html`) ensures React Router works on all paths.

---

### Backend → Render (free tier)

**Via render.yaml (Infrastructure as Code):**

1. Go to [render.com](https://render.com) → **New** → **Blueprint**
2. Connect your GitHub repo — Render reads `render.yaml` automatically
3. Set the following **Secret Environment Variables** in the Render dashboard
   (Dashboard → your service → **Environment**):

   | Variable | Description |
   |----------|-------------|
   | `GEMINI_API_KEY` | Google AI Studio key |
   | `CLIENT_ORIGIN` | Your Vercel frontend URL, e.g. `https://mockflow-ai.vercel.app` |
   | `JWT_SECRET` | Random 64-char secret |
   | `JWT_REFRESH_SECRET` | Random 64-char secret |
   | `MONGO_URI` | MongoDB Atlas URI *(optional — only needed for saved endpoints)* |

4. Render injects `PORT` automatically — `server.js` uses `process.env.PORT || 5000`
5. Click **Apply** — first deploy takes ~2 min

**Health check:** Render pings `/health` every 30 s. The endpoint returns:
```json
{ "status": "ok", "timestamp": "2026-09-02T12:00:00.000Z" }
```

**Manual deploy (without render.yaml):**

1. New Web Service → connect repo
2. **Root Directory:** `backend`
3. **Build Command:** `npm install`
4. **Start Command:** `npm start`
5. **Runtime:** Node
6. **Plan:** Free
7. Add environment variables as above

---

### Post-Deploy: Wire frontend → backend

After both services are live, update one variable on each platform:

**Render** → `CLIENT_ORIGIN` = `https://your-app.vercel.app`

**Vercel** → `VITE_API_BASE_URL` = `https://your-backend.onrender.com`

Then update `frontend/src/services/mockService.js` line 5 to read the env var in production:

```js
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL
    ? `${import.meta.env.VITE_API_BASE_URL}/api`
    : '/api',
});
```

Redeploy the frontend after this change.

---

## API Reference

### `POST /api/generate`
Guest-accessible. Calls Gemini AI (or local fallback) to generate a schema and register mock endpoints.

```bash
curl -X POST https://<backend>/api/generate \
  -H "Content-Type: application/json" \
  -d '{"prompt": "A blog API with posts, authors, and comments"}'
```

**Response:**
```json
{
  "sessionId": "uuid-v4",
  "apiName": "Blog API",
  "description": "...",
  "schema": { "Post": { "type": "object", "properties": {} } },
  "endpoints": [
    { "slug": "posts", "method": "GET", "path": "/api/mock/:sessionId/posts" }
  ]
}
```

### `GET|POST|PUT|PATCH|DELETE /api/mock/:sessionId/:slug`
Dynamic mock handler. Returns realistic fake data matching the generated schema.

```bash
curl https://<backend>/api/mock/<sessionId>/posts
curl https://<backend>/api/mock/<sessionId>/posts?count=5
curl https://<backend>/api/mock/<sessionId>/posts?status=404
curl -H "x-mockflow-delay: 300" https://<backend>/api/mock/<sessionId>/posts
```

---

## Environment Variables Reference

### Backend (`backend/.env`)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `5000` | Server port — injected by Render automatically |
| `NODE_ENV` | No | `development` | Set to `production` on Render |
| `GEMINI_API_KEY` | Yes* | — | Google AI Studio key. If absent, local fallback activates |
| `CLIENT_ORIGIN` | Yes (prod) | `http://localhost:5173` | Comma-separated allowed CORS origins |
| `JWT_SECRET` | Yes (prod) | — | JWT signing secret (64+ chars) |
| `JWT_REFRESH_SECRET` | Yes (prod) | — | JWT refresh secret (64+ chars) |
| `MONGO_URI` | No | — | MongoDB Atlas URI for persistent saved endpoints |

### Frontend (`frontend/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_API_BASE_URL` | No | Backend base URL for production. Omit for local dev (Vite proxy handles it) |

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend framework | React | 18.3 |
| Build tool | Vite | 5.3 |
| Styling | Tailwind CSS | 3.4 |
| State management | Zustand | 4.5 |
| HTTP client | Axios | 1.7 |
| Client routing | React Router | 6.24 |
| Backend framework | Express.js | 4.19 |
| AI generation | Google Gemini | 2.5-flash / 3.6-flash |
| Database (optional) | MongoDB + Mongoose | 8.4 |
| Auth | JWT (jsonwebtoken) | 9.0 |
| Frontend hosting | Vercel | free tier |
| Backend hosting | Render | free tier |

---

## License

MIT — built for the MockFlow AI hackathon submission.
