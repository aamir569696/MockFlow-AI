import { Router } from 'express';
import { SessionStore } from '../services/SessionStore.js';

const router = Router();

// UUID v4 validator (same pattern as the mock resolver)
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * GET /api/traffic/:sessionId
 *
 * Returns the Live Traffic event log for a session — consumed by the
 * dashboard's Webhook Inspector via short-interval polling.
 *
 * Query params:
 *   ?since=<eventId>   → return only events newer than this id (delta poll)
 *
 * Response:
 * {
 *   sessionId: string,
 *   events:    [{ id, ts, method, slug, status, latencyMs, ip }],
 *   total:     number,   // total events currently retained (max 100)
 *   polledAt:  string
 * }
 */
router.get('/:sessionId', (req, res) => {
  const sessionId = String(req.params.sessionId || '').trim().toLowerCase();

  if (!UUID_RE.test(sessionId)) {
    return res.status(400).json({
      error: { code: 'INVALID_SESSION_ID', message: 'Session ID must be a valid UUID v4.' },
    });
  }

  const since = req.query.since ? String(req.query.since) : null;
  const { events, total } = SessionStore.getTraffic(sessionId, since);

  return res.status(200).json({
    sessionId,
    events,
    total,
    polledAt: new Date().toISOString(),
  });
});

export default router;
