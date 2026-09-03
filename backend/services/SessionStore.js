/**
 * SessionStore — ephemeral in-memory store for guest mock sessions.
 *
 * Isolation model
 * ───────────────
 * The store is a Map<sessionId, Session> where each Session owns its own
 * Map<slug, MockDefinition>. Every public method takes a sessionId as its
 * first argument and performs a strict key lookup — there is no fallback,
 * no fuzzy match, and no cross-session access path.
 *
 * Concurrent requests for different session UUIDs therefore operate on
 * completely independent Map entries. JavaScript's single-threaded event
 * loop means there is no race condition between reads and writes to the
 * same session either — only one microtask runs at a time.
 *
 * Keys:   sessionId (UUID v4, pre-validated by routes/mock.js)
 * Values: { endpoints: Map<slug, MockDefinition>, createdAt, lastAccessedAt }
 *
 * Sessions are evicted after GUEST_SESSION_TTL_MS of inactivity.
 */

const GUEST_SESSION_TTL_MS   = 60 * 60 * 1000;  // 60 minutes
const CLEANUP_INTERVAL_MS    = 15 * 60 * 1000;  // 15 minutes

/** @type {Map<string, { endpoints: Map<string, object>, createdAt: number, lastAccessedAt: number }>} */
const store = new Map();

export const SessionStore = {

  /**
   * Returns true if the session key exists in the store (regardless of
   * whether it has any endpoints).
   * Used by routes/mock.js to distinguish SESSION_NOT_FOUND from
   * ENDPOINT_NOT_FOUND without coupling the route to store internals.
   *
   * @param {string} sessionId
   * @returns {boolean}
   */
  has(sessionId) {
    return store.has(sessionId);
  },

  /**
   * Get or create a session entry.
   * Updates lastAccessedAt on every access to reset the TTL.
   *
   * @param {string} sessionId
   * @returns {{ endpoints: Map<string, object>, createdAt: number, lastAccessedAt: number }}
   */
  getOrCreate(sessionId) {
    if (!store.has(sessionId)) {
      store.set(sessionId, {
        endpoints:       new Map(),
        createdAt:       Date.now(),
        lastAccessedAt:  Date.now(),
      });
    }
    const session = store.get(sessionId);
    session.lastAccessedAt = Date.now();
    return session;
  },

  /**
   * Store a mock definition under a session + slug key.
   *
   * @param {string} sessionId
   * @param {string} slug
   * @param {object} definition
   */
  setEndpoint(sessionId, slug, definition) {
    const session = this.getOrCreate(sessionId);
    session.endpoints.set(slug, definition);
  },

  /**
   * Retrieve a mock definition by session + slug.
   *
   * Isolation guarantee: the lookup first fetches the session by UUID.
   * Only if that exact UUID exists in the store is the slug sub-lookup
   * performed. A slug that happens to exist in another session is never
   * reachable from this call because the outer Map keys are disjoint.
   *
   * Returns null (never throws) when:
   *   - sessionId is not in the store (session never existed or was evicted)
   *   - slug is not in that session's endpoint map
   *
   * lastAccessedAt is updated ONLY when the session exists — we do NOT
   * create or mutate any entry for an unknown sessionId.
   *
   * @param {string} sessionId
   * @param {string} slug
   * @returns {object|null}
   */
  getEndpoint(sessionId, slug) {
    const session = store.get(sessionId);
    if (!session) return null;               // session not found — no mutation

    session.lastAccessedAt = Date.now();     // touch TTL only for real sessions
    return session.endpoints.get(slug) ?? null;
  },

  /**
   * Return the number of active sessions currently in memory.
   * Useful for health-check or monitoring endpoints.
   *
   * @returns {number}
   */
  size() {
    return store.size;
  },

  /**
   * Evict sessions that have been idle longer than GUEST_SESSION_TTL_MS.
   *
   * Node.js guarantees that deleting a Map key during a for-of iteration
   * over the same Map is safe — the iteration is based on insertion order
   * and deletions do not affect entries not yet visited.
   */
  purgeExpired() {
    const now      = Date.now();
    let   evicted  = 0;

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
