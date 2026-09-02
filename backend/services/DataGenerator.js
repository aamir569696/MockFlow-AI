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
 *                           items, oneOf, anyOf, $ref (shallow)
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
const DOMAINS = ['example.com', 'mail.io', 'test.org', 'mock.dev', 'fakemail.net'];
const TLDS = ['com', 'org', 'net', 'io', 'dev'];
const COLORS = [
  '#FF5733', '#33FF57', '#3357FF', '#FF33A1', '#A133FF',
  '#33FFF5', '#FF8C33', '#8CFF33', '#338CFF', '#FF338C',
];
const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
const STATUSES = ['active', 'inactive', 'pending', 'deleted', 'archived'];
const LOREM_WORDS = [
  'lorem', 'ipsum', 'dolor', 'sit', 'amet', 'consectetur', 'adipiscing',
  'elit', 'sed', 'do', 'eiusmod', 'tempor', 'incididunt', 'ut', 'labore',
  'et', 'dolore', 'magna', 'aliqua', 'enim', 'ad', 'minim', 'veniam',
];

// ── Helpers ───────────────────────────────────────────────────────────────────

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pad = (n) => String(n).padStart(2, '0');

function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
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

function phone() {
  return `+1-${randInt(200, 999)}-${randInt(100, 999)}-${randInt(1000, 9999)}`;
}

function ip() {
  return [randInt(1, 254), randInt(0, 255), randInt(0, 255), randInt(1, 254)].join('.');
}

function lorem(words = 8) {
  return Array.from({ length: words }, () => pick(LOREM_WORDS)).join(' ') + '.';
}

function sentence() {
  const w = randInt(6, 14);
  const first = pick(LOREM_WORDS);
  return first.charAt(0).toUpperCase() + first.slice(1) + ' ' +
    Array.from({ length: w - 1 }, () => pick(LOREM_WORDS)).join(' ') + '.';
}

// Derive a sensible fake value purely from a property key name
function valueFromKey(key) {
  const k = key.toLowerCase();
  if (/\bid\b|_id$|^id/.test(k))            return uuid();
  if (/name/.test(k) && /first/.test(k))    return pick(FIRST_NAMES);
  if (/name/.test(k) && /last/.test(k))     return pick(LAST_NAMES);
  if (/\bname\b/.test(k))                   return `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
  if (/username|handle|login/.test(k))      return `${pick(FIRST_NAMES).toLowerCase()}${randInt(10, 999)}`;
  if (/email|mail/.test(k))                 return email();
  if (/phone|mobile|tel/.test(k))           return phone();
  if (/password|passwd|secret/.test(k))     return `Mk$${uuid().slice(0, 12)}`;
  if (/avatar|photo|image|picture/.test(k)) return `https://i.pravatar.cc/150?u=${uuid()}`;
  if (/url|link|href|website/.test(k))      return uri(k);
  if (/color|colour/.test(k))               return pick(COLORS);
  if (/ip/.test(k))                         return ip();
  if (/uuid|guid/.test(k))                  return uuid();
  if (/date/.test(k))                       return isoDate();
  if (/time|created|updated|at$/.test(k))   return isoDateTime();
  if (/age/.test(k))                        return randInt(18, 80);
  if (/price|amount|cost|salary/.test(k))   return parseFloat((Math.random() * 9999 + 1).toFixed(2));
  if (/count|total|quantity|qty/.test(k))   return randInt(0, 500);
  if (/rating|score|rank/.test(k))          return parseFloat((Math.random() * 5).toFixed(1));
  if (/lat/.test(k))                        return parseFloat((Math.random() * 180 - 90).toFixed(6));
  if (/lon|lng/.test(k))                    return parseFloat((Math.random() * 360 - 180).toFixed(6));
  if (/status|state/.test(k))               return pick(STATUSES);
  if (/method/.test(k))                     return pick(HTTP_METHODS);
  if (/body|content|text|description|bio|about|message/.test(k)) return sentence();
  if (/title|subject|heading/.test(k))      return pick(LOREM_WORDS).charAt(0).toUpperCase() +
                                                    pick(LOREM_WORDS).slice(1) + ' ' +
                                                    pick(LOREM_WORDS);
  if (/tag|label|category|type|kind/.test(k)) return pick(WORDS);
  if (/bool|active|enabled|verified|public|flag/.test(k)) return Math.random() > 0.5;
  return null; // no hint found
}

// ── Core generator ────────────────────────────────────────────────────────────

/**
 * Generate a fake value that matches the given JSON Schema node.
 *
 * @param {object} schema   — JSON Schema node
 * @param {string} [key]    — parent property name (used for semantic hints)
 * @param {number} [depth]  — recursion depth guard (max 6)
 * @returns {*}
 */
export function generateValue(schema = {}, key = '', depth = 0) {
  if (depth > 6) return null;

  // --- enum / const shortcuts ---
  if (schema.enum)  return pick(schema.enum);
  if (schema.const !== undefined) return schema.const;

  // --- oneOf / anyOf: pick first branch ---
  const branch = schema.oneOf || schema.anyOf;
  if (branch?.length) return generateValue(branch[0], key, depth + 1);

  const type = schema.type;

  // --- object ---
  if (type === 'object' || schema.properties) {
    const props = schema.properties || {};
    const result = {};
    for (const [propKey, propSchema] of Object.entries(props)) {
      result[propKey] = generateValue(propSchema, propKey, depth + 1);
    }
    // If no properties defined, produce a generic key-value pair
    if (!Object.keys(props).length) {
      result[pick(WORDS)] = pick(WORDS);
    }
    return result;
  }

  // --- array ---
  if (type === 'array' || schema.items) {
    const min = schema.minItems ?? 1;
    const max = schema.maxItems ?? 5;
    const count = randInt(min, Math.min(max, min + 4));
    const itemSchema = schema.items || { type: 'string' };
    return Array.from({ length: count }, () => generateValue(itemSchema, key, depth + 1));
  }

  // --- boolean ---
  if (type === 'boolean') return Math.random() > 0.5;

  // --- null ---
  if (type === 'null') return null;

  // --- number / integer ---
  if (type === 'number' || type === 'integer') {
    const min = schema.minimum ?? 0;
    const max = schema.maximum ?? 10000;
    // Try semantic key hint first
    const hint = valueFromKey(key);
    if (typeof hint === 'number') return hint;
    return type === 'integer'
      ? randInt(min, max)
      : parseFloat((Math.random() * (max - min) + min).toFixed(2));
  }

  // --- string ---
  if (type === 'string' || !type) {
    // Format-based generation
    const fmt = schema.format;
    if (fmt === 'date')      return isoDate();
    if (fmt === 'date-time') return isoDateTime();
    if (fmt === 'email')     return email(key);
    if (fmt === 'uuid')      return uuid();
    if (fmt === 'uri' || fmt === 'url') return uri(key);
    if (fmt === 'hostname')  return `${pick(WORDS)}.${pick(TLDS)}`;
    if (fmt === 'ipv4')      return ip();
    if (fmt === 'phone')     return phone();
    if (fmt === 'color')     return pick(COLORS);

    // Semantic key-name hint
    const hint = valueFromKey(key);
    if (hint !== null) return String(hint);

    // Fallback: bounded random string
    const minLen = schema.minLength ?? 4;
    const maxLen = schema.maxLength ?? 12;
    const len = randInt(minLen, maxLen);
    return Array.from({ length: Math.ceil(len / 5) }, () => pick(WORDS))
      .join('_')
      .slice(0, len);
  }

  // Absolute fallback
  return pick(WORDS);
}

/**
 * Generate a full mock response payload for an endpoint definition.
 *
 * @param {object} endpointDef  — stored definition from SessionStore
 * @param {string} method       — HTTP method (GET, POST, …)
 * @param {number} [count]      — how many items to return for list endpoints
 * @returns {{ status: number, body: * }}
 */
export function generateResponse(endpointDef, method, count = null) {
  const { schema, responseSchema, isCollection } = endpointDef;
  const targetSchema = responseSchema || schema || { type: 'object' };
  const verb = method.toUpperCase();

  // POST / PUT / PATCH → return a single created/updated object
  if (['POST', 'PUT', 'PATCH'].includes(verb)) {
    return { status: verb === 'POST' ? 201 : 200, body: generateValue(targetSchema, '', 0) };
  }

  // DELETE → 204 no content
  if (verb === 'DELETE') {
    return { status: 204, body: null };
  }

  // GET → single item or collection based on metadata
  const items = count ?? (isCollection ? randInt(2, 8) : null);
  if (items !== null) {
    return {
      status: 200,
      body: Array.from({ length: items }, () => generateValue(targetSchema, '', 0)),
    };
  }

  return { status: 200, body: generateValue(targetSchema, '', 0) };
}
