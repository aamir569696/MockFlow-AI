/**
 * DataGenerator — zero-dependency, schema-aware fake data engine.
 *
 * Given a JSON Schema object (draft-07 subset) it produces realistic
 * randomised values.  No external libraries required — pure Node.js.
 *
 * Supported schema types:  string, number, integer, boolean, array, object, null
 * Supported string formats: date, date-time, email, uuid, uri, name, phone,
 *                            username, password, color, ip, lorem, sentence
 * Supported keywords:       enum, const, minimum, maximum, minLength,
 *                           maxLength, minItems, maxItems, properties,
 *                           items, oneOf, anyOf
 *
 * ── Deterministic Seed Toggle ────────────────────────────────────────────────
 * Passing an integer `seed` to `generateValue()` / `generateResponse()` switches
 * the internal PRNG from Math.random() to a seeded mulberry32 generator.
 * The same seed always produces identical output — useful for snapshot testing
 * and client-side regression verification.
 *
 * Activate via the query parameter: GET /api/mock/:session/:slug?seed=true
 * The numeric seed is derived from sessionId + slug + method.
 */

// ── Vocabulary pools ──────────────────────────────────────────────────────────

const FIRST_NAMES = [
  'Alice', 'Bob', 'Carol', 'David', 'Eve', 'Frank', 'Grace', 'Henry',
  'Isabella', 'James', 'Kate', 'Liam', 'Mia', 'Noah', 'Olivia', 'Paul',
  'Quinn', 'Rachel', 'Sam', 'Tina', 'Uma', 'Victor', 'Wendy', 'Xander',
  'Yara', 'Zoe',
];
const LAST_NAMES = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller',
  'Davis', 'Wilson', 'Moore', 'Taylor', 'Anderson', 'Thomas', 'Jackson',
  'White', 'Harris', 'Martin', 'Thompson', 'Young', 'Walker',
];
const WORDS = [
  'alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot', 'golf',
  'hotel', 'india', 'juliet', 'kilo', 'lima', 'mike', 'november',
  'oscar', 'papa', 'quebec', 'romeo', 'sierra', 'tango', 'uniform',
  'victor', 'whiskey', 'xray', 'yankee', 'zulu',
];
const DOMAINS  = ['example.com', 'mail.io', 'test.org', 'mock.dev', 'fakemail.net'];
const TLDS     = ['com', 'org', 'net', 'io', 'dev'];
const COLORS   = ['#FF5733','#33FF57','#3357FF','#FF33A1','#A133FF','#33FFF5','#FF8C33','#8CFF33','#338CFF','#FF338C'];
const HTTP_METHODS = ['GET','POST','PUT','PATCH','DELETE'];
const STATUSES     = ['active','inactive','pending','deleted','archived'];
const LOREM_WORDS  = [
  'lorem','ipsum','dolor','sit','amet','consectetur','adipiscing',
  'elit','sed','do','eiusmod','tempor','incididunt','ut','labore',
  'et','dolore','magna','aliqua','enim','ad','minim','veniam',
];

// ── Seeded PRNG — mulberry32 ──────────────────────────────────────────────────

/**
 * mulberry32 — a fast, high-quality 32-bit seeded PRNG.
 * Returns a function `next()` that yields floats in [0, 1).
 * Identical seeds always produce identical sequences.
 *
 * @param {number} seed  32-bit unsigned integer
 * @returns {() => number}
 */
function createPRNG(seed) {
  let s = seed >>> 0;
  return function next() {
    s += 0x6d2b79f5;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Derive a stable 32-bit integer seed from a string key.
 * Uses the djb2 hash algorithm — deterministic, no external deps.
 *
 * @param {string} key
 * @returns {number}
 */
export function seedFromKey(key) {
  let hash = 5381;
  for (let i = 0; i < key.length; i++) {
    hash = ((hash << 5) + hash) ^ key.charCodeAt(i);
    hash = hash >>> 0;  // keep as 32-bit unsigned
  }
  return hash || 1;  // never return 0
}

// ── PRNG context ──────────────────────────────────────────────────────────────
// A single per-call PRNG instance is threaded through the entire generation
// tree via a closure so every nested call advances the same sequence,
// guaranteeing that a given seed always maps to the same full response.

let _rng = null;   // set at the start of generateResponse, cleared at the end

/** Returns the active PRNG's next value, or Math.random() if unseeded. */
function rng() {
  return _rng ? _rng() : Math.random();
}

// ── Helpers (use `rng()` throughout instead of Math.random()) ────────────────

const pick    = (arr)       => arr[Math.floor(rng() * arr.length)];
const randInt = (min, max)  => Math.floor(rng() * (max - min + 1)) + min;
const pad     = (n)         => String(n).padStart(2, '0');

function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (rng() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function isoDate() {
  const d = new Date(Date.now() - randInt(0, 365 * 3) * 86400000);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function isoDateTime() {
  const d = new Date(Date.now() - randInt(0, 365 * 3) * 86400000);
  return d.toISOString();
}

function email(hint = '') {
  const user = hint
    ? hint.toLowerCase().replace(/\s+/g, '.').slice(0, 16)
    : `${pick(FIRST_NAMES).toLowerCase()}${randInt(1, 99)}`;
  return `${user}@${pick(DOMAINS)}`;
}

function uri(hint = '') {
  const slug = hint
    ? hint.toLowerCase().replace(/\s+/g, '-').slice(0, 20)
    : pick(WORDS);
  return `https://${pick(WORDS)}.${pick(TLDS)}/${slug}`;
}

function phone() { return `+1-${randInt(200,999)}-${randInt(100,999)}-${randInt(1000,9999)}`; }
function ip()    { return [randInt(1,254),randInt(0,255),randInt(0,255),randInt(1,254)].join('.'); }

function sentence() {
  const w = randInt(6, 14);
  const first = pick(LOREM_WORDS);
  return first.charAt(0).toUpperCase() + first.slice(1) + ' ' +
    Array.from({ length: w - 1 }, () => pick(LOREM_WORDS)).join(' ') + '.';
}

function valueFromKey(key) {
  const k = key.toLowerCase();
  if (/\bid\b|_id$|^id/.test(k))            return uuid();
  if (/name/.test(k) && /first/.test(k))    return pick(FIRST_NAMES);
  if (/name/.test(k) && /last/.test(k))     return pick(LAST_NAMES);
  if (/\bname\b/.test(k))                   return `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
  if (/username|handle|login/.test(k))      return `${pick(FIRST_NAMES).toLowerCase()}${randInt(10,999)}`;
  if (/email|mail/.test(k))                 return email();
  if (/phone|mobile|tel/.test(k))           return phone();
  if (/password|passwd|secret/.test(k))     return `Mk$${uuid().slice(0,12)}`;
  if (/avatar|photo|image|picture/.test(k)) return `https://i.pravatar.cc/150?u=${uuid()}`;
  if (/url|link|href|website/.test(k))      return uri(k);
  if (/color|colour/.test(k))               return pick(COLORS);
  if (/ip/.test(k))                         return ip();
  if (/uuid|guid/.test(k))                  return uuid();
  if (/date/.test(k))                       return isoDate();
  if (/time|created|updated|at$/.test(k))   return isoDateTime();
  if (/age/.test(k))                        return randInt(18, 80);
  if (/price|amount|cost|salary/.test(k))   return parseFloat((rng() * 9999 + 1).toFixed(2));
  if (/count|total|quantity|qty/.test(k))   return randInt(0, 500);
  if (/rating|score|rank/.test(k))          return parseFloat((rng() * 5).toFixed(1));
  if (/lat/.test(k))                        return parseFloat((rng() * 180 - 90).toFixed(6));
  if (/lon|lng/.test(k))                    return parseFloat((rng() * 360 - 180).toFixed(6));
  if (/status|state/.test(k))               return pick(STATUSES);
  if (/method/.test(k))                     return pick(HTTP_METHODS);
  if (/body|content|text|description|bio|about|message/.test(k)) return sentence();
  if (/title|subject|heading/.test(k))      return pick(LOREM_WORDS).charAt(0).toUpperCase() +
                                                    pick(LOREM_WORDS).slice(1) + ' ' + pick(LOREM_WORDS);
  if (/tag|label|category|type|kind/.test(k)) return pick(WORDS);
  if (/bool|active|enabled|verified|public|flag/.test(k)) return rng() > 0.5;
  return null;
}

// ── Core generator ────────────────────────────────────────────────────────────

/**
 * Generate a fake value that matches the given JSON Schema node.
 *
 * NOTE: This function uses the module-level `rng()` helper — do NOT call
 * it directly with an active `_rng` context from two concurrent requests
 * (Node.js is single-threaded, so there is no actual race, but callers
 * should ensure `_rng` is set and cleared within a single synchronous call
 * stack, which `generateResponse` guarantees).
 *
 * @param {object} schema
 * @param {string} [key]
 * @param {number} [depth]  — recursion depth guard (max 6)
 */
export function generateValue(schema = {}, key = '', depth = 0) {
  if (depth > 6) return null;

  if (schema.enum)              return pick(schema.enum);
  if (schema.const !== undefined) return schema.const;

  const branch = schema.oneOf || schema.anyOf;
  if (branch?.length) return generateValue(branch[0], key, depth + 1);

  const type = schema.type;

  if (type === 'object' || schema.properties) {
    const props = schema.properties || {};
    const result = {};
    for (const [k, v] of Object.entries(props)) {
      result[k] = generateValue(v, k, depth + 1);
    }
    if (!Object.keys(props).length) result[pick(WORDS)] = pick(WORDS);
    return result;
  }

  if (type === 'array' || schema.items) {
    const min   = schema.minItems ?? 1;
    const max   = schema.maxItems ?? 5;
    const count = randInt(min, Math.min(max, min + 4));
    const itemSchema = schema.items || { type: 'string' };
    return Array.from({ length: count }, () => generateValue(itemSchema, key, depth + 1));
  }

  if (type === 'boolean') return rng() > 0.5;
  if (type === 'null')    return null;

  if (type === 'number' || type === 'integer') {
    // Constraints are authoritative — they clamp any semantic hint so that
    // schemas with { minimum, maximum } always produce in-range values.
    const hasMin = schema.minimum != null;
    const hasMax = schema.maximum != null;
    const min    = hasMin ? schema.minimum : 0;
    const max    = hasMax ? schema.maximum : 10000;

    const hint = valueFromKey(key);
    if (typeof hint === 'number') {
      // Clamp the hint into the declared range
      return Math.min(Math.max(hint, min), max);
    }
    return type === 'integer'
      ? randInt(min, max)
      : parseFloat((rng() * (max - min) + min).toFixed(2));
  }

  if (type === 'string' || !type) {
    const fmt = schema.format;
    if (fmt === 'date')              return isoDate();
    if (fmt === 'date-time')         return isoDateTime();
    if (fmt === 'email')             return email(key);
    if (fmt === 'uuid')              return uuid();
    if (fmt === 'uri' || fmt === 'url') return uri(key);
    if (fmt === 'hostname')          return `${pick(WORDS)}.${pick(TLDS)}`;
    if (fmt === 'ipv4')              return ip();
    if (fmt === 'phone')             return phone();
    if (fmt === 'color')             return pick(COLORS);

    // If an explicit pattern is declared, satisfy the common ones directly
    if (schema.pattern) {
      const p = String(schema.pattern);
      if (/@/.test(p))                        return email(key);   // email-ish pattern
      if (/\\d|\[0-9\]/.test(p) && p.length < 20) return String(randInt(1000, 99999));
    }

    const hint = valueFromKey(key);
    let value  = hint !== null ? String(hint) : null;

    if (value === null) {
      const minLen = schema.minLength ?? 4;
      const maxLen = schema.maxLength ?? 12;
      const len    = randInt(minLen, maxLen);
      value = Array.from({ length: Math.ceil(len / 5) }, () => pick(WORDS)).join('_').slice(0, len);
    }

    // Enforce declared length bounds on the final value
    if (schema.maxLength != null && value.length > schema.maxLength) {
      value = value.slice(0, schema.maxLength);
    }
    if (schema.minLength != null && value.length < schema.minLength) {
      value = value.padEnd(schema.minLength, 'x');
    }
    return value;
  }

  return pick(WORDS);
}

// ─────────────────────────────────────────────────────────────────────────────
// Schema constraint validator — used by routes/mock.js on POST/PUT bodies
// ─────────────────────────────────────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_STR_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * validateAgainstSchema(body, resourceSchema)
 *
 * Checks a user-supplied object against the JSON-Schema-style resource
 * definition. Returns an array of { field, message } violations — empty
 * array means the body is valid.
 *
 * Supported constraints:
 *   • type            (string / number / integer / boolean / array)
 *   • minimum / maximum        (numeric bounds)
 *   • minLength / maxLength     (string length)
 *   • format: email / uuid      (regex validation)
 *   • pattern                   (custom regex)
 *   • enum                      (allowed value set)
 *
 * Only fields PRESENT in the body are validated — missing fields are ignored
 * (the mock layer fills them in), so partial PATCH bodies pass cleanly.
 *
 * @param {object} body
 * @param {object} resourceSchema  — { type:'object', properties:{...} }
 * @returns {{ field: string, message: string }[]}
 */
export function validateAgainstSchema(body, resourceSchema) {
  const violations = [];
  if (!body || typeof body !== 'object' || Array.isArray(body)) return violations;
  const props = resourceSchema?.properties ?? {};

  for (const [field, value] of Object.entries(body)) {
    const spec = props[field];
    if (!spec) continue;                 // unknown field — allowed (extra data ok)
    if (value === null || value === undefined) continue;

    const t = spec.type;

    // ── Type mismatch ──────────────────────────────────────────────────────
    if (t === 'integer' && !Number.isInteger(value)) {
      violations.push({ field, message: `must be an integer` });
      continue;
    }
    if (t === 'number' && typeof value !== 'number') {
      violations.push({ field, message: `must be a number` });
      continue;
    }
    if (t === 'boolean' && typeof value !== 'boolean') {
      violations.push({ field, message: `must be a boolean` });
      continue;
    }
    if (t === 'array' && !Array.isArray(value)) {
      violations.push({ field, message: `must be an array` });
      continue;
    }
    if (t === 'string' && typeof value !== 'string') {
      violations.push({ field, message: `must be a string` });
      continue;
    }

    // ── Numeric bounds ───────────────────────────────────────────────────────
    if ((t === 'number' || t === 'integer') && typeof value === 'number') {
      if (spec.minimum != null && value < spec.minimum)
        violations.push({ field, message: `must be ≥ ${spec.minimum}` });
      if (spec.maximum != null && value > spec.maximum)
        violations.push({ field, message: `must be ≤ ${spec.maximum}` });
    }

    // ── String constraints ──────────────────────────────────────────────────
    if (t === 'string' && typeof value === 'string') {
      if (spec.minLength != null && value.length < spec.minLength)
        violations.push({ field, message: `must be at least ${spec.minLength} characters` });
      if (spec.maxLength != null && value.length > spec.maxLength)
        violations.push({ field, message: `must be at most ${spec.maxLength} characters` });
      if (spec.format === 'email' && !EMAIL_RE.test(value))
        violations.push({ field, message: `must be a valid email address` });
      if (spec.format === 'uuid' && !UUID_STR_RE.test(value))
        violations.push({ field, message: `must be a valid UUID` });
      if (spec.pattern) {
        try {
          if (!new RegExp(spec.pattern).test(value))
            violations.push({ field, message: `must match pattern ${spec.pattern}` });
        } catch { /* invalid pattern in schema — skip */ }
      }
    }

    // ── Enum membership ──────────────────────────────────────────────────────
    if (Array.isArray(spec.enum) && !spec.enum.includes(value)) {
      violations.push({ field, message: `must be one of: ${spec.enum.join(', ')}` });
    }
  }

  return violations;
}

/**
 * Generate a full mock response payload for an endpoint definition.
 *
 * @param {object} endpointDef  — stored definition from SessionStore
 * @param {string} method       — HTTP method
 * @param {number|null} [count] — force array of N items
 * @param {object} [opts]
 * @param {number} [opts.seed]  — if set, switches PRNG to deterministic mode
 * @returns {{ status: number, body: * }}
 */
export function generateResponse(endpointDef, method, count = null, opts = {}) {
  // ── Activate seeded PRNG if requested ─────────────────────────────────────
  const prevRng = _rng;
  if (opts.seed != null) {
    _rng = createPRNG(opts.seed);
  }

  try {
    const { schema, responseSchema, isCollection } = endpointDef;
    const targetSchema = responseSchema || schema || { type: 'object' };
    const verb = method.toUpperCase();

    if (['POST', 'PUT', 'PATCH'].includes(verb)) {
      return { status: verb === 'POST' ? 201 : 200, body: generateValue(targetSchema, '', 0) };
    }

    if (verb === 'DELETE') {
      return { status: 204, body: null };
    }

    const items = count ?? (isCollection ? randInt(2, 8) : null);
    if (items !== null) {
      return {
        status: 200,
        body: Array.from({ length: items }, () => generateValue(targetSchema, '', 0)),
      };
    }

    return { status: 200, body: generateValue(targetSchema, '', 0) };
  } finally {
    // Always restore previous PRNG state so nested calls are unaffected
    _rng = prevRng;
  }
}
