import { Router } from 'express';
import { MockResolver } from '../services/MockResolver.js';
import { generateResponse, seedFromKey } from '../services/DataGenerator.js';

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

    // ── 6. Latency simulation ────────────────────────────────────────────
    const requestedDelay = parseInt(req.headers['x-mockflow-delay'] ?? '0', 10);
    const headerDelay    = !isNaN(requestedDelay) ? requestedDelay : 0;
    const endpointDelay  = definition.delayMs ?? 0;
    const totalDelay     = Math.min(Math.max(headerDelay, endpointDelay), 5000);

    if (totalDelay > 0) {
      await new Promise((resolve) => setTimeout(resolve, totalDelay));
    }

    // ── 6. Generate fake response ────────────────────────────────────────
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
