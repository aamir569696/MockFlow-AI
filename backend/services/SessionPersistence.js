/**
 * SessionPersistence — trusted, server-side persistence adapter that mirrors
 * the in-memory SessionStore into MongoDB so guest sessions survive serverless
 * cold-starts / container recycles.
 *
 * DESIGN CONTRACT
 * ───────────────
 *  • SERVER IS THE SOURCE OF TRUTH. Only server-side code (MockResolver on
 *    generate/edit, the mock collection engine on mutate) ever writes here.
 *    No client payload is ever trusted to define or hydrate a session.
 *  • FULLY GATED. Every method is a no-op (returns null/false/[]) when
 *    MONGO_URI is absent — the in-memory SessionStore stays the primary path.
 *  • ERROR-ISOLATED. Every DB call is wrapped; a Mongo failure logs a warning
 *    and degrades to in-memory behaviour. Persistence must NEVER throw into a
 *    request handler or turn a working mock into a 500.
 *  • WRITES ARE FIRE-AND-FORGET at the call sites (not awaited on the hot
 *    path); the READ (hydrateSession) is awaited only on a cache MISS.
 *
 * The persisted endpoint document shape mirrors the in-memory definition
 * produced by MockResolver:
 *   { slug, method, description, resource, isCollection, schema, definition }
 * where `definition` is the verbatim runtime object so hydration is lossless.
 */

import { connectMongo, isMongoEnabled } from '../config/db.js';
import { SessionEndpoint }   from '../models/session/SessionEndpoint.js';
import { SessionCollection } from '../models/session/SessionCollection.js';
import { SessionStore }      from './SessionStore.js';

/**
 * Ensure a live connection before a DB op. Returns true when Mongo is usable,
 * false when persistence is disabled or the connection could not be established
 * (caller then silently falls back to in-memory).
 */
async function ready() {
  if (!isMongoEnabled()) return false;
  try {
    const conn = await connectMongo();
    return Boolean(conn);
  } catch {
    return false;
  }
}

export const SessionPersistence = {
  /** True when persistence is configured (does not open a connection). */
  enabled() {
    return isMongoEnabled();
  },

  /**
   * Persist the full endpoint set + meta for a session. Called after
   * MockResolver has registered them in the in-memory store. Idempotent:
   * replaces any previously-persisted endpoints for the session so a schema
   * edit does not leave stale rows behind.
   *
   * @param {string} sessionId
   * @param {object[]} definitions  runtime definitions from SessionStore
   * @param {{ apiName?: string, description?: string, schema?: object }} meta
   */
  async persistEndpoints(sessionId, definitions, meta = {}) {
    if (!(await ready())) return false;
    try {
      // Replace the session's endpoint set atomically-ish: drop then insert.
      await SessionEndpoint.deleteMany({ sessionId });

      const docs = (definitions ?? [])
        .filter((d) => d && d.slug)
        .map((d) => ({
          sessionId,
          slug:         String(d.slug).toLowerCase(),
          method:       String(d.method ?? 'GET').toUpperCase(),
          resource:     d.resource ?? '',
          description:  d.description ?? '',
          isCollection: Boolean(d.isCollection),
          delayMs:      d.delayMs ?? 0,
          schema:       d.schema ?? d.responseSchema ?? {},
          // Verbatim runtime definition (incl. meta) → lossless hydration.
          definition:   { ...d, __meta: meta ?? {} },
        }));

      if (docs.length) {
        await SessionEndpoint.insertMany(docs, { ordered: false });
      }
      return true;
    } catch (err) {
      console.warn(`[SessionPersistence] persistEndpoints failed: ${err.message}`);
      return false;
    }
  },

  /**
   * Seed a collection buffer (mirrors SessionStore.seedCollection). Upsert so a
   * repeat seed of the same (session, key) does not duplicate.
   */
  async persistCollectionSeed(sessionId, collectionKey, items) {
    if (!(await ready())) return false;
    try {
      await SessionCollection.updateOne(
        { sessionId, collectionKey: String(collectionKey).toLowerCase() },
        { $setOnInsert: { items: items ?? [] } },
        { upsert: true },
      );
      return true;
    } catch (err) {
      console.warn(`[SessionPersistence] persistCollectionSeed failed: ${err.message}`);
      return false;
    }
  },

  /** Append one item to a persisted collection buffer. */
  async persistCollectionAppend(sessionId, collectionKey, item) {
    if (!(await ready())) return false;
    try {
      await SessionCollection.updateOne(
        { sessionId, collectionKey: String(collectionKey).toLowerCase() },
        { $push: { items: item } },
        { upsert: true },
      );
      return true;
    } catch (err) {
      console.warn(`[SessionPersistence] persistCollectionAppend failed: ${err.message}`);
      return false;
    }
  },

  /** Remove one item (by id) from a persisted collection buffer. */
  async persistCollectionDelete(sessionId, collectionKey, itemId) {
    if (!(await ready())) return false;
    try {
      await SessionCollection.updateOne(
        { sessionId, collectionKey: String(collectionKey).toLowerCase() },
        { $pull: { items: { id: itemId } } },
      );
      return true;
    } catch (err) {
      console.warn(`[SessionPersistence] persistCollectionDelete failed: ${err.message}`);
      return false;
    }
  },

  /**
   * hydrateSession — the cold-start recovery read.
   *
   * When the in-memory store has no record of a session (serverless recycle),
   * rebuild it from the trusted Mongo documents: re-register every endpoint via
   * SessionStore.setEndpoint, restore meta via setMeta, and reload any persisted
   * collection buffers. After this, the normal routing/resolution logic runs
   * unchanged against the in-memory store.
   *
   * @param {string} sessionId
   * @returns {Promise<boolean>} true if the session was found + hydrated.
   */
  async hydrateSession(sessionId) {
    if (!(await ready())) return false;
    try {
      const rows = await SessionEndpoint.find({ sessionId }).lean();
      if (!rows || rows.length === 0) return false;

      let meta = null;
      for (const row of rows) {
        // Prefer the verbatim runtime definition; fall back to reconstructing.
        const def = (row.definition && typeof row.definition === 'object')
          ? { ...row.definition }
          : {
              slug:           row.slug,
              method:         row.method,
              description:    row.description,
              resource:       row.resource,
              isCollection:   row.isCollection,
              schema:         row.schema,
              responseSchema: row.schema,
            };
        // Extract + strip the embedded meta marker.
        if (!meta && def.__meta) meta = def.__meta;
        delete def.__meta;

        SessionStore.setEndpoint(sessionId, String(row.slug).toLowerCase(), def);
      }

      if (meta) SessionStore.setMeta(sessionId, meta);

      // Restore any persisted collection buffers so stateful data survives too.
      const buffers = await SessionCollection.find({ sessionId }).lean();
      for (const buf of (buffers ?? [])) {
        if (Array.isArray(buf.items) && buf.items.length) {
          SessionStore.seedCollection(sessionId, buf.collectionKey, buf.items);
        }
      }

      console.info(`[SessionPersistence] Hydrated session ${String(sessionId).slice(0, 8)}… from MongoDB (${rows.length} endpoint doc(s)).`);
      return true;
    } catch (err) {
      console.warn(`[SessionPersistence] hydrateSession failed: ${err.message}`);
      return false;
    }
  },
};
