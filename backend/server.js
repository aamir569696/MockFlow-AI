import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import { guestSessionMiddleware } from './middleware/guestSession.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFoundHandler } from './middleware/notFoundHandler.js';
import { connectMongo, isMongoEnabled } from './config/db.js';

import authRoutes from './routes/auth.js';
import generateRoutes from './routes/generate.js';
import endpointRoutes from './routes/endpoints.js';
import mockRoutes from './routes/mock.js';
import trafficRoutes from './routes/traffic.js';
import docsRoutes from './routes/docs.js';

const app = express();
const PORT = process.env.PORT || 5000;

// ── Persistence layer (optional) ───────────────────────────────────────────────
// Warm the cached MongoDB connection at startup when MONGO_URI is configured.
// Gated + error-isolated: if absent or unreachable, the app runs entirely on the
// in-memory SessionStore. connectMongo() caches the connection across serverless
// invocations, so this is safe to call eagerly here and lazily per-request.
if (isMongoEnabled()) {
  connectMongo()
    .then((conn) => {
      if (!conn) console.warn('[MockFlow AI] MONGO_URI set but connection unavailable — using in-memory store.');
    })
    .catch(() => { /* already logged in connectMongo; in-memory fallback applies */ });
} else {
  console.info('[MockFlow AI] No MONGO_URI — running with in-memory session store (ephemeral).');
}

// ── Security & parsing middleware ──────────────────────────────────────────────
app.use(helmet());

// CORS — accepts an explicit whitelist in production via CLIENT_ORIGIN / CORS_ORIGIN.
// Multiple origins can be comma-separated: "https://a.vercel.app,https://b.vercel.app"
const rawOrigins = process.env.CLIENT_ORIGIN || process.env.CORS_ORIGIN || 'http://localhost:5173';
const allowedOrigins = rawOrigins.split(',').map((o) => o.trim()).filter(Boolean);

// Vercel preview deployments get a fresh, unpredictable hostname per build
// (e.g. https://mockflow-ai-git-<branch>-<scope>.vercel.app). Rather than
// reflecting EVERY origin on the internet (which, with credentials:true, would
// also be spec-invalid for '*'), we allow the configured origins PLUS any
// *.vercel.app host. Set CORS_ALLOW_ALL=true only if you truly need to reflect
// all origins — it is an explicit, visible opt-in, never the silent default.
const allowAllOrigins = String(process.env.CORS_ALLOW_ALL ?? '').toLowerCase() === 'true';
const VERCEL_PREVIEW_RE = /^https:\/\/[a-z0-9-]+\.vercel\.app$/i;

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (curl, Postman, Render health checks)
    if (!origin) return callback(null, true);
    if (allowAllOrigins) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    // Allow any Vercel preview/production deployment host.
    if (VERCEL_PREVIEW_RE.test(origin)) return callback(null, true);
    callback(new Error(`CORS: origin '${origin}' not allowed`));
  },
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Request logging (dev only) ─────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// ── Guest session assignment ───────────────────────────────────────────────────
app.use(guestSessionMiddleware);

// ── Health check ───────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── API routes ─────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/generate', generateRoutes);
app.use('/api/endpoints', endpointRoutes);
app.use('/api/mock', mockRoutes);
app.use('/api/traffic', trafficRoutes);
app.use('/api/docs', docsRoutes);

// ── 404 + global error handler ────────────────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

// ── Start server ───────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[MockFlow AI] Server running on http://localhost:${PORT}`);
  console.log(`[MockFlow AI] Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;
