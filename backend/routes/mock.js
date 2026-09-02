import { Router } from 'express';
import { MockResolver } from '../services/MockResolver.js';
import { generateResponse } from '../services/DataGenerator.js';

const router = Router();

/**
 * Wildcard dynamic mock handler.
 *
 * Matches:  /api/mock/:sessionId/:endpointSlug
 * Methods:  GET, POST, PUT, PATCH, DELETE
 *
 * Resolution order:
 *  1. Look up the endpoint definition from SessionStore via MockResolver.resolve()
 *  2. If not found → 404 with structured error
 *  3. Generate a fake response using DataGenerator.generateResponse()
 *  4. Apply optional latency simulation (x-mockflow-delay header, max 5000ms)
 *  5. Return the mock payload with correct status + Content-Type
 */
const handleMock = async (req, res, next) => {
  try {
    const { sessionId, endpointSlug } = req.params;
    const method = req.method.toUpperCase();

    // ── 1. Resolve endpoint definition ──────────────────────────────────────
    const definition = MockResolver.resolve(sessionId, endpointSlug);

    if (!definition) {
      return res.status(404).json({
        error: {
          code: 'ENDPOINT_NOT_FOUND',
          message: `No mock endpoint found for session '${sessionId}' with slug '${endpointSlug}'.`,
          hint: 'Generate a mock API first via POST /api/generate',
        },
      });
    }

    // ── 2. Latency simulation ────────────────────────────────────────────────
    const requestedDelay = parseInt(req.headers['x-mockflow-delay'] ?? '0', 10);
    const delayMs = Math.min(
      isNaN(requestedDelay) ? 0 : requestedDelay,
      5000,  // hard cap: 5 seconds
    );

    // Also honour any per-endpoint configured delay
    const endpointDelay = definition.delayMs ?? 0;
    const totalDelay = Math.min(delayMs || endpointDelay, 5000);

    if (totalDelay > 0) {
      await new Promise((resolve) => setTimeout(resolve, totalDelay));
    }

    // ── 3. Generate fake response ────────────────────────────────────────────
    //
    // Query-string overrides:
    //   ?count=N   → force array of N items
    //   ?status=N  → override HTTP status code
    const countParam = req.query.count ? parseInt(req.query.count, 10) : null;
    const count = countParam && !isNaN(countParam) ? Math.min(countParam, 50) : null;

    const { status, body } = generateResponse(definition, method, count);

    // Override status if caller explicitly requests it (useful for error testing)
    const statusParam = req.query.status ? parseInt(req.query.status, 10) : null;
    const finalStatus =
      statusParam && statusParam >= 100 && statusParam <= 599
        ? statusParam
        : status;

    // ── 4. Respond ───────────────────────────────────────────────────────────
    res.setHeader('X-MockFlow-Session', sessionId);
    res.setHeader('X-MockFlow-Slug', endpointSlug);
    res.setHeader('X-MockFlow-Generated', 'true');

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
