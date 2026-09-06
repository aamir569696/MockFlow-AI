import { Router } from 'express';
import { randomUUID } from 'crypto';
import { MockResolver } from '../services/MockResolver.js';
import { generateResponse, generateValue, seedFromKey, validateAgainstSchema } from '../services/DataGenerator.js';
import { SessionStore } from '../services/SessionStore.js';

const router = Router();

// ── Body merge helper ─────────────────────────────────────────────────────────

/**
 * deepMerge(target, override) — recursively merges `override` into `target`.
 *
 * Rules:
 *  • Both objects → recurse into matching keys; override keys win on collision.
 *  • `override` is a primitive / array / non-object → `override` replaces `target`.
 *  • `override` is null / undefined → `target` is returned unchanged.
 *
 * This is intentionally non-destructive: a fresh merged object is returned,
 * the original generated mock is never mutated.
 */
function deepMerge(target, override) {
  if (override === null || override === undefined) return target;
  if (typeof override !== 'object' || Array.isArray(override)) return override;
  if (typeof target !== 'object' || Array.isArray(target) || target === null) {
    return override;
  }
  const result = { ...target };
  for (const key of Object.keys(override)) {
    result[key] = Object.prototype.hasOwnProperty.call(result, key)
      ? deepMerge(result[key], override[key])
      : override[key];
  }
  return result;
}

// ── Input validators ──────────────────────────────────────────────────────────

/**
 * UUID v4 pattern (case-insensitive).
 * Rejects any sessionId that is not a well-formed UUID before touching the store,
 * closing the fuzzing surface and preventing oversized Map key allocations.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Slug whitelist: lowercase alphanum + hyphens, 1–128 chars.
 * Rejects path-traversal sequences (.., /), CRLF (\r\n), and excessively
 * long inputs before any store lookup or header reflection.
 */
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,127}$/;

/**
 * Validate and sanitise the session UUID.
 * Returns the normalised (lowercase) UUID string, or null if invalid.
 */
function validateSessionId(raw) {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim().toLowerCase();
  return UUID_RE.test(trimmed) ? trimmed : null;
}

/**
 * Validate and sanitise an endpoint slug.
 * Returns the normalised (lowercase) slug string, or null if invalid.
 */
function validateSlug(raw) {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim().toLowerCase();
  return SLUG_RE.test(trimmed) ? trimmed : null;
}

// ── Dynamic mock handler ──────────────────────────────────────────────────────

/**
 * Wildcard dynamic mock handler.
 *
 * Matches:  /api/mock/:sessionId/:endpointSlug
 * Methods:  GET, POST, PUT, PATCH, DELETE
 *
 * Isolation guarantee
 * ───────────────────
 * Every lookup is keyed by BOTH sessionId AND slug. The SessionStore
 * is a Map<sessionId, { endpoints: Map<slug, Definition> }>. A slug
 * present in session A can never be served to a request carrying
 * session B's UUID — the outer Map key (UUID) is the isolation boundary.
 *
 * Resolution order:
 *  1. Validate sessionId format (UUID v4) — reject 400 on malformed input
 *  2. Validate endpointSlug format — reject 400 on malformed input
 *  3. Look up the session in SessionStore — reject 404 SESSION_NOT_FOUND if absent
 *  4. Look up the slug within that session — reject 404 ENDPOINT_NOT_FOUND if absent
 *  5. Apply optional latency simulation
 *  6. Generate fake response via DataGenerator
 *  7. Return response with sanitised, non-reflected headers
 */
const handleMock = async (req, res, next) => {
  try {
    const method = req.method.toUpperCase();

    // ── 1. Validate session UUID ─────────────────────────────────────────
    const sessionId = validateSessionId(req.params.sessionId);
    if (!sessionId) {
      return res.status(400).json({
        error: {
          code:    'INVALID_SESSION_ID',
          message: 'Session ID must be a valid UUID v4.',
        },
      });
    }

    // ── 2. Validate endpoint slug ────────────────────────────────────────
    const endpointSlug = validateSlug(req.params.endpointSlug);
    if (!endpointSlug) {
      return res.status(400).json({
        error: {
          code:    'INVALID_SLUG',
          message: 'Endpoint slug must be 1–128 lowercase alphanumeric characters or hyphens.',
        },
      });
    }

    // ── Live Traffic recorder ─────────────────────────────────────────────
    // res.on('finish') fires exactly once when the response is fully sent,
    // regardless of which branch below returns. This captures the true final
    // status code + wall-clock latency for the Live Traffic Inspector.
    const _trafficStart = Date.now();
    res.on('finish', () => {
      SessionStore.recordTraffic(sessionId, {
        id:        `evt-${_trafficStart}-${Math.random().toString(36).slice(2, 7)}`,
        ts:        new Date(_trafficStart).toISOString(),
        method,
        slug:      endpointSlug,
        status:    res.statusCode,
        latencyMs: Date.now() - _trafficStart,
        ip:        (req.headers['x-forwarded-for'] || req.ip || '').toString().split(',')[0].trim(),
      });
    });

    // ── 3 & 4. Resolve endpoint (session-isolated lookup) ────────────────
    const definition = MockResolver.resolve(sessionId, endpointSlug);

    if (!definition) {
      // Distinguish "session never existed / expired" from "slug not found".
      // MockResolver.resolve() returns null for both; inspect the store directly
      // to provide the most useful error code.
      const sessionExists = MockResolver.sessionExists(sessionId);

      return res.status(404).json({
        error: {
          code: sessionExists ? 'ENDPOINT_NOT_FOUND' : 'SESSION_NOT_FOUND',
          message: sessionExists
            ? `No endpoint '${endpointSlug}' found in session '${sessionId}'.`
            : `Session '${sessionId}' does not exist or has expired. Generate a mock API first via POST /api/generate.`,
          hint: 'Generate a mock API first via POST /api/generate',
        },
      });
    }

    // ── 5. Error Response Simulator ──────────────────────────────────────
    // When the frontend sends x-mockflow-force-status, short-circuit with a
    // realistic JSON error body matching that status code — useful for testing
    // client-side error boundaries without needing a real server error.
    const forceStatusRaw = req.headers['x-mockflow-force-status'];
    if (forceStatusRaw) {
      const forceStatus = parseInt(forceStatusRaw, 10);
      if (!isNaN(forceStatus) && forceStatus >= 400 && forceStatus <= 599) {
        const errorBodies = {
          400: { error: { code: 'BAD_REQUEST',          message: 'The request was malformed or missing required parameters.' } },
          401: { error: { code: 'UNAUTHORIZED',         message: 'Authentication is required to access this resource.',      detail: 'Missing or invalid Bearer token.' } },
          403: { error: { code: 'FORBIDDEN',            message: 'You do not have permission to perform this action.' } },
          404: { error: { code: 'NOT_FOUND',            message: `Resource '${endpointSlug}' could not be found.` } },
          409: { error: { code: 'CONFLICT',             message: 'The request conflicts with the current state of the resource.' } },
          422: { error: { code: 'UNPROCESSABLE_ENTITY', message: 'Validation failed.', fields: { id: 'must be a valid UUID' } } },
          429: { error: { code: 'RATE_LIMITED',         message: 'Too many requests. Please slow down.', retryAfter: 60 } },
          500: { error: { code: 'INTERNAL_SERVER_ERROR',message: 'An unexpected error occurred on the server.', requestId: `mf-${Date.now()}` } },
          502: { error: { code: 'BAD_GATEWAY',          message: 'The upstream service returned an invalid response.' } },
          503: { error: { code: 'SERVICE_UNAVAILABLE',  message: 'The service is temporarily unavailable. Try again later.' } },
        };
        const body = errorBodies[forceStatus] ?? {
          error: { code: `HTTP_${forceStatus}`, message: `Simulated ${forceStatus} error response.` },
        };
        res.setHeader('X-MockFlow-Session',       sessionId);
        res.setHeader('X-MockFlow-Slug',          endpointSlug);
        res.setHeader('X-MockFlow-Simulated-Error', String(forceStatus));
        return res.status(forceStatus).json(body);
      }
    }

    // ── 5b. Schema constraint validation (POST / PUT / PATCH) ────────────
    // Validate the incoming body against the resource schema's constraints
    // (minimum/maximum, minLength/maxLength, format:email/uuid, pattern, enum).
    // Only runs when a JSON body is present; unknown fields are permitted.
    // Bypass with header x-mockflow-skip-validation: true for raw testing.
    const skipValidation = String(req.headers['x-mockflow-skip-validation'] ?? '') === 'true';
    if (!skipValidation && ['POST', 'PUT', 'PATCH'].includes(method)
        && req.body && typeof req.body === 'object' && !Array.isArray(req.body)) {
      const resourceSchema = definition.responseSchema ?? definition.schema ?? {};
      const violations = validateAgainstSchema(req.body, resourceSchema);
      if (violations.length) {
        res.setHeader('X-MockFlow-Session', sessionId);
        res.setHeader('X-MockFlow-Slug',    endpointSlug);
        return res.status(422).json({
          error: {
            code:    'VALIDATION_FAILED',
            message: `${violations.length} field${violations.length !== 1 ? 's' : ''} failed schema validation.`,
            fields:  violations,
          },
        });
      }
    }

    // ── 6. Latency simulation ────────────────────────────────────────────
    const requestedDelay = parseInt(req.headers['x-mockflow-delay'] ?? '0', 10);
    const headerDelay    = !isNaN(requestedDelay) ? requestedDelay : 0;
    const endpointDelay  = definition.delayMs ?? 0;
    const totalDelay     = Math.min(Math.max(headerDelay, endpointDelay), 5000);

    if (totalDelay > 0) {
      await new Promise((resolve) => setTimeout(resolve, totalDelay));
    }

    // ── 6. Stateful Collection Engine ────────────────────────────────────
    //
    // For endpoints flagged isCollection:true, we maintain a live mutable
    // array keyed by the schema RESOURCE NAME (not the slug) so that all
    // slugs for the same resource share one buffer:
    //
    //   GET  /users-list       → reads   collections["User"]
    //   POST /create-user      → appends collections["User"]
    //   DELETE /users-delete   → splices collections["User"]
    //
    // This ensures that items POSTed via one slug are immediately visible
    // on the collection GET slug without any data loss.
    //
    // The resource key falls back to the slug when definition.resource is
    // absent, preserving backward compatibility.
    if (definition.isCollection) {
      // Canonical key shared across all CRUD slugs for this resource
      const collectionKey = (definition.resource ?? endpointSlug).toLowerCase();

      // ── GET — serve persisted array ──────────────────────────────────────
      if (method === 'GET') {
        // Always read the live buffer first — never fall through to DataGenerator
        let items = SessionStore.getCollection(sessionId, collectionKey);

        if (!items) {
          // First access — seed with 4 realistic items from DataGenerator
          const schema    = definition.responseSchema ?? definition.schema ?? { type: 'object' };
          const seedItems = Array.from({ length: 4 }, () => ({
            id: randomUUID(),
            ...generateValue(schema, '', 0),
          }));
          SessionStore.seedCollection(sessionId, collectionKey, seedItems);
          items = SessionStore.getCollection(sessionId, collectionKey);
        }

        // Honour ?count override
        const sliceCount = !isNaN(parseInt(req.query.count, 10))
          ? Math.min(parseInt(req.query.count, 10), 50)
          : null;

        const responseItems = sliceCount !== null ? items.slice(0, sliceCount) : items;

        res.setHeader('X-MockFlow-Session',      sessionId);
        res.setHeader('X-MockFlow-Slug',         endpointSlug);
        res.setHeader('X-MockFlow-Generated',    'true');
        res.setHeader('X-MockFlow-Collection',   'stateful');
        res.setHeader('X-MockFlow-Item-Count',   String(items.length));
        return res.status(200).json(responseItems);
      }

      // ── POST — append new item ────────────────────────────────────────────
      //
      // Persistence contract: the user's explicit body keys are AUTHORITATIVE
      // and are stored verbatim. Generated mock data only backfills fields the
      // caller did NOT provide, so it can never overwrite or type-coerce a
      // custom key. Any key the caller sends that is absent from the AI schema
      // vocabulary (e.g. `name`, `role`) is preserved exactly as received —
      // it bypasses every internal schema boundary and lands in storage as-is.
      if (method === 'POST') {
        const schema    = definition.responseSchema ?? definition.schema ?? { type: 'object' };
        const generated = generateValue(schema, '', 0);

        // Normalise the incoming payload to a plain object.
        const userBody  = (req.body && typeof req.body === 'object' && !Array.isArray(req.body))
          ? req.body
          : {};

        // Backfill generated defaults ONLY for keys the user did not supply,
        // then overlay the raw user body last so every custom key wins verbatim.
        const generatedDefaults = (generated && typeof generated === 'object' && !Array.isArray(generated))
          ? generated
          : {};

        const merged = { ...generatedDefaults, ...userBody };

        const newItem = SessionStore.appendToCollection(sessionId, collectionKey, merged);

        res.setHeader('X-MockFlow-Session',    sessionId);
        res.setHeader('X-MockFlow-Slug',       endpointSlug);
        res.setHeader('X-MockFlow-Generated',  'true');
        res.setHeader('X-MockFlow-Collection', 'stateful');
        res.setHeader('X-MockFlow-Item-Id',    newItem.id);
        return res.status(201).json(newItem);
      }

      // ── DELETE — remove item by id ────────────────────────────────────────
      if (method === 'DELETE') {
        // Accept id from: ?id=<uuid>  OR  req.body.id
        const itemId = req.query.id ?? req.body?.id ?? null;

        if (!itemId) {
          return res.status(400).json({
            error: {
              code:    'MISSING_ITEM_ID',
              message: 'Provide the item id via ?id=<uuid> query param or request body { id }.',
            },
          });
        }

        const removed = SessionStore.deleteFromCollection(sessionId, collectionKey, itemId);

        res.setHeader('X-MockFlow-Session',    sessionId);
        res.setHeader('X-MockFlow-Slug',       endpointSlug);
        res.setHeader('X-MockFlow-Collection', 'stateful');

        if (!removed) {
          return res.status(404).json({
            error: {
              code:    'ITEM_NOT_FOUND',
              message: `No item with id '${itemId}' found in collection '${collectionKey}'.`,
            },
          });
        }

        return res.status(204).end();
      }

      // PUT / PATCH on a collection — fall through to DataGenerator (single-item update)
    }

    // ── 7. Generate fake response (non-collection or PUT/PATCH) ──────────
    const countParam  = parseInt(req.query.count, 10);
    const count       = !isNaN(countParam) && countParam > 0
      ? Math.min(countParam, 50)
      : null;

    // ── Deterministic Seed Toggle ─────────────────────────────────────────
    // ?seed=true  → derive a numeric seed from sessionId + slug + method
    //               so the same request always returns identical data.
    // ?seed=<int> → use the caller-supplied integer directly as the seed.
    // Omitted / any other value → pure random (default behaviour).
    let seedOpts = {};
    const seedParam = req.query.seed;
    if (seedParam === 'true' || seedParam === '1') {
      const derivedSeed = seedFromKey(`${sessionId}:${endpointSlug}:${method}`);
      seedOpts = { seed: derivedSeed };
    } else {
      const parsedSeed = parseInt(seedParam, 10);
      if (!isNaN(parsedSeed)) seedOpts = { seed: parsedSeed };
    }

    const statusParam = parseInt(req.query.status, 10);
    const { status, body: generatedBody } = generateResponse(definition, method, count, seedOpts);
    const finalStatus = !isNaN(statusParam) && statusParam >= 100 && statusParam <= 599
      ? statusParam
      : status;

    // ── Body field override (POST / PUT / PATCH) ──────────────────────────
    // When the caller supplies a JSON body, deep-merge it over the generated
    // mock so that user-provided fields (e.g. `title`, `body`, `price`) appear
    // in the response verbatim, while unspecified fields retain realistic values.
    //
    // Merge only applies to single-object responses (isCollection=false).
    // Collection responses (arrays) are left untouched — merging user fields
    // into every array item would produce confusing duplicate data.
    const userBody = req.body;
    const hasUserBody = userBody
      && typeof userBody === 'object'
      && !Array.isArray(userBody)
      && Object.keys(userBody).length > 0;

    const MERGE_METHODS = ['POST', 'PUT', 'PATCH'];
    const body = hasUserBody && MERGE_METHODS.includes(method) && !Array.isArray(generatedBody)
      ? deepMerge(generatedBody, userBody)
      : generatedBody;

    // ── 7. Echo custom request headers ───────────────────────────────────
    // Any inbound header whose name starts with "x-custom-" or "x-mock-"
    // (case-insensitive) is echoed back as an "X-Echo-*" response header.
    // This lets the frontend's Headers Playground display round-trip proof
    // that custom headers reached the server.
    //
    // Security: keys are validated against a safe-name regex before being
    // used as header names — prevents CRLF injection through crafted keys.
    const SAFE_HEADER_RE = /^[a-zA-Z0-9\-_]+$/;
    for (const [hKey, hVal] of Object.entries(req.headers)) {
      const lower = hKey.toLowerCase();
      if (lower.startsWith('x-custom-') || lower.startsWith('x-mock-')) {
        const echoName = `X-Echo-${hKey}`;
        if (SAFE_HEADER_RE.test(echoName.replace(/:/g, ''))) {
          // Truncate long values to avoid exceeding header size limits
          res.setHeader(echoName, String(hVal).slice(0, 256));
        }
      }
    }

    // ── 8. Respond ───────────────────────────────────────────────────────
    // Header values are the validated (sanitised) versions — never raw user input.
    res.setHeader('X-MockFlow-Session',   sessionId);
    res.setHeader('X-MockFlow-Slug',      endpointSlug);
    res.setHeader('X-MockFlow-Generated', 'true');
    if (hasUserBody && MERGE_METHODS.includes(method) && !Array.isArray(generatedBody)) {
      res.setHeader('X-MockFlow-Body-Merged', 'true');
    }
    // Expose whether deterministic seed mode was active (handy for testing tools)
    if (seedOpts.seed != null) {
      res.setHeader('X-MockFlow-Seed', String(seedOpts.seed));
    }

    if (finalStatus === 204 || body === null) {
      return res.status(finalStatus).end();
    }

    return res.status(finalStatus).json(body);
  } catch (err) {
    next(err);
  }
};

// Register all five verbs
router.get('/:sessionId/:endpointSlug',    handleMock);
router.post('/:sessionId/:endpointSlug',   handleMock);
router.put('/:sessionId/:endpointSlug',    handleMock);
router.patch('/:sessionId/:endpointSlug',  handleMock);
router.delete('/:sessionId/:endpointSlug', handleMock);

export default router;
