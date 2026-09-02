/**
 * SessionStore — ephemeral in-memory store for guest mock sessions.
 *
 * Keys:   sessionId (UUID v4)
 * Values: { endpoints: Map<slug, MockDefinition>, createdAt, lastAccessedAt }
 *
 * Sessions expire after GUEST_SESSION_TTL_MS of inactivity.
 */

const GUEST_SESSION_TTL_MS = 60 * 60 * 1000; // 60 minutes

const store = new Map();

export const SessionStore = {
  /**
   * Get or create a session entry.
   */
  getOrCreate(sessionId) {
    if (!store.has(sessionId)) {
      store.set(sessionId, {
        endpoints: new Map(),
        createdAt: Date.now(),
        lastAccessedAt: Date.now(),
      });
    }
    const session = store.get(sessionId);
    session.lastAccessedAt = Date.now();
    return session;
  },

  /**
   * Store a mock definition under a session + slug key.
   */
  setEndpoint(sessionId, slug, definition) {
    const session = this.getOrCreate(sessionId);
    session.endpoints.set(slug, definition);
  },

  /**
   * Retrieve a mock definition by session + slug.
   */
  getEndpoint(sessionId, slug) {
    const session = store.get(sessionId);
    if (!session) return null;
    session.lastAccessedAt = Date.now();
    return session.endpoints.get(slug) || null;
  },

  /**
   * Prune expired sessions. Call on a periodic interval.
   */
  purgeExpired() {
    const now = Date.now();
    for (const [id, session] of store.entries()) {
      if (now - session.lastAccessedAt > GUEST_SESSION_TTL_MS) {
        store.delete(id);
      }
    }
  },
};

// Run cleanup every 15 minutes
setInterval(() => SessionStore.purgeExpired(), 15 * 60 * 1000);
