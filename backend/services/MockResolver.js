import { GoogleGenerativeAI } from '@google/generative-ai';
import { SessionStore } from './SessionStore.js';

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
- Return ONLY the JSON object — no code fences, no extra text.`;

// ── JSON parser (robust against Gemini quirks) ────────────────────────────────
function safeParseJSON(text) {
  let cleaned = text
    .replace(/^```(?:json)?\s*/im, '')
    .replace(/\s*```\s*$/im, '')
    .trim();

  // Strip <think>…</think> reasoning blocks (gemini-2.5-flash)
  cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

  // Extract first top-level JSON object in case there is leading prose
  const start = cleaned.indexOf('{');
  const end   = cleaned.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    cleaned = cleaned.slice(start, end + 1);
  }

  return JSON.parse(cleaned);
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
    const registeredEndpoints = [];
    for (const ep of endpoints) {
      const slug = sanitiseSlug(ep.slug);
      const resource = ep.resource || Object.keys(schema)[0] || 'Item';
      const resourceSchema = schema[resource] || { type: 'object', properties: {} };

      const definition = {
        slug,
        method: (ep.method || 'GET').toUpperCase(),
        description: ep.description || '',
        resource,
        isCollection: Boolean(ep.isCollection),
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
        path: `/api/mock/${sessionId}/${slug}`,
        _source: usingFallback ? 'local' : 'ai',
      });
    }

    return {
      apiName,
      description,
      schema,
      endpoints: registeredEndpoints,
      _source: usingFallback ? 'local' : 'ai',
    };
  },

  /**
   * Resolve an existing endpoint definition from the SessionStore.
   * Returns null if not found.
   */
  resolve(sessionId, slug) {
    return SessionStore.getEndpoint(sessionId, slug);
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
