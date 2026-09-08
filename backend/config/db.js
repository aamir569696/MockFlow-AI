import mongoose from 'mongoose';

/**
 * connectMongo — cached, serverless-safe MongoDB connection helper.
 *
 * WHY THE GLOBAL CACHE
 * ────────────────────
 * On serverless platforms (Vercel, Lambda) each invocation may reuse a warm
 * container OR spin up a cold one. Without caching, every warm invocation that
 * calls mongoose.connect() would open a NEW connection, rapidly exhausting the
 * MongoDB Atlas connection pool. We stash the connection (and the in-flight
 * connect promise) on globalThis so it survives across invocations within the
 * same container and is shared, never duplicated.
 *
 * GATING
 * ──────
 * This helper is a NO-OP unless process.env.MONGO_URI is set. The app's primary
 * runtime is the in-memory SessionStore; Mongo persistence is strictly opt-in.
 * Callers should treat a null return as "persistence disabled" and fall back to
 * the in-memory path — never crash.
 *
 * USAGE
 * ─────
 *   const conn = await connectMongo();
 *   if (!conn) { // persistence disabled — use in-memory SessionStore }
 *
 * @returns {Promise<import('mongoose').Mongoose | null>}
 *          The connected mongoose instance, or null when MONGO_URI is absent.
 */

// Reuse a single cache object across hot-reloads and serverless invocations.
// globalThis persists for the lifetime of the container/process.
const globalForMongoose = globalThis;
globalForMongoose._mongooseCache = globalForMongoose._mongooseCache || {
  conn: null,   // the resolved mongoose instance once connected
  promise: null // the in-flight connect() promise (dedupes concurrent callers)
};

const cache = globalForMongoose._mongooseCache;

export async function connectMongo() {
  const uri = process.env.MONGO_URI;

  // ── Gate: no URI → persistence disabled. Caller falls back to in-memory. ──
  if (!uri) {
    return null;
  }

  // ── Already connected in this container → reuse immediately. ──────────────
  if (cache.conn) {
    return cache.conn;
  }

  // ── A connect() is already in flight → await the SAME promise. ────────────
  // This dedupes the "thundering herd" of concurrent requests on a cold start.
  if (!cache.promise) {
    const opts = {
      // Fail fast instead of hanging a request if the cluster is unreachable.
      serverSelectionTimeoutMS: 8000,
      // bufferCommands:false → queries reject instead of silently queuing while
      // disconnected, so a misconfigured URI surfaces as a clear error.
      bufferCommands: false,
    };

    cache.promise = mongoose
      .connect(uri, opts)
      .then((mongooseInstance) => {
        console.info('[MockFlow] MongoDB connected — persistence layer active.');
        return mongooseInstance;
      })
      .catch((err) => {
        // Reset the promise so a later call can retry a fresh connection.
        cache.promise = null;
        console.warn(`[MockFlow] MongoDB connection failed: ${err.message}`);
        throw err;
      });
  }

  try {
    cache.conn = await cache.promise;
  } catch {
    // Swallow here so callers get null (→ in-memory fallback) rather than an
    // unhandled rejection. The underlying cause was already logged above.
    cache.conn = null;
  }

  return cache.conn;
}

/**
 * isMongoEnabled — quick synchronous check of whether persistence is configured.
 * Does NOT open a connection; just reports whether MONGO_URI is present.
 */
export function isMongoEnabled() {
  return Boolean(process.env.MONGO_URI);
}

/**
 * isMongoConnected — true only when a live connection is currently established.
 * readyState === 1 means "connected".
 */
export function isMongoConnected() {
  return mongoose.connection?.readyState === 1;
}
