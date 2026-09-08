import { Router } from 'express';
import { SessionStore } from '../services/SessionStore.js';
import { SessionPersistence } from '../services/SessionPersistence.js';
import { MockResolver } from '../services/MockResolver.js';
import { generateValue } from '../services/DataGenerator.js';

const router = Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Build a representative sample value from a resource schema. For collection
 * GETs we return a small array; otherwise a single object. Mirrors what the
 * live mock endpoint would return so the docs match reality.
 */
function sampleForEndpoint(def) {
  const schema = def.responseSchema || def.schema || { type: 'object', properties: {} };
  const one = () => generateValue(schema, '', 0);
  if (def.isCollection && (def.method === 'GET')) {
    return [one(), one(), one()];
  }
  if (def.method === 'DELETE') return null;
  return one();
}

/**
 * Build an example request body for mutating verbs (POST/PUT/PATCH) from the
 * resource schema, omitting server-managed fields.
 */
function sampleRequestBody(def) {
  if (!['POST', 'PUT', 'PATCH'].includes(def.method)) return null;
  const props = (def.schema || def.responseSchema || {}).properties || {};
  const OMIT = new Set(['id', 'createdAt', 'updatedAt', 'deletedAt']);
  const body = {};
  for (const [field, spec] of Object.entries(props)) {
    if (OMIT.has(field)) continue;
    body[field] = generateValue(spec, field, 0);
  }
  return Object.keys(body).length ? body : null;
}

/**
 * GET /api/docs/:sessionId
 *
 * PUBLIC, unauthenticated, read-only. Returns everything a standalone docs
 * page needs. Regenerated on each view from the current session state, so it
 * reflects live schema edits automatically.
 */
router.get('/:sessionId', async (req, res) => {
  const sessionId = String(req.params.sessionId || '').toLowerCase();

  if (!UUID_RE.test(sessionId)) {
    return res.status(400).json({
      error: { code: 'INVALID_SESSION_ID', message: 'Session ID must be a valid UUID v4.' },
    });
  }

  // Cold-start rehydration: if this instance has no record of the session,
  // rebuild it from trusted MongoDB storage so shared/public docs links survive
  // a serverless recycle. Gated on MONGO_URI + error-isolated.
  if (!MockResolver.sessionExists(sessionId) && SessionPersistence.enabled()) {
    await SessionPersistence.hydrateSession(sessionId);
  }

  const meta = SessionStore.getMeta(sessionId);
  const endpoints = SessionStore.getAllEndpoints(sessionId);

  if (!endpoints.length && !meta) {
    return res.status(404).json({
      error: {
        code: 'DOCS_NOT_FOUND',
        message: 'No published API found for this link. It may have expired or never been generated.',
      },
    });
  }

  const schema = meta?.schema ?? {};

  // Group endpoints by resource for a clean, sectioned docs layout.
  const docsEndpoints = endpoints
    .map((def) => {
      const base = `/api/mock/${sessionId}/${def.slug}`;
      const requestBody = sampleRequestBody(def);
      return {
        slug:         def.slug,
        method:       def.method,
        description:  def.description || '',
        resource:     def.resource || 'General',
        isCollection: !!def.isCollection,
        path:         base,
        fields:       Object.entries((def.schema || {}).properties || {}).map(([name, spec]) => ({
          name,
          type:        spec.type ?? 'string',
          format:      spec.format ?? null,
          description: spec.description ?? '',
        })),
        requestBody,
        sampleResponse: sampleForEndpoint(def),
      };
    })
    // Stable ordering: by resource, then GET/POST/PUT/PATCH/DELETE.
    .sort((a, b) => {
      if (a.resource !== b.resource) return a.resource.localeCompare(b.resource);
      const order = { GET: 0, POST: 1, PUT: 2, PATCH: 3, DELETE: 4 };
      return (order[a.method] ?? 9) - (order[b.method] ?? 9);
    });

  // Auth-simulation state — surfaced (without the secret) so the docs page and
  // SDK snippets can show the required auth header. We DO expose the token here
  // because these are non-sensitive simulation credentials for a public demo
  // sandbox; treat accordingly (never reuse this pattern for real secrets).
  const authCfg = SessionStore.getAuth(sessionId);
  const auth = authCfg?.enabled
    ? {
        enabled:    true,
        scheme:     'bearer',              // primary scheme shown in examples
        headerName: 'Authorization',
        headerValue:`Bearer ${authCfg.token}`,
        apiKeyHeader: 'x-api-key',
        apiKey:     authCfg.apiKey,
        token:      authCfg.token,
      }
    : { enabled: false };

  return res.status(200).json({
    sessionId,
    apiName:     meta?.apiName ?? 'Mock API',
    description: meta?.description ?? '',
    schema,
    resources:   Object.keys(schema),
    endpoints:   docsEndpoints,
    auth,
    generatedAt: new Date().toISOString(),
  });
});

export default router;
