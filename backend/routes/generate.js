import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { MockResolver } from '../services/MockResolver.js';
import { SessionStore } from '../services/SessionStore.js';

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

/**
 * POST /api/generate/edit
 *
 * Natural-language schema editing. Guest-accessible.
 *
 * Body: { instruction: string, schema: object, endpoints: Endpoint[] }
 * Returns the FULL updated definition + a change summary, or a 422 with a
 * clear message when the instruction is ambiguous/unmappable.
 */
router.post('/edit', generateLimiter, async (req, res, next) => {
  try {
    const { instruction, schema, endpoints } = req.body;

    if (!instruction || typeof instruction !== 'string' || instruction.trim().length === 0) {
      return res.status(400).json({
        error: { code: 'INVALID_INSTRUCTION', message: 'A non-empty instruction is required.' },
      });
    }
    if (instruction.trim().length > 500) {
      return res.status(400).json({
        error: { code: 'INSTRUCTION_TOO_LONG', message: 'Instruction must be 500 characters or fewer.' },
      });
    }
    if (!schema || typeof schema !== 'object' || Array.isArray(schema) || Object.keys(schema).length === 0) {
      return res.status(400).json({
        error: { code: 'NO_SCHEMA', message: 'Generate an API before editing its schema.' },
      });
    }

    const sessionId = req.sessionId;

    const result = await MockResolver.editSchema(
      sessionId,
      instruction.trim(),
      schema,
      Array.isArray(endpoints) ? endpoints : [],
    );

    return res.status(200).json({
      sessionId,
      apiName: result.apiName,
      description: result.description,
      schema: result.schema,
      endpoints: result.endpoints,
      changeSummary: result.changeSummary,
      affectedEndpoints: result.affectedEndpoints,
    });
  } catch (err) {
    // Ambiguous / unmappable instruction → 422 so the client can prompt a rephrase.
    if (err.code === 'AMBIGUOUS_INSTRUCTION') {
      return res.status(422).json({
        error: { code: 'AMBIGUOUS_INSTRUCTION', message: err.message },
      });
    }
    if (err.code === 'AI_UNAVAILABLE' || err.code === 'EDIT_FAILED') {
      return res.status(502).json({
        error: { code: err.code, message: err.message },
      });
    }
    next(err);
  }
});

/**
 * POST /api/generate/auth
 *
 * Auth-simulation control for the current session. Guest-accessible.
 *
 * Body: { action: 'get' | 'enable' | 'disable' | 'regenerate' }
 * Returns: { enabled, apiKey, token }  (credentials are always returned so the
 *          client can display/copy them regardless of the enabled state).
 */
router.post('/auth', (req, res) => {
  const sessionId = req.sessionId;
  const action = String(req.body?.action ?? 'get').toLowerCase();

  let auth;
  switch (action) {
    case 'enable':     auth = SessionStore.setAuthEnabled(sessionId, true);  break;
    case 'disable':    auth = SessionStore.setAuthEnabled(sessionId, false); break;
    case 'regenerate': auth = SessionStore.regenerateAuth(sessionId);        break;
    case 'get':        auth = SessionStore.getAuth(sessionId);               break;
    default:
      return res.status(400).json({
        error: { code: 'INVALID_ACTION', message: "action must be one of: get, enable, disable, regenerate." },
      });
  }

  return res.status(200).json({
    sessionId,
    enabled: auth.enabled,
    apiKey:  auth.apiKey,
    token:   auth.token,
  });
});

/**
 * POST /api/generate/tests
 *
 * Generate an automated QA test suite for the current session's mock API.
 * Guest-accessible. Returns test cases with deterministically-computed expected
 * outcomes; the frontend executes them against the real mock endpoints.
 */
router.post('/tests', generateLimiter, async (req, res, next) => {
  try {
    const sessionId = req.sessionId;
    const result = await MockResolver.generateTests(sessionId);
    return res.status(200).json({
      sessionId,
      cases:       result.cases,
      authEnabled: result.authEnabled,
      count:       result.cases.length,
    });
  } catch (err) {
    if (err.code === 'NO_ENDPOINTS') {
      return res.status(400).json({ error: { code: 'NO_ENDPOINTS', message: err.message } });
    }
    next(err);
  }
});

export default router;
