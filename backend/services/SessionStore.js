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

import { randomUUID } from 'crypto';

const GUEST_SESSION_TTL_MS   = 60 * 60 * 1000;  // 60 minutes
const CLEANUP_INTERVAL_MS    = 15 * 60 * 1000;  // 15 minutes

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
   */
  setEndpoint(sessionId, slug, definition) {
    const session = this.getOrCreate(sessionId);
    session.endpoints.set(slug, definition);
  },

  /**
   * Retrieve a mock definition by session + slug.
   * Returns null when session or slug not found — never throws.
   */
  getEndpoint(sessionId, slug) {
    const session = store.get(sessionId);
    if (!session) return null;
    session.lastAccessedAt = Date.now();
    return session.endpoints.get(slug) ?? null;
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
