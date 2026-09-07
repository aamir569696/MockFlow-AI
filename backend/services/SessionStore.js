/**
 * SessionStore — ephemeral in-memory store for guest mock sessions.
 *
 * Isolation model
 * ───────────────
 * The store is a Map<sessionId, Session> where each Session owns its own
 * Map<slug, MockDefinition> for endpoint definitions AND a separate
 * Map<slug, object[]> for stateful collection arrays.
 *
 * Every public method takes a sessionId as its first argument and performs
 * a strict key lookup — there is no fallback, no fuzzy match, and no
 * cross-session access path.
 *
 * Stateful Collection Engine
 * ──────────────────────────
 * For endpoints registered with isCollection: true, the store maintains a
 * live array of items keyed by slug.  GET reads it, POST appends to it,
 * DELETE splices from it.  The array is seeded with DataGenerator output on
 * first access so it always has realistic data immediately.
 *
 * Keys:   sessionId (UUID v4, pre-validated by routes/mock.js)
 * Values: {
 *   endpoints:   Map<slug, MockDefinition>,
 *   collections: Map<slug, object[]>,       ← stateful item arrays
 *   createdAt:   number,
 *   lastAccessedAt: number
 * }
 *
 * Sessions are evicted after GUEST_SESSION_TTL_MS of inactivity.
 */

import { randomUUID, randomBytes } from 'crypto';

const GUEST_SESSION_TTL_MS   = 60 * 60 * 1000;  // 60 minutes
const CLEANUP_INTERVAL_MS    = 15 * 60 * 1000;  // 15 minutes

// ── Auth-simulation credential generators ──────────────────────────────────────
const b64url = (buf) =>
  Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/** Generate a fake but realistic API key, e.g. "mf_live_a1b2…" (32 hex chars). */
function generateApiKey() {
  return `mf_live_${randomBytes(16).toString('hex')}`;
}

/**
 * Generate a fake JWT-style token (header.payload.signature, base64url).
 * NOT cryptographically signed — it's a simulation artifact for demos.
 */
function generateToken(sessionId) {
  const header  = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = b64url(JSON.stringify({
    sub: sessionId,
    iss: 'mockflow-ai',
    iat: Math.floor(Date.now() / 1000),
    jti: randomUUID(),
  }));
  const signature = b64url(randomBytes(24));
  return `${header}.${payload}.${signature}`;
}

/** Build a fresh auth config object. */
function makeAuthConfig(sessionId, enabled = false) {
  return {
    enabled,
    apiKey: generateApiKey(),
    token:  generateToken(sessionId),
    updatedAt: Date.now(),
  };
}

/** @type {Map<string, { endpoints: Map<string, object>, collections: Map<string, object[]>, createdAt: number, lastAccessedAt: number }>} */
const store = new Map();

export const SessionStore = {

  /**
   * Returns true if the session key exists in the store.
   */
  has(sessionId) {
    return store.has(sessionId);
  },

  /**
   * Get or create a session entry.
   * Updates lastAccessedAt on every access to reset the TTL.
   */
  getOrCreate(sessionId) {
    if (!store.has(sessionId)) {
      store.set(sessionId, {
        endpoints:       new Map(),
        collections:     new Map(),   // ← stateful collection arrays
        traffic:         [],          // ← rolling inbound HTTP event log (max 100)
        meta:            null,        // ← { apiName, description, schema } for docs
        auth:            makeAuthConfig(sessionId, false), // ← auth-sim config
        createdAt:       Date.now(),
        lastAccessedAt:  Date.now(),
      });
    }
    const session = store.get(sessionId);
    session.lastAccessedAt = Date.now();
    return session;
  },

  /**
   * Store a mock definition under a session + endpoint key.
   *
   * Endpoints are keyed by `slug:METHOD` so that multiple HTTP verbs sharing
   * a single slug (e.g. `GET /posts` list + `POST /posts` create) coexist
   * without overwriting one another. A slug-only alias is also written for
   * backward compatibility with callers that resolve by slug alone.
   */
  setEndpoint(sessionId, slug, definition) {
    const session = this.getOrCreate(sessionId);
    const method = (definition?.method ?? 'GET').toUpperCase();
    session.endpoints.set(`${slug}:${method}`, definition);
    // Slug-only alias — first writer wins so the primary (usually GET) route
    // remains resolvable by bare slug for legacy lookups.
    if (!session.endpoints.has(slug)) {
      session.endpoints.set(slug, definition);
    }
  },

  /**
   * Retrieve a mock definition by session + slug (+ optional method).
   * Prefers the method-specific entry, then falls back to the slug alias.
   * Returns null when session or endpoint not found — never throws.
   */
  getEndpoint(sessionId, slug, method) {
    const session = store.get(sessionId);
    if (!session) return null;
    session.lastAccessedAt = Date.now();
    if (method) {
      const exact = session.endpoints.get(`${slug}:${method.toUpperCase()}`);
      if (exact) return exact;
    }
    return session.endpoints.get(slug) ?? null;
  },

  /**
   * List every registered endpoint definition for a session (deduplicated).
   * The store keeps both `slug:METHOD` keys and a bare `slug` alias, so we
   * dedupe by the composite `slug:method` identity. Returns [] if unknown.
   *
   * @param {string} sessionId
   * @returns {object[]}
   */
  getAllEndpoints(sessionId) {
    const session = store.get(sessionId);
    if (!session) return [];
    session.lastAccessedAt = Date.now();
    const seen = new Map();
    for (const def of session.endpoints.values()) {
      if (!def) continue;
      const id = `${def.slug}:${(def.method ?? 'GET').toUpperCase()}`;
      if (!seen.has(id)) seen.set(id, def);
    }
    return [...seen.values()];
  },

  /**
   * Remove all endpoint definitions for a session (used when re-registering a
   * fresh endpoint set after a schema edit). Leaves stateful collection data
   * intact — it re-seeds lazily on the next GET.
   *
   * @param {string} sessionId
   */
  clearEndpoints(sessionId) {
    const session = store.get(sessionId);
    if (!session) return;
    session.endpoints.clear();
    session.lastAccessedAt = Date.now();
  },

  /**
   * Persist session-level metadata (API name, description, resource schema map)
   * so read-only consumers like the public docs page can reconstruct the full
   * API without the original generation prompt.
   *
   * @param {string} sessionId
   * @param {{ apiName?: string, description?: string, schema?: object }} meta
   */
  setMeta(sessionId, meta) {
    const session = this.getOrCreate(sessionId);
    session.meta = { ...(session.meta ?? {}), ...meta, updatedAt: Date.now() };
  },

  /**
   * Retrieve session-level metadata. Returns null if none stored.
   * @param {string} sessionId
   * @returns {object|null}
   */
  getMeta(sessionId) {
    const session = store.get(sessionId);
    if (!session) return null;
    session.lastAccessedAt = Date.now();
    return session.meta ?? null;
  },

  // ── Auth-Simulation API ─────────────────────────────────────────────────

  /**
   * Get the auth-sim config for a session ({ enabled, apiKey, token }).
   * Auto-creates the session (and a fresh disabled config) if missing so the
   * client always gets a stable key/token to display.
   *
   * @param {string} sessionId
   * @returns {{ enabled: boolean, apiKey: string, token: string, updatedAt: number }}
   */
  getAuth(sessionId) {
    const session = this.getOrCreate(sessionId);
    if (!session.auth) session.auth = makeAuthConfig(sessionId, false);
    return session.auth;
  },

  /**
   * Enable or disable auth enforcement for a session. Preserves the existing
   * key/token. Returns the updated config.
   *
   * @param {string} sessionId
   * @param {boolean} enabled
   */
  setAuthEnabled(sessionId, enabled) {
    const session = this.getOrCreate(sessionId);
    if (!session.auth) session.auth = makeAuthConfig(sessionId, false);
    session.auth = { ...session.auth, enabled: !!enabled, updatedAt: Date.now() };
    return session.auth;
  },

  /**
   * Regenerate the API key + token (invalidates the old credentials).
   * Preserves the current enabled flag. Returns the new config.
   *
   * @param {string} sessionId
   */
  regenerateAuth(sessionId) {
    const session = this.getOrCreate(sessionId);
    const wasEnabled = session.auth?.enabled ?? false;
    session.auth = makeAuthConfig(sessionId, wasEnabled);
    return session.auth;
  },

  // ── Stateful Collection API ─────────────────────────────────────────────

  /**
   * Retrieve the live item array for a collection endpoint.
   * Returns null if the session or slug is unknown.
   *
   * @param {string} sessionId
   * @param {string} slug
   * @returns {object[]|null}
   */
  getCollection(sessionId, slug) {
    const session = store.get(sessionId);
    if (!session) return null;
    session.lastAccessedAt = Date.now();
    return session.collections.get(slug) ?? null;
  },

  /**
   * Seed a collection with an initial array (called on first GET).
   * No-op if the collection already exists — prevents re-seeding on repeat GETs.
   *
   * @param {string} sessionId
   * @param {string} slug
   * @param {object[]} items
   */
  seedCollection(sessionId, slug, items) {
    const session = this.getOrCreate(sessionId);
    if (!session.collections.has(slug)) {
      session.collections.set(slug, items);
    }
  },

  /**
   * Append a new item to a collection.
   * Assigns a crypto.randomUUID() `id` if the item does not already have one.
   * Creates the collection array if it does not yet exist.
   *
   * @param {string} sessionId
   * @param {string} slug
   * @param {object} item   — req.body merged with generated mock fields
   * @returns {object}      — the stored item (with `id` guaranteed)
   */
  appendToCollection(sessionId, slug, item) {
    const session = this.getOrCreate(sessionId);
    if (!session.collections.has(slug)) {
      session.collections.set(slug, []);
    }
    const record = {
      id: randomUUID(),   // always a fresh cryptographic UUID
      ...item,            // user-supplied fields override generated ones
    };
    session.collections.get(slug).push(record);
    session.lastAccessedAt = Date.now();
    return record;
  },

  /**
   * Delete an item from a collection by its `id` field.
   * Returns true if an item was found and removed, false if not found.
   *
   * @param {string} sessionId
   * @param {string} slug
   * @param {string} itemId   — the `id` value to match
   * @returns {boolean}
   */
  deleteFromCollection(sessionId, slug, itemId) {
    const session = store.get(sessionId);
    if (!session) return false;
    const arr = session.collections.get(slug);
    if (!arr) return false;
    const before = arr.length;
    const filtered = arr.filter(item => String(item.id) !== String(itemId));
    session.collections.set(slug, filtered);
    session.lastAccessedAt = Date.now();
    return filtered.length < before;
  },

  // ── Live Traffic Log ────────────────────────────────────────────────────

  /**
   * Record an inbound HTTP event for the Live Traffic Inspector.
   * Keeps a rolling window of the last 100 events per session (newest first).
   *
   * @param {string} sessionId
   * @param {object} event  — { id, ts, method, slug, status, latencyMs, ip }
   */
  recordTraffic(sessionId, event) {
    // getOrCreate ensures the session exists so traffic is never dropped
    const session = this.getOrCreate(sessionId);
    session.traffic.unshift(event);
    if (session.traffic.length > 100) session.traffic.length = 100;
  },

  /**
   * Retrieve the traffic log for a session.
   * `sinceId` allows the frontend poller to fetch only NEW events —
   * returns all events that appear before the given id (newest-first order).
   *
   * @param {string} sessionId
   * @param {string|null} [sinceId]
   * @returns {{ events: object[], total: number }}
   */
  getTraffic(sessionId, sinceId = null) {
    const session = store.get(sessionId);
    if (!session) return { events: [], total: 0 };
    session.lastAccessedAt = Date.now();

    const all = session.traffic;
    if (!sinceId) return { events: all, total: all.length };

    // Return only events newer than sinceId (everything before its index)
    const idx = all.findIndex(e => e.id === sinceId);
    const events = idx === -1 ? all : all.slice(0, idx);
    return { events, total: all.length };
  },

  // ── Housekeeping ────────────────────────────────────────────────────────

  /**
   * Return the number of active sessions currently in memory.
   */
  size() {
    return store.size;
  },

  /**
   * Evict sessions that have been idle longer than GUEST_SESSION_TTL_MS.
   */
  purgeExpired() {
    const now     = Date.now();
    let evicted   = 0;
    for (const [id, session] of store.entries()) {
      if (now - session.lastAccessedAt > GUEST_SESSION_TTL_MS) {
        store.delete(id);
        evicted++;
      }
    }
    if (evicted > 0) {
      console.info(`[SessionStore] Evicted ${evicted} expired session(s). Active: ${store.size}`);
    }
  },
};

// Periodic cleanup — runs in the background every 15 minutes
const _cleanupTimer = setInterval(
  () => SessionStore.purgeExpired(),
  CLEANUP_INTERVAL_MS,
);

// Allow the process to exit cleanly even if this timer is active
// (relevant for test environments and graceful shutdown)
if (_cleanupTimer.unref) _cleanupTimer.unref();
