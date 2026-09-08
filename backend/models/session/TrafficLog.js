import mongoose from 'mongoose';

/**
 * TrafficLog — one recorded mock request event, scoped to a guest session.
 * Persistence mirror of the in-memory `traffic` array held by SessionStore and
 * surfaced by the Live Traffic Inspector (GET /api/traffic/:sessionId).
 *
 * NOTE ON SCOPE (mirrors the in-memory recorder in routes/mock.js):
 *   Bulk stress-test hits carry `x-mockflow-stress: 1` and are DELIBERATELY
 *   never recorded, so the inspector shows only organic/manual traffic. That
 *   filtering happens at the recorder call site — this model just stores what
 *   it is given.
 *
 * A TTL index expires events after 24h so the collection can't grow unbounded
 * in a long-lived cluster; in-memory sessions already expire after 60 min.
 */
const trafficLogSchema = new mongoose.Schema(
  {
    sessionId: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    method: {
      type: String,
      uppercase: true,
      trim: true,
    },
    slug: {
      type: String,
      trim: true,
      lowercase: true,
    },
    status: {
      type: Number,
    },
    latencyMs: {
      type: Number,
    },
    ip: {
      type: String,
      trim: true,
    },
    // Explicit event timestamp (the recorder sets this to when the request
    // STARTED, independent of the createdAt write time).
    ts: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Fast per-session, newest-first retrieval for the inspector.
trafficLogSchema.index({ sessionId: 1, ts: -1 });

// Auto-expire events 24h after their timestamp to bound storage growth.
trafficLogSchema.index({ ts: 1 }, { expireAfterSeconds: 60 * 60 * 24 });

export const TrafficLog = mongoose.model('TrafficLog', trafficLogSchema);
