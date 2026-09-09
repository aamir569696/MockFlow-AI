import { GoogleGenerativeAI } from '@google/generative-ai';
import { SessionStore } from './SessionStore.js';
import { SessionPersistence } from './SessionPersistence.js';
import { generateValue, validateAgainstSchema } from './DataGenerator.js';

// ── Gemini client (lazy init) ─────────────────────────────────────────────────
let _gemini = null;
function getModel() {
  if (!_gemini) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY is not set in environment.');
    _gemini = new GoogleGenerativeAI(apiKey).getGenerativeModel({
      model: 'gemini-3.6-flash',
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.4,
        maxOutputTokens: 2048,
      },
    });
  }
  return _gemini;
}

// ── System prompt ─────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are a REST API schema designer.
Given a plain-English description of an API, respond with ONLY valid JSON — no markdown, no explanation.

The JSON must match this exact structure:
{
  "apiName": "string — short name for the API",
  "description": "string — one sentence description",
  "schema": {
    "<ResourceName>": {
      "type": "object",
      "properties": {
        "<fieldName>": { "type": "<json-schema-type>", "format": "<optional format>", "description": "<optional>" }
      }
    }
  },
  "endpoints": [
    {
      "slug": "string — URL-safe path segment, e.g. 'users' or 'posts-list'",
      "method": "GET | POST | PUT | PATCH | DELETE",
      "description": "string — what this endpoint does",
      "resource": "string — which schema resource this returns",
      "isCollection": true | false
    }
  ]
}

Rules:
- Generate 3–6 endpoints covering typical CRUD operations.
- slug values must be lowercase, hyphen-separated, URL-safe (no slashes).
- Use standard JSON Schema types: string, number, integer, boolean, array, object.
- Use format hints where helpful: date-time, email, uuid, uri, date, phone.
- Every endpoint must reference a resource defined in schema.

OUTPUT FORMAT (ABSOLUTE):
- Respond with a SINGLE raw, minified JSON object and NOTHING else.
- Do NOT wrap it in markdown code fences (no \`\`\`, no \`\`\`json).
- Do NOT include any prose, explanation, headers, or conversational tokens before or after the JSON.
- Do NOT include trailing commas. Use standard ASCII double quotes only.
- The very first character of your response must be "{" and the very last must be "}".`;

// ── Edit system prompt (natural-language schema editing) ──────────────────────
const EDIT_SYSTEM_PROMPT = `You are a REST API schema editor.
You are given an existing API's CURRENT_SCHEMA, its CURRENT_ENDPOINTS, and a plain-English USER_INSTRUCTION describing a change.

Apply the instruction to the schema/endpoints and respond with ONLY valid JSON — no markdown, no explanation.

On SUCCESS respond with the FULL updated definition in this exact structure:
{
  "apiName": "string — keep the existing name unless the instruction changes it",
  "description": "string — one sentence",
  "schema": { "<ResourceName>": { "type": "object", "properties": { "<field>": { "type": "<json-schema-type>", "format": "<optional>", "description": "<optional>" } } } },
  "endpoints": [ { "slug": "string", "method": "GET|POST|PUT|PATCH|DELETE", "description": "string", "resource": "string", "isCollection": true|false } ],
  "changeSummary": "string — short human summary, e.g. 'Added discount (number) to Product'",
  "affectedEndpoints": ["slug1", "slug2"]
}

If the instruction is ambiguous, nonsensical, unrelated to editing an API schema, or you cannot confidently apply it, respond ONLY with:
{ "ok": false, "error": "short reason and a suggestion to rephrase" }

Rules:
- PRESERVE everything not mentioned by the instruction. Return the complete schema and endpoint set, not just the delta.
- Keep slugs lowercase, hyphen-separated, URL-safe. Keep existing slugs stable unless the instruction renames a resource.
- Use standard JSON Schema types. Use format hints where helpful (email, uuid, date-time, uri, phone).
- Every endpoint must reference a resource that exists in schema.
- changeSummary must accurately describe what actually changed.

OUTPUT FORMAT (ABSOLUTE):
- Respond with a SINGLE raw, minified JSON object and NOTHING else.
- Do NOT wrap it in markdown code fences (no \`\`\`, no \`\`\`json).
- Do NOT include any prose, explanation, headers, or conversational tokens before or after the JSON.
- Do NOT include trailing commas. Use standard ASCII double quotes only.
- The very first character of your response must be "{" and the very last must be "}".`;

// ── Test-suite system prompt (AI QA test-case generation) ─────────────────────
const TESTGEN_SYSTEM_PROMPT = `You are a senior QA engineer generating an automated test suite for a mock REST API.
You are given the API's resource SCHEMA and its ENDPOINTS. Produce 10–15 realistic, VARIED test cases.

Respond with ONLY valid JSON in this exact shape:
{
  "cases": [
    {
      "description": "string — short human summary, e.g. \\"POST /products with wrong type for 'price'\\"",
      "category": "valid | invalid_type | missing_field | edge_case | invalid_id | auth",
      "slug": "string — MUST be one of the provided endpoint slugs",
      "method": "GET | POST | PUT | PATCH | DELETE — MUST match that endpoint",
      "body": { } | null,
      "query": { } | null,
      "useAuth": true | false
    }
  ]
}

Coverage requirements (mix across the endpoints provided):
- Several VALID requests (correct data/types) — category "valid".
- INVALID TYPE cases — send a wrong type for a field (e.g. a string where a number is expected) — category "invalid_type".
- MISSING FIELD cases — omit a field from the body — category "missing_field".
- EDGE CASES — empty strings, very long strings, negative numbers, zero, boundary values — category "edge_case".
- INVALID ID — for GET/PUT/PATCH/DELETE style endpoints, use a clearly non-existent id — category "invalid_id".
- If AUTH is enabled (told below), include cases with useAuth=false (expecting rejection) AND useAuth=true (expecting success) — category "auth".

Rules:
- Only use slugs/methods from the provided ENDPOINTS. Bodies must use fields from that resource's schema.
- Keep bodies realistic and minimal. Do not invent endpoints.
- Do NOT include an expected status code — the test harness computes the real expected outcome itself.

OUTPUT FORMAT (ABSOLUTE):
- Respond with a SINGLE raw, minified JSON object and NOTHING else. No markdown, no code fences, no prose.
- The very first character must be "{" and the very last must be "}".`;

// ── JSON parser (robust against Gemini quirks) ────────────────────────────────
/**
 * safeParseJSON — extract and parse a JSON object from raw model text.
 *
 * Defends against the common ways an LLM breaks JSON.parse():
 *   • ```json … ``` / ``` … ``` markdown fences (anywhere, not just edges)
 *   • <think>…</think> reasoning blocks (reasoning-model output)
 *   • Leading/trailing conversational prose around the object
 *   • Smart/“curly” quotes substituted for ASCII quotes
 *   • Trailing commas before } or ] (repaired as a last resort)
 *
 * Throws only if, after all cleaning, no valid JSON object can be parsed.
 */
function safeParseJSON(text) {
  let cleaned = String(text ?? '');

  // 1. Strip <think>…</think> reasoning blocks first (may contain braces).
  cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, '');

  // 2. Remove ALL markdown code-fence markers anywhere in the text
  //    (```json, ``` , ~~~), not just at the string boundaries.
  cleaned = cleaned
    .replace(/```(?:json|javascript|js)?/gi, '')
    .replace(/```/g, '')
    .replace(/~~~(?:json)?/gi, '')
    .replace(/~~~/g, '')
    .trim();

  // 3. Slice to the outermost JSON object, dropping any surrounding prose
  //    ("Here is the updated schema:" … or a trailing note).
  const start = cleaned.indexOf('{');
  const end   = cleaned.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    cleaned = cleaned.slice(start, end + 1);
  }

  // 4. Normalise smart quotes the model sometimes emits.
  cleaned = cleaned
    .replace(/[\u201C\u201D]/g, '"')   // “ ”  → "
    .replace(/[\u2018\u2019]/g, "'");  // ‘ ’  → '

  // 5. First attempt — clean JSON.
  try {
    return JSON.parse(cleaned);
  } catch (firstErr) {
    // 6. Last-resort repair: strip trailing commas before } or ] and retry.
    const repaired = cleaned.replace(/,(\s*[}\]])/g, '$1');
    try {
      return JSON.parse(repaired);
    } catch {
      // Surface the original error for accurate diagnostics upstream.
      throw firstErr;
    }
  }
}

/**
 * safeStringify — defensive JSON serialisation for prompt embedding.
 *
 * Guards the (rare) case where an in-memory schema/endpoint object is cyclic or
 * otherwise non-serialisable, which would throw inside the prompt template and
 * abort the request before it reaches the model. Falls back to a shallow,
 * cycle-tolerant serialisation so the edit can still proceed.
 *
 * Note: JSON.stringify ALREADY escapes quotes, brackets and newlines, so the
 * embedded schema is always well-formed text inside the prompt string. No extra
 * regex quote-stripping is needed (and stripping quotes would corrupt valid
 * JSON) — this helper only adds crash-safety, not character mangling.
 */
function safeStringify(value) {
  try {
    return JSON.stringify(value ?? {}, null, 2);
  } catch {
    // Cyclic or non-serialisable — strip cycles and retry.
    const seen = new WeakSet();
    try {
      return JSON.stringify(value ?? {}, (_k, v) => {
        if (v && typeof v === 'object') {
          if (seen.has(v)) return '[Circular]';
          seen.add(v);
        }
        return v;
      }, 2);
    } catch {
      return '{}';
    }
  }
}

// ── Slug sanitiser ────────────────────────────────────────────────────────────
function sanitiseSlug(raw = '') {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64) || 'endpoint';
}

// ─────────────────────────────────────────────────────────────────────────────
// LOCAL FALLBACK ENGINE
// Runs when Gemini is unavailable (503, network error, parse failure, etc.)
// Produces a realistic schema + endpoints from the prompt text alone.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Common developer field vocabulary — keyed by semantic category.
 * Each entry is a JSON Schema property definition.
 */
const FIELD_VOCAB = {
  id:          { type: 'string',  format: 'uuid',      description: 'Unique identifier' },
  name:        { type: 'string',                        description: 'Full name' },
  firstName:   { type: 'string',                        description: 'First name' },
  lastName:    { type: 'string',                        description: 'Last name' },
  email:       { type: 'string',  format: 'email',     description: 'Email address' },
  phone:       { type: 'string',  format: 'phone',     description: 'Phone number' },
  password:    { type: 'string',                        description: 'Hashed password' },
  role:        { type: 'string',  enum: ['admin', 'user', 'moderator', 'guest'] },
  status:      { type: 'string',  enum: ['active', 'inactive', 'pending', 'archived'] },
  price:       { type: 'number',                        description: 'Price in USD' },
  amount:      { type: 'number',                        description: 'Monetary amount' },
  quantity:    { type: 'integer',                       description: 'Item quantity' },
  rating:      { type: 'number',  minimum: 0, maximum: 5, description: 'Rating score' },
  title:       { type: 'string',                        description: 'Title or heading' },
  description: { type: 'string',                        description: 'Detailed description' },
  body:        { type: 'string',                        description: 'Main content body' },
  content:     { type: 'string',                        description: 'Text content' },
  slug:        { type: 'string',                        description: 'URL-safe identifier' },
  url:         { type: 'string',  format: 'uri',        description: 'Resource URL' },
  imageUrl:    { type: 'string',  format: 'uri',        description: 'Image URL' },
  avatar:      { type: 'string',  format: 'uri',        description: 'Avatar image URL' },
  tags:        { type: 'array',   items: { type: 'string' }, description: 'Tag list' },
  category:    { type: 'string',                        description: 'Category name' },
  isActive:    { type: 'boolean',                       description: 'Active flag' },
  isPublic:    { type: 'boolean',                       description: 'Public visibility flag' },
  isVerified:  { type: 'boolean',                       description: 'Verification status' },
  createdAt:   { type: 'string',  format: 'date-time', description: 'Creation timestamp' },
  updatedAt:   { type: 'string',  format: 'date-time', description: 'Last update timestamp' },
  deletedAt:   { type: 'string',  format: 'date-time', description: 'Deletion timestamp' },
  ownerId:     { type: 'string',  format: 'uuid',      description: 'Owner user ID' },
  userId:      { type: 'string',  format: 'uuid',      description: 'Associated user ID' },
  token:       { type: 'string',                        description: 'Auth or session token' },
  metadata:    { type: 'object',                        description: 'Arbitrary metadata' },
  address:     { type: 'string',                        description: 'Street address' },
  city:        { type: 'string',                        description: 'City' },
  country:     { type: 'string',                        description: 'Country code' },
  zipCode:     { type: 'string',                        description: 'Postal / ZIP code' },
  lat:         { type: 'number',  format: 'float',     description: 'Latitude' },
  lng:         { type: 'number',  format: 'float',     description: 'Longitude' },
  score:       { type: 'integer',                       description: 'Numeric score' },
  count:       { type: 'integer',                       description: 'Item count' },
  total:       { type: 'integer',                       description: 'Total count' },
  currency:    { type: 'string',  enum: ['USD', 'EUR', 'GBP', 'JPY'], description: 'Currency code' },
};

/**
 * Resource-type → suggested fields mapping.
 * Used to select a coherent field set when we detect a resource keyword.
 */
const RESOURCE_FIELD_MAP = {
  user:        ['id', 'firstName', 'lastName', 'email', 'phone', 'role', 'status', 'avatar', 'isVerified', 'createdAt', 'updatedAt'],
  account:     ['id', 'email', 'role', 'status', 'isActive', 'token', 'createdAt', 'updatedAt'],
  post:        ['id', 'title', 'body', 'slug', 'status', 'imageUrl', 'tags', 'ownerId', 'createdAt', 'updatedAt'],
  article:     ['id', 'title', 'content', 'slug', 'category', 'imageUrl', 'tags', 'isPublic', 'ownerId', 'createdAt', 'updatedAt'],
  comment:     ['id', 'body', 'userId', 'isActive', 'createdAt', 'updatedAt'],
  product:     ['id', 'name', 'description', 'price', 'currency', 'quantity', 'imageUrl', 'category', 'status', 'rating', 'createdAt'],
  order:       ['id', 'status', 'total', 'currency', 'userId', 'address', 'city', 'country', 'createdAt', 'updatedAt'],
  item:        ['id', 'name', 'description', 'price', 'quantity', 'status', 'createdAt'],
  review:      ['id', 'title', 'body', 'rating', 'userId', 'isVerified', 'createdAt'],
  category:    ['id', 'name', 'description', 'slug', 'isActive', 'createdAt'],
  tag:         ['id', 'name', 'slug'],
  customer:    ['id', 'firstName', 'lastName', 'email', 'phone', 'address', 'city', 'country', 'createdAt'],
  employee:    ['id', 'firstName', 'lastName', 'email', 'phone', 'role', 'status', 'createdAt'],
  task:        ['id', 'title', 'description', 'status', 'userId', 'isActive', 'createdAt', 'updatedAt'],
  project:     ['id', 'name', 'description', 'status', 'ownerId', 'tags', 'createdAt', 'updatedAt'],
  message:     ['id', 'body', 'userId', 'isRead', 'createdAt'],
  event:       ['id', 'title', 'description', 'status', 'url', 'imageUrl', 'createdAt', 'updatedAt'],
  booking:     ['id', 'status', 'userId', 'total', 'currency', 'createdAt', 'updatedAt'],
  reservation: ['id', 'status', 'userId', 'createdAt', 'updatedAt'],
  hotel:       ['id', 'name', 'description', 'address', 'city', 'country', 'rating', 'imageUrl'],
  room:        ['id', 'name', 'description', 'price', 'currency', 'status', 'isActive'],
  payment:     ['id', 'amount', 'currency', 'status', 'userId', 'createdAt'],
  invoice:     ['id', 'total', 'currency', 'status', 'userId', 'createdAt'],
  file:        ['id', 'name', 'url', 'slug', 'userId', 'createdAt'],
  image:       ['id', 'title', 'url', 'userId', 'createdAt'],
  location:    ['id', 'name', 'address', 'city', 'country', 'lat', 'lng'],
  notification:['id', 'title', 'body', 'isActive', 'userId', 'createdAt'],
  session:     ['id', 'token', 'userId', 'isActive', 'createdAt', 'updatedAt'],
  setting:     ['id', 'name', 'description', 'isActive', 'metadata'],
  report:      ['id', 'title', 'description', 'status', 'userId', 'createdAt'],
  analytics:   ['id', 'score', 'count', 'total', 'createdAt'],
  follower:    ['id', 'userId', 'isActive', 'createdAt'],
  like:        ['id', 'userId', 'isActive', 'createdAt'],
};

/** Default fields used when no resource keyword matches */
const DEFAULT_FIELDS = ['id', 'name', 'description', 'status', 'isActive', 'createdAt', 'updatedAt'];

/**
 * Extract likely resource names from the prompt.
 * Looks for plural/singular nouns that match our RESOURCE_FIELD_MAP.
 */
function extractResources(prompt) {
  const words = prompt.toLowerCase().match(/\b[a-z]{3,}\b/g) ?? [];
  const found = new Set();

  for (const word of words) {
    // Direct match
    if (RESOURCE_FIELD_MAP[word]) { found.add(word); continue; }
    // Plurals: strip trailing 's' or 'es'
    if (word.endsWith('ies')) {
      const singular = word.slice(0, -3) + 'y';
      if (RESOURCE_FIELD_MAP[singular]) { found.add(singular); continue; }
    }
    if (word.endsWith('es') && RESOURCE_FIELD_MAP[word.slice(0, -2)]) {
      found.add(word.slice(0, -2)); continue;
    }
    if (word.endsWith('s') && RESOURCE_FIELD_MAP[word.slice(0, -1)]) {
      found.add(word.slice(0, -1)); continue;
    }
  }

  // Always ensure at least one resource
  if (found.size === 0) found.add('item');
  // Cap at 3 resources for clean output
  return [...found].slice(0, 3);
}

/**
 * Capitalise first letter.
 */
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Build a full MockResolver-compatible payload locally from the prompt.
 * Never calls any external service.
 */
function buildLocalFallback(prompt) {
  const resources = extractResources(prompt);

  // Build the schema map
  const schema = {};
  for (const resource of resources) {
    const fieldKeys = RESOURCE_FIELD_MAP[resource] ?? DEFAULT_FIELDS;
    const properties = {};
    for (const key of fieldKeys) {
      if (FIELD_VOCAB[key]) properties[key] = { ...FIELD_VOCAB[key] };
    }
    schema[cap(resource)] = { type: 'object', properties };
  }

  // Build endpoints for each resource (list + create + get-by-id + update + delete)
  const endpoints = [];
  for (const resource of resources) {
    const ResourceName = cap(resource);
    const plural = resource + 's';

    endpoints.push(
      { slug: plural,           method: 'GET',    description: `List all ${plural}`,         resource: ResourceName, isCollection: true  },
      { slug: plural,           method: 'POST',   description: `Create a new ${resource}`,   resource: ResourceName, isCollection: false },
      { slug: `${plural}-by-id`,method: 'GET',    description: `Get ${resource} by ID`,      resource: ResourceName, isCollection: false },
      { slug: `${plural}-update`,method: 'PUT',   description: `Update a ${resource}`,       resource: ResourceName, isCollection: false },
      { slug: `${plural}-delete`,method: 'DELETE',description: `Delete a ${resource}`,       resource: ResourceName, isCollection: false },
    );
  }

  // Derive a friendly API name from the prompt (first 5 significant words)
  const apiName = prompt
    .replace(/[^a-zA-Z\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 2)
    .slice(0, 4)
    .map(cap)
    .join(' ') + ' API';

  return {
    apiName,
    description: `A RESTful mock API generated from: "${prompt.slice(0, 80)}"`,
    schema,
    endpoints,
    _fallback: true,   // internal flag — not sent to frontend
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST-SUITE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * computeExpected — determine the status a test case will REALLY get, using the
 * exact rules the live mock route (routes/mock.js) enforces. Keeping this in
 * lockstep with the route is what makes pass/fail honest rather than idealised.
 *
 * Order mirrors the route: auth gate → schema validation → collection id rules.
 */
function computeExpected({ ep, method, body, query, authEnabled, useAuth }) {
  // 1. Auth gate — checked before anything else on the route.
  if (authEnabled && !useAuth) {
    return { expectedStatus: 401, expectedOutcome: 'Rejected — missing/invalid credential' };
  }

  // 2. Schema validation (POST/PUT/PATCH with a JSON body).
  if (['POST', 'PUT', 'PATCH'].includes(method) && body && typeof body === 'object') {
    const resourceSchema = ep.responseSchema ?? ep.schema ?? {};
    const violations = validateAgainstSchema(body, resourceSchema);
    if (violations.length) {
      return { expectedStatus: 422, expectedOutcome: 'Validation error (422)' };
    }
  }

  // 3. Collection id rules for DELETE. With no explicit id the route falls back
  //    to deleting the first item of the (seeded, non-empty) collection → 204.
  //    A random/invalid id won't exist → 404.
  if (method === 'DELETE') {
    const itemId = query?.id ?? body?.id ?? null;
    if (!itemId) return { expectedStatus: 204, expectedOutcome: 'Deletes first item (204)' };
    return { expectedStatus: 404, expectedOutcome: 'Item not found (404)' };
  }

  // 4. Otherwise the mock returns a normal success payload.
  const ok = method === 'POST' ? 201 : 200;
  return { expectedStatus: ok, expectedOutcome: `Success (${ok})` };
}

/**
 * buildLocalTestIntents — deterministic, VARIED test cases from the schema when
 * the AI is unavailable. Produces valid / invalid-type / missing-field /
 * edge-case / invalid-id / auth intents so the suite is meaningful offline.
 */
function buildLocalTestIntents(endpoints, schema, authEnabled) {
  const intents = [];

  const resourceOf = (ep) => ep.resource ?? Object.keys(schema)[0];
  const propsOf    = (ep) => (schema[resourceOf(ep)]?.properties) ?? {};
  const validBody  = (ep) => {
    const rs = schema[resourceOf(ep)] ?? { type: 'object', properties: {} };
    const v = generateValue(rs, '', 0);
    if (v && typeof v === 'object') delete v.id;   // server assigns id
    return v ?? {};
  };

  const writes = endpoints.filter((e) => ['POST', 'PUT', 'PATCH'].includes(e.method));
  const gets   = endpoints.filter((e) => e.method === 'GET');
  const deletes= endpoints.filter((e) => e.method === 'DELETE');

  // Auth cases FIRST when enabled, so the 15-case cap never drops them.
  if (authEnabled && (writes[0] || gets[0])) {
    const target = gets[0] ?? writes[0];
    const authBody = target.method === 'GET' ? null : validBody(target);
    intents.push({ description: `${target.method} /${target.slug} WITHOUT a token (expect 401)`, category: 'auth', slug: target.slug, method: target.method, body: authBody, useAuth: false });
    intents.push({ description: `${target.method} /${target.slug} WITH a valid token`, category: 'auth', slug: target.slug, method: target.method, body: authBody, useAuth: true });
  }

  // Valid reads.
  for (const ep of gets.slice(0, 2)) {
    intents.push({ description: `GET /${ep.slug} returns data`, category: 'valid', slug: ep.slug, method: 'GET', body: null, useAuth: true });
  }

  // Valid + invalid + missing + edge writes.
  for (const ep of writes.slice(0, 3)) {
    const props = propsOf(ep);
    const keys  = Object.keys(props).filter((k) => k !== 'id');

    // Valid create.
    intents.push({ description: `${ep.method} /${ep.slug} with valid data`, category: 'valid', slug: ep.slug, method: ep.method, body: validBody(ep), useAuth: true });

    // Invalid type — flip a numeric/boolean field to a string.
    const numKey = keys.find((k) => ['number', 'integer', 'boolean'].includes(props[k]?.type));
    if (numKey) {
      const bad = validBody(ep); bad[numKey] = 'not-a-valid-value';
      intents.push({ description: `${ep.method} /${ep.slug} with wrong type for '${numKey}'`, category: 'invalid_type', slug: ep.slug, method: ep.method, body: bad, useAuth: true });
    }

    // Missing field — drop the first field.
    if (keys.length) {
      const drop = validBody(ep); delete drop[keys[0]];
      intents.push({ description: `${ep.method} /${ep.slug} missing '${keys[0]}'`, category: 'missing_field', slug: ep.slug, method: ep.method, body: drop, useAuth: true });
    }

    // Edge case — empty string / very long string / negative number.
    const strKey = keys.find((k) => props[k]?.type === 'string');
    const edge = validBody(ep);
    if (strKey) edge[strKey] = '';
    if (numKey && props[numKey]?.type !== 'boolean') edge[numKey] = -999999;
    intents.push({ description: `${ep.method} /${ep.slug} with edge-case values`, category: 'edge_case', slug: ep.slug, method: ep.method, body: edge, useAuth: true });
  }

  // Invalid id — DELETE with a clearly non-existent id (expect 404).
  // Plus the no-id fallback — deletes the first item in the collection (204).
  for (const ep of deletes.slice(0, 1)) {
    intents.push({ description: `DELETE /${ep.slug} with a non-existent id`, category: 'invalid_id', slug: ep.slug, method: 'DELETE', query: { id: '00000000-0000-4000-8000-000000000000' }, useAuth: true });
    intents.push({ description: `DELETE /${ep.slug} with no id (deletes first item)`, category: 'edge_case', slug: ep.slug, method: 'DELETE', body: null, useAuth: true });
  }

  return intents;
}

// ─────────────────────────────────────────────────────────────────────────────
// LOCAL SCHEMA REFINER (rate-limit / AI-failure fallback)
// ─────────────────────────────────────────────────────────────────────────────

/** Map a plain-English type word to a JSON-Schema property spec. */
function specForTypeWord(word = '') {
  const w = word.toLowerCase().trim();
  const map = {
    number:   { type: 'number' },
    float:    { type: 'number' },
    decimal:  { type: 'number' },
    price:    { type: 'number' },
    integer:  { type: 'integer' },
    int:      { type: 'integer' },
    count:    { type: 'integer' },
    boolean:  { type: 'boolean' },
    bool:     { type: 'boolean' },
    flag:     { type: 'boolean' },
    string:   { type: 'string' },
    text:     { type: 'string' },
    email:    { type: 'string', format: 'email' },
    uuid:     { type: 'string', format: 'uuid' },
    id:       { type: 'string', format: 'uuid' },
    url:      { type: 'string', format: 'uri' },
    uri:      { type: 'string', format: 'uri' },
    date:     { type: 'string', format: 'date-time' },
    datetime: { type: 'string', format: 'date-time' },
    timestamp:{ type: 'string', format: 'date-time' },
    array:    { type: 'array', items: { type: 'string' } },
    list:     { type: 'array', items: { type: 'string' } },
    object:   { type: 'object' },
  };
  return map[w] ? { ...map[w] } : null;
}

/**
 * localSchemaRefine — deterministic, regex-based editor for common structural
 * commands. Used as a fallback when the Gemini call is rate-limited (429) or
 * otherwise unavailable, so iterative editing keeps working offline.
 *
 * Supported commands (case-insensitive):
 *   • "add <field> [field|property] [as|of type] <type> to <resource>"
 *   • "add <field> to <resource>"                      (defaults to string)
 *   • "remove|delete <field> from <resource>"
 *   • "make <field> required [in <resource>]"
 *   • "rename <old> to <new> [in <resource>]"
 *
 * @returns {{ schema, endpoints, changeSummary, affectedEndpoints } | null}
 *          null when the instruction matches no known pattern (caller should
 *          then surface a clear "rephrase" message — never a silent no-op).
 */
function localSchemaRefine(schema, endpoints, instruction) {
  const raw = String(instruction ?? '').trim();
  if (!raw || !schema || typeof schema !== 'object') return null;

  // Deep-clone so a failed/partial parse can't mutate the live schema.
  const next = JSON.parse(JSON.stringify(schema));
  const eps  = Array.isArray(endpoints) ? endpoints : [];

  const ensureProps = (res) => {
    if (!next[res]) next[res] = { type: 'object', properties: {} };
    if (!next[res].properties) next[res].properties = {};
    return next[res].properties;
  };
  const affected = (res) =>
    eps.filter((e) => e.resource === res).map((e) => e.slug);

  // ── ADD field ────────────────────────────────────────────────────────────
  // Resolve a captured Model name to the real schema key, case-insensitively
  // and tolerant of plural/singular ("product"/"products" → "Product"). This is
  // the key hardening: the captured word rarely matches the stored key's casing.
  const matchModelKey = (hint) => {
    if (!hint) return null;
    const keys = Object.keys(next);
    const h = hint.toLowerCase().replace(/s$/, '');   // normalise, drop trailing plural
    return (
      keys.find((k) => k.toLowerCase() === hint.toLowerCase()) ||       // exact (case-insensitive)
      keys.find((k) => k.toLowerCase().replace(/s$/, '') === h) ||      // singular/plural
      null
    );
  };
  // When no model is named, fall back to the sole resource (unambiguous) or,
  // failing that, scan the raw instruction for any known resource name.
  const soleResource = () => {
    const keys = Object.keys(next);
    if (keys.length === 1) return keys[0];
    // Escape regex metacharacters in the key before building the probe pattern
    // so a resource name containing e.g. '.' or '(' can never throw here.
    const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return keys.find((k) => new RegExp(`\\b${escapeRe(k.toLowerCase())}s?\\b`).test(raw.toLowerCase())) ?? null;
  };

  // ── ADD field ──────────────────────────────────────────────────────────────
  // Primary (strict) form — matches the canonical instruction exactly:
  //   "add <fieldName> field|property as <type> to <Model>"
  let m = raw.match(/add\s+(\w+)\s+(?:field|property)\s+as\s+(\w+)\s+to\s+(\w+)/i);
  // Looser fallback form so natural phrasings still work:
  //   "add <field> [field|property] [as|of type|type|:] <type>] to|in|on <Model>"
  if (!m) {
    m = raw.match(/\badd\s+(?:a|an\s+)?(?:the\s+)?["'`]?(\w+)["'`]?\s*(?:field|property|attribute|column)?\s*(?:(?:as|of\s+type|type|:)\s*["'`]?([a-zA-Z]+)["'`]?)?\s*(?:to|on|in|into)\s+["'`]?(\w+)["'`]?/i);
  }
  if (m) {
    const field    = m[1];
    const typeWord = (m[2] || 'string').toLowerCase();
    const model    = matchModelKey(m[3]);
    if (!model) return null;   // couldn't map the Model → caller asks to rephrase

    // Direct structural injection into the active schema, per spec: number stays
    // a number, everything else defaults to string. specForTypeWord adds richer
    // types/formats (integer, boolean, email, date…) when recognised.
    const spec = specForTypeWord(typeWord)
      ?? { type: typeWord === 'number' ? 'number' : 'string' };
    const props = ensureProps(model);
    props[field] = { ...spec, description: 'Custom appended field' };

    return {
      schema: next, endpoints: eps,
      changeSummary: `Added \`${field}\` (${spec.type}${spec.format ? `/${spec.format}` : ''}) to ${model}`,
      affectedEndpoints: affected(model),
    };
  }

  // ── REMOVE field ───────────────────────────────────────────────────────────
  m = raw.match(/\b(?:remove|delete|drop)\s+(?:the\s+)?["'`]?([a-zA-Z_][a-zA-Z0-9_]*)["'`]?\s*(?:field|property|attribute|column)?\s*(?:from|on|in|to|into|of)?\s*([a-zA-Z_][a-zA-Z0-9_]*)?/i);
  if (m) {
    const field = m[1];
    const res = matchModelKey(m[2]) ?? soleResource();
    if (!res) return null;
    const props = ensureProps(res);
    if (!(field in props)) return null;   // nothing to remove → let caller ask to rephrase
    delete props[field];
    if (Array.isArray(next[res].required)) {
      next[res].required = next[res].required.filter((f) => f !== field);
    }
    return {
      schema: next, endpoints: eps,
      changeSummary: `Removed \`${field}\` from ${res}`,
      affectedEndpoints: affected(res),
    };
  }

  // ── MAKE required ───────────────────────────────────────────────────────────
  m = raw.match(/\bmake\s+(?:the\s+)?["'`]?([a-zA-Z_][a-zA-Z0-9_]*)["'`]?\s*(?:field)?\s*required(?:\s+(?:in|on|for|to|of)\s+([a-zA-Z_][a-zA-Z0-9_]*))?/i);
  if (m) {
    const field = m[1];
    const res = matchModelKey(m[2]) ?? soleResource();
    if (!res) return null;
    const props = ensureProps(res);
    if (!(field in props)) return null;
    const req = new Set(next[res].required ?? []);
    req.add(field);
    next[res].required = [...req];
    return {
      schema: next, endpoints: eps,
      changeSummary: `Marked \`${field}\` as required on ${res}`,
      affectedEndpoints: affected(res),
    };
  }

  // ── RENAME field ─────────────────────────────────────────────────────────────
  m = raw.match(/\brename\s+(?:the\s+)?["'`]?([a-zA-Z_][a-zA-Z0-9_]*)["'`]?\s+to\s+["'`]?([a-zA-Z_][a-zA-Z0-9_]*)["'`]?(?:\s+(?:in|on|for|of)\s+([a-zA-Z_][a-zA-Z0-9_]*))?/i);
  if (m) {
    const [, from, to, resHint] = m;
    const res = matchModelKey(resHint) ?? soleResource();
    if (!res) return null;
    const props = ensureProps(res);
    if (!(from in props)) return null;
    props[to] = props[from];
    delete props[from];
    if (Array.isArray(next[res].required)) {
      next[res].required = next[res].required.map((f) => (f === from ? to : f));
    }
    return {
      schema: next, endpoints: eps,
      changeSummary: `Renamed \`${from}\` → \`${to}\` on ${res}`,
      affectedEndpoints: affected(res),
    };
  }

  // No known pattern matched.
  return null;
}

/**
 * registerEditResult — shared tail for editSchema: re-register the endpoint set
 * for the session, persist docs meta, and shape the response. Used by BOTH the
 * AI path and the local-refiner fallback so behaviour is identical.
 */
function registerEditResult(sessionId, { apiName, description, schema, endpoints, changeSummary, affectedEndpoints, source }) {
  SessionStore.clearEndpoints(sessionId);

  const collectionResources = new Set(
    endpoints.filter((e) => e.isCollection && e.resource).map((e) => e.resource)
  );

  const registeredEndpoints = [];
  for (const ep of endpoints) {
    const slug = sanitiseSlug(ep.slug);
    const resource = ep.resource || Object.keys(schema)[0] || 'Item';
    const resourceSchema = schema[resource] || { type: 'object', properties: {} };
    const method = (ep.method || 'GET').toUpperCase();
    const isCollection = Boolean(ep.isCollection)
      || (['POST', 'DELETE'].includes(method) && collectionResources.has(resource));

    const definition = {
      slug, method,
      description: ep.description || '',
      resource, isCollection,
      schema: resourceSchema,
      responseSchema: resourceSchema,
      createdAt: Date.now(),
    };
    SessionStore.setEndpoint(sessionId, slug, definition);
    registeredEndpoints.push({
      slug,
      method: definition.method,
      description: definition.description,
      isCollection: definition.isCollection,
      resource,
      path: `/api/mock/${sessionId}/${slug}`,
      _source: source,
    });
  }

  SessionStore.setMeta(sessionId, { apiName, description, schema });

  // Mirror the re-registered set to MongoDB (replaces prior rows). Fire-and-forget,
  // gated + error-isolated inside the adapter.
  SessionPersistence.persistEndpoints(
    sessionId,
    SessionStore.getAllEndpoints(sessionId),
    { apiName, description, schema },
  );

  return {
    apiName,
    description,
    schema,
    endpoints: registeredEndpoints,
    changeSummary: changeSummary || 'Schema updated.',
    affectedEndpoints: Array.isArray(affectedEndpoints) ? affectedEndpoints : [],
    _source: source,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export const MockResolver = {
  /**
   * Generate schema + endpoints for a prompt.
   *
   * Strategy:
   *   1. Try Gemini AI (gemini-2.5-flash)
   *   2. On ANY error (503, network, parse failure, empty response) → local fallback
   *
   * The frontend always receives a valid, populated response.
   *
   * @param {string} sessionId
   * @param {string} prompt
   * @returns {{ apiName, description, schema, endpoints }}
   */
  async generate(sessionId, prompt) {
    let parsed = null;
    let usingFallback = false;

    // ── Step 1: Attempt Gemini ──────────────────────────────────────────────
    try {
      const model = getModel();
      const fullPrompt = `${SYSTEM_PROMPT}\n\nUser request: ${prompt}`;
      const result = await model.generateContent(fullPrompt);
      const rawText = result.response.text();

      try {
        parsed = safeParseJSON(rawText);
      } catch {
        // Gemini returned unparseable text → fall through to local engine
        console.warn('[MockResolver] Gemini parse failed — using local fallback.');
        usingFallback = true;
      }

      // Validate the parsed shape has endpoints
      if (parsed && (!Array.isArray(parsed.endpoints) || parsed.endpoints.length === 0)) {
        console.warn('[MockResolver] Gemini returned no endpoints — using local fallback.');
        usingFallback = true;
        parsed = null;
      }
    } catch (aiErr) {
      // Covers: 503, 429, network errors, missing API key, quota exceeded, etc.
      const code = aiErr?.status ?? aiErr?.code ?? '';
      console.warn(`[MockResolver] Gemini unavailable (${code}: ${aiErr.message}) — using local fallback.`);
      usingFallback = true;
    }

    // ── Step 2: Local fallback if needed ────────────────────────────────────
    if (usingFallback || !parsed) {
      parsed = buildLocalFallback(prompt);
    }

    const { apiName = 'Mock API', description = '', schema = {}, endpoints = [] } = parsed;

    // ── Step 3: Register all endpoints in SessionStore ──────────────────────
    // Precompute the set of resources that own a collection (list) endpoint.
    // A create-POST against such a resource must join the stateful collection
    // engine so its body is persisted and returned by the sibling list GET —
    // otherwise the POST falls through to the generator and is silently lost.
    const collectionResources = new Set(
      endpoints
        .filter((e) => e.isCollection && (e.resource))
        .map((e) => e.resource)
    );

    const registeredEndpoints = [];
    for (const ep of endpoints) {
      const slug = sanitiseSlug(ep.slug);
      const resource = ep.resource || Object.keys(schema)[0] || 'Item';
      const resourceSchema = schema[resource] || { type: 'object', properties: {} };
      const method = (ep.method || 'GET').toUpperCase();

      // A write against a collection-backed resource is itself stateful.
      const isCollection = Boolean(ep.isCollection)
        || (['POST', 'DELETE'].includes(method) && collectionResources.has(resource));

      const definition = {
        slug,
        method,
        description: ep.description || '',
        resource,
        isCollection,
        schema: resourceSchema,
        responseSchema: resourceSchema,
        createdAt: Date.now(),
      };

      SessionStore.setEndpoint(sessionId, slug, definition);
      registeredEndpoints.push({
        slug,
        method: definition.method,
        description: definition.description,
        isCollection: definition.isCollection,
        resource,
        path: `/api/mock/${sessionId}/${slug}`,
        _source: usingFallback ? 'local' : 'ai',
      });
    }

    // Persist session-level metadata for the public docs page (regenerate-on-view).
    SessionStore.setMeta(sessionId, { apiName, description, schema });

    // Mirror the freshly-registered set to MongoDB (trusted, server-side) so the
    // session survives a serverless cold-start. Fire-and-forget: the adapter is
    // gated on MONGO_URI and error-isolated, so this never blocks or breaks the
    // response when persistence is off or the cluster hiccups.
    SessionPersistence.persistEndpoints(
      sessionId,
      SessionStore.getAllEndpoints(sessionId),
      { apiName, description, schema },
    );

    return {
      apiName,
      description,
      schema,
      endpoints: registeredEndpoints,
      _source: usingFallback ? 'local' : 'ai',
    };
  },

  /**
   * Edit an existing schema/endpoint definition from a plain-English
   * instruction. Sends the CURRENT schema + endpoints + instruction to Gemini
   * and asks for the full updated definition in the same structure, plus a
   * human-readable change summary.
   *
   * Re-registers the resulting endpoints in the SessionStore (replacing the
   * old set for this session) and updates the docs meta.
   *
   * @param {string} sessionId
   * @param {string} instruction — plain English, e.g. "add a discount field to products"
   * @param {object} currentSchema — existing resource → schema map
   * @param {object[]} currentEndpoints — existing endpoint list
   * @returns {{ apiName, description, schema, endpoints, changeSummary, affectedEndpoints, _source }}
   * @throws {Error} with code 'AMBIGUOUS_INSTRUCTION' when the AI can't map it
   */
  async editSchema(sessionId, instruction, currentSchema, currentEndpoints) {
    const meta = SessionStore.getMeta(sessionId);

    // Local deterministic fallback — used when the AI is rate-limited (429),
    // quota-exceeded, key-missing, or otherwise unavailable. Handles common
    // structural commands (add/remove/rename field, make required) so iterative
    // editing keeps working with zero downtime.
    const tryLocalFallback = (cause) => {
      const refined = localSchemaRefine(currentSchema, currentEndpoints, instruction);
      if (refined) {
        return registerEditResult(sessionId, {
          apiName:     meta?.apiName ?? 'Mock API',
          description: meta?.description ?? '',
          schema:      refined.schema,
          endpoints:   refined.endpoints,
          changeSummary: `${refined.changeSummary} (offline refiner — AI was unavailable)`,
          affectedEndpoints: refined.affectedEndpoints,
          source:      'local',
        });
      }
      // The command isn't one the local refiner understands. Be honest: ask the
      // user to rephrase into a supported structural command rather than
      // silently no-op'ing or corrupting the schema.
      const e = new Error(
        `AI editing is temporarily unavailable and this command couldn't be applied offline. ` +
        `Try a simple structural edit like "add discount field as number to Product", ` +
        `"remove tags from Post", "make email required", or "rename body to content".`
      );
      e.code = 'AMBIGUOUS_INSTRUCTION';
      e.cause = cause;
      throw e;
    };

    // If the model can't even be constructed (no API key), go straight to local.
    let model;
    try {
      model = getModel();
    } catch (keyErr) {
      return tryLocalFallback(keyErr?.message ?? 'no api key');
    }

    // Defensively serialise the session context. safeStringify escapes quotes,
    // brackets and newlines (standard JSON.stringify behaviour) and tolerates a
    // cyclic/bad schema without throwing before the model call.
    const schemaBlock = safeStringify(currentSchema ?? {});
    const endpointsBlock = safeStringify(
      (currentEndpoints ?? []).map(e => ({
        slug: e.slug, method: e.method, description: e.description,
        resource: e.resource, isCollection: e.isCollection,
      }))
    );

    const editPrompt = `${EDIT_SYSTEM_PROMPT}

CURRENT_SCHEMA:
${schemaBlock}

CURRENT_ENDPOINTS:
${endpointsBlock}

USER_INSTRUCTION: ${instruction}`;

    let parsed;
    try {
      // Full-schema returns can be large; give the edit response enough token
      // headroom so it isn't truncated mid-JSON (a truncated body → parse fail).
      // responseMimeType:'application/json' (set on the model) already forces a
      // raw JSON object with no conversational preamble.
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: editPrompt }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.3, maxOutputTokens: 8192 },
      });
      parsed = safeParseJSON(result.response.text());
    } catch (err) {
      // AI call failed (429 quota, network, parse, etc.). Instead of failing,
      // attempt the deterministic local refiner so editing survives the outage.
      const raw = err?.message ?? '';
      console.warn(`[editSchema] AI unavailable (${raw.slice(0, 120)}) — attempting local refiner.`);
      return tryLocalFallback(raw);
    }

    // The model signals it couldn't confidently map the instruction.
    if (!parsed || parsed.ok === false || parsed.error) {
      const e = new Error(
        (parsed && parsed.error) ||
        "That instruction was unclear. Try something like \"add a discount field to products\" or \"make phone required\"."
      );
      e.code = 'AMBIGUOUS_INSTRUCTION';
      throw e;
    }

    // Must return a usable schema + endpoints, else treat as ambiguous.
    if (!parsed.schema || typeof parsed.schema !== 'object' ||
        !Array.isArray(parsed.endpoints) || parsed.endpoints.length === 0) {
      const e = new Error(
        "Couldn't apply that change safely. Please rephrase your instruction."
      );
      e.code = 'AMBIGUOUS_INSTRUCTION';
      throw e;
    }

    // ── AI success → register via the shared tail ───────────────────────────
    return registerEditResult(sessionId, {
      apiName:     parsed.apiName     ?? meta?.apiName     ?? 'Mock API',
      description: parsed.description ?? meta?.description ?? '',
      schema:      parsed.schema,
      endpoints:   parsed.endpoints,
      changeSummary: typeof parsed.changeSummary === 'string' && parsed.changeSummary.trim()
        ? parsed.changeSummary.trim()
        : 'Schema updated.',
      affectedEndpoints: parsed.affectedEndpoints,
      source:      'ai',
    });
  },

  /**
   * Generate an automated test suite for the session's mock API.
   *
   * Strategy:
   *   1. Ask Gemini for varied test INTENTS (description/category/slug/method/body).
   *   2. If Gemini is unavailable/invalid → build the same varied set locally.
   *   3. For EVERY case, compute the expected status DETERMINISTICALLY using the
   *      exact rules the live mock route enforces (schema validation + auth +
   *      collection id rules). This guarantees honest pass/fail — expectations
   *      always match what the real endpoint will actually return.
   *
   * @param {string} sessionId
   * @returns {{ cases: object[], _source: 'ai'|'local' }}
   */
  async generateTests(sessionId) {
    const meta      = SessionStore.getMeta(sessionId);
    const endpoints = SessionStore.getAllEndpoints(sessionId);
    const schema    = meta?.schema ?? {};
    const auth      = SessionStore.getAuth(sessionId);
    const authEnabled = !!auth?.enabled;

    if (!endpoints.length) {
      const e = new Error('Generate an API before running the test suite.');
      e.code = 'NO_ENDPOINTS';
      throw e;
    }

    // Index endpoints by slug:method for validation of AI-proposed cases.
    const epByKey = new Map();
    for (const ep of endpoints) epByKey.set(`${ep.slug}:${ep.method}`, ep);
    const validSlugs = new Set(endpoints.map((e) => e.slug));

    // ── Step 1: try AI for test intents ──────────────────────────────────
    let intents = null;
    let source  = 'ai';
    try {
      const model = getModel();
      const prompt = `${TESTGEN_SYSTEM_PROMPT}

AUTH_ENABLED: ${authEnabled}

ENDPOINTS:
${JSON.stringify(endpoints.map((e) => ({ slug: e.slug, method: e.method, resource: e.resource, isCollection: e.isCollection })), null, 2)}

SCHEMA:
${JSON.stringify(schema, null, 2)}`;
      const result = await model.generateContent(prompt);
      const parsed = safeParseJSON(result.response.text());
      if (Array.isArray(parsed?.cases) && parsed.cases.length) {
        // Keep only cases that reference a real endpoint.
        intents = parsed.cases.filter((c) => c && validSlugs.has(c.slug));
      }
    } catch {
      intents = null;   // fall through to local
    }

    // ── Step 2: local fallback if AI produced nothing usable ─────────────
    if (!intents || !intents.length) {
      source  = 'local';
      intents = buildLocalTestIntents(endpoints, schema, authEnabled);
    }

    // ── Step 3: normalise + compute deterministic expected outcome ───────
    const cases = intents.slice(0, 15).map((intent, i) => {
      const method = String(intent.method ?? 'GET').toUpperCase();
      const ep = epByKey.get(`${intent.slug}:${method}`)
        ?? endpoints.find((e) => e.slug === intent.slug)
        ?? endpoints[0];
      const resolvedMethod = ep.method;
      const body  = (intent.body && typeof intent.body === 'object') ? intent.body : null;
      const query = (intent.query && typeof intent.query === 'object') ? intent.query : null;
      const useAuth = authEnabled ? (intent.useAuth !== false) : false;

      const { expectedStatus, expectedOutcome } = computeExpected({
        ep, method: resolvedMethod, body, query, authEnabled, useAuth,
      });

      return {
        id:          `tc-${i + 1}`,
        description: String(intent.description ?? `${resolvedMethod} /${ep.slug}`).slice(0, 140),
        category:    intent.category ?? 'valid',
        slug:        ep.slug,
        method:      resolvedMethod,
        path:        `/api/mock/${sessionId}/${ep.slug}`,
        body,
        query,
        useAuth,
        expectedStatus,
        expectedOutcome,
      };
    });

    return { cases, authEnabled, _source: source };
  },

  /**
   * Resolve an existing endpoint definition from the SessionStore.
   * Returns null if not found.
   */
  resolve(sessionId, slug, method) {
    return SessionStore.getEndpoint(sessionId, slug, method);
  },

  /**
   * Check whether a session UUID is known to the SessionStore.
   * Used by routes/mock.js to distinguish SESSION_NOT_FOUND from
   * ENDPOINT_NOT_FOUND in 404 responses.
   *
   * @param {string} sessionId
   * @returns {boolean}
   */
  sessionExists(sessionId) {
    return SessionStore.has(sessionId);
  },
};
