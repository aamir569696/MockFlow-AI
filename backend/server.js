import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import { guestSessionMiddleware } from './middleware/guestSession.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFoundHandler } from './middleware/notFoundHandler.js';

import authRoutes from './routes/auth.js';
import generateRoutes from './routes/generate.js';
import endpointRoutes from './routes/endpoints.js';
import mockRoutes from './routes/mock.js';
import trafficRoutes from './routes/traffic.js';

const app = express();
const PORT = process.env.PORT || 5000;

// ── Security & parsing middleware ──────────────────────────────────────────────
app.use(helmet());

// CORS — accepts an explicit whitelist in production via CLIENT_ORIGIN / CORS_ORIGIN.
// Multiple origins can be comma-separated: "https://a.vercel.app,https://b.vercel.app"
const rawOrigins = process.env.CLIENT_ORIGIN || process.env.CORS_ORIGIN || 'http://localhost:5173';
const allowedOrigins = rawOrigins.split(',').map((o) => o.trim()).filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (curl, Postman, Render health checks)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
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

// ── 404 + global error handler ────────────────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

// ── Start server ───────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[MockFlow AI] Server running on http://localhost:${PORT}`);
  console.log(`[MockFlow AI] Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;
