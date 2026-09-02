import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { MockResolver } from '../services/MockResolver.js';

const router = Router();

// ── Rate limiter: 10 generations / minute per IP (free-tier protection) ───────
const generateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many generation requests. Please wait a moment and try again.',
    },
  },
});

/**
 * POST /api/generate
 *
 * Guest-accessible — no authentication required.
 *
 * Body:   { prompt: string }
 * Headers read: x-mockflow-session (set by guestSessionMiddleware)
 *
 * Response:
 * {
 *   sessionId: string,
 *   apiName:   string,
 *   description: string,
 *   schema:    object,          // full JSON schema map by resource name
 *   endpoints: Endpoint[],      // registered endpoints with live mock URLs
 * }
 */
router.post('/', generateLimiter, async (req, res, next) => {
  try {
    const { prompt } = req.body;

    // ── Input validation ────────────────────────────────────────────────────
    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return res.status(400).json({
        error: {
          code: 'INVALID_PROMPT',
          message: 'A non-empty prompt string is required.',
        },
      });
    }

    if (prompt.trim().length > 1000) {
      return res.status(400).json({
        error: {
          code: 'PROMPT_TOO_LONG',
          message: 'Prompt must be 1000 characters or fewer.',
        },
      });
    }

    const sessionId = req.sessionId;

    // ── AI generation + SessionStore registration ──────────────────────────
    const result = await MockResolver.generate(sessionId, prompt.trim());

    return res.status(200).json({
      sessionId,
      apiName: result.apiName,
      description: result.description,
      schema: result.schema,
      endpoints: result.endpoints,
    });
  } catch (err) {
    // Surface Gemini / parsing errors without leaking internals in production
    const isKnown =
      err.message?.includes('GEMINI_API_KEY') ||
      err.message?.includes('non-JSON') ||
      err.message?.includes('no endpoints');

    if (isKnown) {
      return res.status(502).json({
        error: {
          code: 'AI_GENERATION_FAILED',
          message: err.message,
        },
      });
    }

    next(err); // delegate to global error handler
  }
});

export default router;
