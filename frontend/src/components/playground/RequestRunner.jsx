import { useState, useCallback } from 'react';
import { usePlaygroundStore } from '../../store/playgroundStore.js';

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

const METHOD_COLORS = {
  GET:    'text-emerald-400',
  POST:   'text-blue-400',
  PUT:    'text-amber-400',
  PATCH:  'text-purple-400',
  DELETE: 'text-red-400',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function statusLabel(code) {
  const map = {
    200: 'OK', 201: 'Created', 204: 'No Content',
    400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden',
    404: 'Not Found', 405: 'Method Not Allowed', 409: 'Conflict',
    422: 'Unprocessable', 429: 'Too Many Requests',
    500: 'Server Error', 502: 'Bad Gateway', 503: 'Unavailable',
  };
  return map[code] ?? '';
}

function statusMeta(code) {
  if (!code) return { dot: 'bg-gray-600', text: 'text-gray-500', glow: '',          band: 'border-gray-800  bg-gray-900/60'  };
  if (code < 300) return { dot: 'bg-emerald-500', text: 'text-emerald-300', glow: 'shadow-emerald-500/40', band: 'border-emerald-900/50 bg-emerald-950/30' };
  if (code < 400) return { dot: 'bg-blue-500',    text: 'text-blue-300',    glow: 'shadow-blue-500/40',    band: 'border-blue-900/50   bg-blue-950/30'    };
  if (code < 500) return { dot: 'bg-amber-500',   text: 'text-amber-300',   glow: 'shadow-amber-500/40',   band: 'border-amber-900/50  bg-amber-950/30'   };
  return             { dot: 'bg-red-500',     text: 'text-red-300',     glow: 'shadow-red-500/40',     band: 'border-red-900/50    bg-red-950/30'     };
}

function latencyMeta(ms) {
  if (ms == null) return { color: 'text-gray-500', label: '—' };
  if (ms < 50)   return { color: 'text-emerald-400', label: `${ms} ms` };
  if (ms < 200)  return { color: 'text-sky-400',     label: `${ms} ms` };
  if (ms < 600)  return { color: 'text-amber-400',   label: `${ms} ms` };
  return               { color: 'text-red-400',      label: `${ms} ms` };
}

function payloadSize(data) {
  if (data == null) return null;
  try {
    const bytes = new TextEncoder().encode(JSON.stringify(data)).length;
    if (bytes < 1024) return `${bytes} B`;
    return `${(bytes / 1024).toFixed(2)} KB`;
  } catch {
    return null;
  }
}

function contentType(headers) {
  if (!headers) return 'application/json';
  // Axios headers object — try both lowercase and mixed-case
  const ct = headers['content-type'] ?? headers['Content-Type'] ?? '';
  // Strip charset suffix for display
  return ct.split(';')[0].trim() || 'application/json';
}

// ── Route parameter extractor + editor ───────────────────────────────────────

/**
 * Extract all :paramName tokens from a URL string.
 * e.g. "/mock/abc/users/:id/posts/:postId" → ["id", "postId"]
 */
function extractParams(url) {
  const matches = url.match(/:([a-zA-Z_][a-zA-Z0-9_]*)/g);
  return matches ? matches.map((m) => m.slice(1)) : [];
}

/**
 * Substitute param values into the URL template.
 * Leaves unfilled params as their :name placeholder.
 */
function buildResolvedUrl(urlTemplate, paramValues) {
  return urlTemplate.replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, (match, name) => {
    const val = paramValues[name];
    return val && val.trim() ? encodeURIComponent(val.trim()) : match;
  });
}

function RouteParamEditor({ url, paramValues, onChange }) {
  const params = extractParams(url);
  if (!params.length) return null;

  return (
    <div className="flex flex-col gap-2 animate-fade-in">
      {/* Section label */}
      <div className="flex items-center gap-2">
        <div className="flex h-5 w-5 shrink-0 items-center justify-center
                        rounded-md bg-purple-600/20 ring-1 ring-purple-600/40">
          <svg className="h-3 w-3 text-purple-400" fill="none" viewBox="0 0 24 24"
               stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round"
                  d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
          </svg>
        </div>
        <span className="text-xs font-semibold text-gray-400">
          Route Parameters
        </span>
        <span className="ml-auto text-xs text-gray-700">
          {params.length} param{params.length !== 1 ? 's' : ''} detected
        </span>
      </div>

      {/* One input per param */}
      <div className="flex flex-col gap-2 rounded-xl border border-purple-900/30
                      bg-purple-950/10 px-3 py-3">
        {params.map((param) => (
          <div key={param} className="flex items-center gap-2">
            {/* Param name label */}
            <code className="w-28 shrink-0 truncate rounded-md border border-purple-900/40
                             bg-purple-950/30 px-2 py-1.5 font-mono text-xs
                             text-purple-300">
              :{param}
            </code>
            {/* Value input */}
            <input
              type="text"
              className="input flex-1 font-mono text-xs text-gray-200
                         placeholder-gray-700 py-1.5"
              placeholder={`Enter ${param}…`}
              value={paramValues[param] ?? ''}
              onChange={(e) => onChange({ ...paramValues, [param]: e.target.value })}
              aria-label={`Value for route parameter ${param}`}
            />
          </div>
        ))}

        {/* Resolved URL preview */}
        <div className="mt-1 flex items-start gap-1.5 rounded-lg border border-gray-800
                        bg-gray-950/60 px-2.5 py-2">
          <span className="shrink-0 text-xs text-gray-700">→</span>
          <code className="break-all font-mono text-xs text-gray-400 leading-relaxed">
            {buildResolvedUrl(url, paramValues)}
          </code>
        </div>
      </div>
    </div>
  );
}

// ── JSON body editor ──────────────────────────────────────────────────────────

function JsonBodyEditor({ value, onChange }) {
  const [parseError, setParseError] = useState(null);

  const handleChange = useCallback((e) => {
    const raw = e.target.value;
    onChange(raw);
    if (!raw.trim()) { setParseError(null); return; }
    try { JSON.parse(raw); setParseError(null); }
    catch (err) { setParseError(err.message); }
  }, [onChange]);

  const handleFormat = () => {
    if (!value.trim()) return;
    try {
      const pretty = JSON.stringify(JSON.parse(value), null, 2);
      onChange(pretty);
      setParseError(null);
    } catch { /* ignore — user is mid-edit */ }
  };

  const lineCount = value.split('\n').length;

  return (
    <div className="flex flex-col gap-1.5">
      {/* Label row */}
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-gray-500">
          Request Body
          <span className="ml-1.5 text-gray-700">(JSON)</span>
        </label>
        <div className="flex items-center gap-2">
          {/* Line count */}
          <span className="font-mono text-xs text-gray-700 tabular-nums">
            {lineCount} {lineCount === 1 ? 'line' : 'lines'}
          </span>
          {/* Format button */}
          <button
            type="button"
            onClick={handleFormat}
            disabled={!value.trim() || !!parseError}
            className="flex items-center gap-1 rounded-md border border-gray-700
                       bg-gray-800/60 px-2 py-0.5 text-xs text-gray-500
                       transition-all hover:border-gray-600 hover:text-gray-300
                       disabled:opacity-30 disabled:cursor-not-allowed"
            title="Format JSON"
            aria-label="Format JSON body"
          >
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24"
                 stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                    d="M4 6h16M4 12h8m-8 6h16" />
            </svg>
            Format
          </button>
        </div>
      </div>

      {/* Textarea */}
      <div className="relative">
        <textarea
          className={`input min-h-[120px] resize-y font-mono text-xs leading-relaxed
                      text-gray-200 placeholder-gray-700 transition-colors
                      ${parseError
                        ? 'border-red-700/60 focus:border-red-600 focus:ring-red-600/20'
                        : 'focus:border-brand-500'
                      }`}
          placeholder={'{\n  "key": "value"\n}'}
          value={value}
          onChange={handleChange}
          spellCheck={false}
          aria-label="Request body JSON"
          aria-invalid={!!parseError}
          aria-describedby={parseError ? 'body-parse-error' : undefined}
        />
        {/* Valid indicator */}
        {value.trim() && !parseError && (
          <span className="absolute right-2.5 top-2 flex items-center gap-1
                           text-xs font-medium text-emerald-500">
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24"
                 stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Valid JSON
          </span>
        )}
      </div>

      {/* Parse error */}
      {parseError && (
        <p id="body-parse-error"
           className="flex items-start gap-1.5 font-mono text-xs text-red-400
                      animate-fade-in">
          <svg className="mt-0.5 h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24"
               stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round"
                  d="M12 9v2m0 4h.01M12 3a9 9 0 100 18A9 9 0 0012 3z" />
          </svg>
          {parseError}
        </p>
      )}
    </div>
  );
}

function HighlightedJson({ data }) {
  if (data === null || data === undefined) {
    return <span className="json-null">null</span>;
  }
  const text = JSON.stringify(data, null, 2);
  const highlighted = text.replace(
    /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
    (match) => {
      if (/^"/.test(match)) {
        if (/:$/.test(match)) return `<span class="json-key">${match}</span>`;
        return `<span class="json-string">${match}</span>`;
      }
      if (/true|false/.test(match)) return `<span class="json-bool">${match}</span>`;
      if (/null/.test(match))       return `<span class="json-null">${match}</span>`;
      return `<span class="json-number">${match}</span>`;
    }
  );
  return (
    <pre
      className="overflow-x-auto whitespace-pre-wrap break-words font-mono text-xs leading-5"
      dangerouslySetInnerHTML={{ __html: highlighted }} // eslint-disable-line react/no-danger
    />
  );
}

// ── Telemetry card ────────────────────────────────────────────────────────────

/**
 * LatencyBar — animated segmented performance track.
 *
 * Segments light up left-to-right based on latency bucket:
 *   < 50 ms  → 1 of 4 lit (emerald)   "Excellent"
 *   < 200 ms → 2 of 4 lit (sky)       "Good"
 *   < 600 ms → 3 of 4 lit (amber)     "Moderate"
 *   ≥ 600 ms → 4 of 4 lit (red)       "Slow"
 *
 * The fill width animates from 0 → target on mount via CSS transition.
 */
function LatencyBar({ ms }) {
  if (ms == null) return null;

  const segments = [
    { threshold: 50,   label: 'Excellent', fill: 'bg-emerald-500', track: 'bg-emerald-950',  glow: 'shadow-emerald-500/60', pct: 25  },
    { threshold: 200,  label: 'Good',      fill: 'bg-sky-400',     track: 'bg-sky-950',      glow: 'shadow-sky-400/60',     pct: 50  },
    { threshold: 600,  label: 'Moderate',  fill: 'bg-amber-400',   track: 'bg-amber-950',    glow: 'shadow-amber-400/60',   pct: 75  },
    { threshold: Infinity, label: 'Slow',  fill: 'bg-red-500',     track: 'bg-red-950',      glow: 'shadow-red-500/60',     pct: 100 },
  ];

  const active = segments.find((s) => ms < s.threshold) ?? segments[3];
  const activeIdx = segments.indexOf(active);

  // Map raw ms → 0–100% within the active bucket for the fill bar
  const prevThreshold = activeIdx === 0 ? 0 : segments[activeIdx - 1].threshold;
  const range = active.threshold === Infinity
    ? 1200
    : active.threshold - prevThreshold;
  const posInBucket = Math.min(ms - prevThreshold, range) / range;
  const fillPct = (activeIdx / 4 + posInBucket / 4) * 100;

  return (
    <div className="flex flex-col gap-1.5 w-full">
      {/* Segmented track */}
      <div className="flex gap-0.5 w-full" aria-hidden="true">
        {segments.map((seg, i) => (
          <div
            key={seg.label}
            className={`relative h-1.5 flex-1 overflow-hidden rounded-full
                        transition-all duration-500
                        ${i <= activeIdx ? seg.track : 'bg-gray-800'}`}
          >
            {/* Lit segment fill — slides in from left */}
            {i <= activeIdx && (
              <div
                className={`absolute inset-y-0 left-0 rounded-full transition-all
                            duration-700 ease-out ${active.fill}
                            ${i === activeIdx ? '' : 'w-full'}`}
                style={i === activeIdx
                  ? { width: `${Math.round(posInBucket * 100)}%` }
                  : undefined
                }
              />
            )}
          </div>
        ))}
      </div>

      {/* Label + value row */}
      <div className="flex items-center justify-between">
        <span className={`text-xs font-semibold ${active.fill.replace('bg-', 'text-')
          .replace('emerald-500', 'emerald-400')
          .replace('sky-400', 'sky-400')
          .replace('amber-400', 'amber-400')
          .replace('red-500', 'red-400')}`}>
          {active.label}
        </span>
        <span className="font-mono text-xs text-gray-600 tabular-nums">{ms} ms</span>
      </div>
    </div>
  );
}

function TelemetryCard({ icon, label, value, valueClass = 'text-gray-200', sublabel, glowClass = '', latencyMs }) {
  return (
    <div className="flex flex-1 flex-col gap-1.5 rounded-xl border border-gray-800/80
                    bg-gray-900/60 px-3 py-3 backdrop-blur-sm">
      {/* Icon + label row — truncate label on narrow cards */}
      <div className="flex items-center gap-1.5 overflow-hidden">
        <span className="shrink-0 text-gray-600">{icon}</span>
        <span className="truncate text-xs font-medium uppercase tracking-wide text-gray-600">
          {label}
        </span>
      </div>
      {/* Value */}
      <p className={`font-mono text-base font-bold tabular-nums leading-none
                     ${valueClass} ${glowClass ? `drop-shadow ${glowClass}` : ''}`}>
        {value}
      </p>
      {/* Animated latency bar OR plain sublabel */}
      {latencyMs != null
        ? <LatencyBar ms={latencyMs} />
        : sublabel && <p className="truncate text-xs text-gray-600">{sublabel}</p>
      }
    </div>
  );
}

// ── Live Telemetry Dashboard ──────────────────────────────────────────────────

function TelemetryDashboard({ status, latency, responseHeaders, response }) {
  const sm    = statusMeta(status);
  const lm    = latencyMeta(latency);
  const ct    = contentType(responseHeaders);
  const size  = payloadSize(response);
  const label = statusLabel(status);

  return (
    <div className="flex flex-col gap-3 animate-slide-up">
      {/* Dashboard label */}
      <div className="flex items-center gap-2">
        <span className="h-px flex-1 bg-gray-800" />
        <span className="flex items-center gap-1.5 text-xs font-semibold
                         uppercase tracking-widest text-gray-600">
          <span className={`inline-block h-1.5 w-1.5 rounded-full ${sm.dot} animate-pulse`} />
          Live Telemetry
        </span>
        <span className="h-px flex-1 bg-gray-800" />
      </div>

      {/* Four micro-metric cards — 2 cols on mobile, 4 on sm+ */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">

        {/* 1 — Status Code */}
        <TelemetryCard
          icon={
            <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
          label="Status"
          value={status ?? '—'}
          valueClass={sm.text}
          glowClass={sm.glow}
          sublabel={label}
        />

        {/* 2 — Execution Latency */}
        <TelemetryCard
          icon={
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
          label="Latency"
          value={lm.label}
          valueClass={lm.color}
          latencyMs={latency}
        />

        {/* 3 — Content-Type */}
        <TelemetryCard
          icon={
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          }
          label="Content-Type"
          value={ct.includes('json') ? 'JSON' : ct.split('/')[1] ?? ct}
          valueClass="text-sky-300"
          sublabel={ct}
        />

        {/* 4 — Payload Size */}
        <TelemetryCard
          icon={
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
            </svg>
          }
          label="Payload"
          value={size ?? '—'}
          valueClass="text-purple-300"
          sublabel="Response size"
        />
      </div>

      {/* Status band */}
      <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${sm.band}`}>
        <span className={`h-2 w-2 shrink-0 rounded-full ${sm.dot} shadow-lg ${sm.glow}`} />
        <span className={`font-mono text-xs font-semibold tabular-nums ${sm.text}`}>
          {status} {label}
        </span>
        <span className="ml-auto font-mono text-xs text-gray-600">{lm.label}</span>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function RequestRunner() {
  const {
    activeEndpoint,
    runner,
    setRunnerMethod,
    setRunnerBody,
    fireFetch,
  } = usePlaygroundStore();

  const { method, url, body, isFiring, response, status, latency, error, responseHeaders } = runner;
  const hasResult = status !== null || error !== null;

  return (
    <div className="card flex flex-col gap-4">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg
                        bg-brand-600/20 ring-1 ring-brand-600/40">
          <svg className="h-4 w-4 text-brand-400" fill="none" viewBox="0 0 24 24"
               stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round"
                  d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
            <path strokeLinecap="round" strokeLinejoin="round"
                  d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 className="text-sm font-semibold text-gray-200">Request Runner</h2>
        {isFiring && (
          <span className="ml-auto flex items-center gap-1.5 text-xs text-brand-400">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-400 animate-pulse-ring" />
            Firing…
          </span>
        )}
      </div>

      {/* ── Empty state ─────────────────────────────────────────────────────── */}
      {!activeEndpoint ? (
        <div
          className="relative flex flex-col items-center justify-center overflow-hidden
                     rounded-xl py-10 text-center"
          style={{
            backgroundImage:
              'radial-gradient(circle, rgba(98,114,245,0.05) 1px, transparent 1px)',
            backgroundSize: '20px 20px',
          }}
        >
          {/* Corner accents */}
          <span className="pointer-events-none absolute left-0 top-0 h-6 w-px bg-gradient-to-b from-brand-500/40 to-transparent" aria-hidden="true" />
          <span className="pointer-events-none absolute left-0 top-0 h-px w-6 bg-gradient-to-r from-brand-500/40 to-transparent" aria-hidden="true" />
          <span className="pointer-events-none absolute bottom-0 right-0 h-6 w-px bg-gradient-to-t from-brand-500/40 to-transparent" aria-hidden="true" />
          <span className="pointer-events-none absolute bottom-0 right-0 h-px w-6 bg-gradient-to-l from-brand-500/40 to-transparent" aria-hidden="true" />

          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl
                          border border-brand-900/40 bg-gray-900/80 ring-1 ring-brand-900/20"
               style={{ boxShadow: '0 0 16px rgba(98,114,245,0.07)' }}>
            <svg className="h-6 w-6 text-brand-700" fill="none" viewBox="0 0 24 24"
                 stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round"
                    d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5" />
            </svg>
          </div>
          <p className="text-xs text-gray-600">Select an endpoint to fire a live request</p>
        </div>
      ) : (
        <>
          {/* ── Method + URL bar ──────────────────────────────────────────── */}
          <div className="flex min-w-0 items-center gap-2 rounded-lg border
                          border-gray-700 bg-gray-800/60 p-1">
            <select
              className={`shrink-0 rounded-md border-0 bg-gray-800 px-2 py-1.5
                         font-mono text-xs font-bold focus:outline-none
                         focus:ring-1 focus:ring-brand-500
                         ${METHOD_COLORS[method] ?? 'text-gray-300'}`}
              value={method}
              onChange={(e) => setRunnerMethod(e.target.value)}
              aria-label="HTTP method"
            >
              {METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
            <div className="h-4 w-px shrink-0 bg-gray-700" />
            {/* min-w-0 prevents the code element from pushing the flex container wide */}
            <code className="min-w-0 flex-1 truncate pr-1 text-xs text-gray-400"
                  title={url}>
              {url}
            </code>
          </div>

          {/* ── Request body ──────────────────────────────────────────────── */}
          {['POST', 'PUT', 'PATCH'].includes(method) && (
            <JsonBodyEditor value={body} onChange={setRunnerBody} />
          )}

          {/* ── Fire button ───────────────────────────────────────────────── */}
          <button
            className={`btn-primary w-full gap-3 py-2.5 text-sm font-bold tracking-wide
              ${!isFiring ? 'animate-pulse-ring' : ''}`}
            onClick={fireFetch}
            disabled={isFiring}
            aria-busy={isFiring}
          >
            {isFiring ? (
              <>
                <svg className="h-4 w-4 animate-spin-slow" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10"
                          stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor"
                        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
                Firing request…
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24"
                     stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                        d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Fire Live Fetch Hit
              </>
            )}
          </button>

          {/* ── Result area ───────────────────────────────────────────────── */}
          {hasResult && (
            <div className="flex flex-col gap-4">

              {/* Network error */}
              {error && (
                <div className="flex items-start gap-2 rounded-lg border border-red-900/50
                                bg-red-950/40 px-3 py-2.5 animate-fade-in">
                  <svg className="mt-0.5 h-4 w-4 shrink-0 text-red-400" fill="none"
                       viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round"
                          d="M12 9v2m0 4h.01M12 3a9 9 0 100 18A9 9 0 0012 3z" />
                  </svg>
                  <div>
                    <p className="text-xs font-semibold text-red-300">Network Error</p>
                    <p className="mt-0.5 font-mono text-xs text-red-400">{error}</p>
                  </div>
                </div>
              )}

              {/* ── LIVE TELEMETRY DASHBOARD ─────────────────────────────── */}
              {!error && status !== null && (
                <TelemetryDashboard
                  status={status}
                  latency={latency}
                  responseHeaders={responseHeaders}
                  response={response}
                />
              )}

              {/* ── Response body ─────────────────────────────────────────── */}
              {response !== null && response !== undefined && (
                <div className="flex flex-col gap-1.5 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium uppercase tracking-widest text-gray-600">
                      Response Body
                    </span>
                    <div className="flex items-center gap-2">
                      {payloadSize(response) && (
                        <span className="rounded-full bg-gray-800 px-2 py-0.5 font-mono
                                         text-xs text-gray-600">
                          {payloadSize(response)}
                        </span>
                      )}
                      <button
                        className="flex items-center gap-1 rounded-md border border-gray-700
                                   bg-gray-800/60 px-2 py-0.5 text-xs text-gray-600
                                   transition-all hover:border-gray-600 hover:text-gray-400"
                        onClick={() => usePlaygroundStore.getState().clearRunner()}
                        title="Clear response"
                        aria-label="Clear response"
                      >
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24"
                             stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round"
                                d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        Clear
                      </button>
                    </div>
                  </div>
                  {/* Response body container — overflow-hidden prevents horizontal bleed */}
                  <div
                    className="max-h-72 overflow-y-auto overflow-x-hidden rounded-xl
                               border border-gray-800 bg-gray-950/80 px-4 py-3"
                    role="region"
                    aria-label="Response body"
                  >
                    <HighlightedJson data={response} />
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
