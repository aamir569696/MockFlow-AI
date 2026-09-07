import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePlaygroundStore } from '../../store/playgroundStore.js';
import ExportDropdown from './ExportDropdown.jsx';

const METHOD_COLORS = {
  GET:    'method-GET',
  POST:   'method-POST',
  PUT:    'method-PUT',
  PATCH:  'method-PATCH',
  DELETE: 'method-DELETE',
};

const METHOD_TEXT = {
  GET:    'text-emerald-400',
  POST:   'text-blue-400',
  PUT:    'text-amber-400',
  PATCH:  'text-purple-400',
  DELETE: 'text-red-400',
};

// ── Shimmer skeleton ──────────────────────────────────────────────────────────

const SHIMMER_WIDTHS = ['w-2/3', 'w-3/4', 'w-1/2', 'w-5/6', 'w-3/5', 'w-4/5'];

function SkeletonRow({ index }) {
  const barWidth = SHIMMER_WIDTHS[index % SHIMMER_WIDTHS.length];
  return (
    <div
      className="flex items-center gap-3 rounded-lg border border-gray-800/60
                 bg-gray-900/40 px-3 py-3"
      style={{ animationDelay: `${index * 0.07}s` }}
      aria-hidden="true"
    >
      <div className="skeleton h-5 w-12 shrink-0 rounded" />
      <div className={`skeleton h-3 ${barWidth} rounded`} />
      <div className="ml-auto flex shrink-0 gap-1.5">
        <div className="skeleton h-6 w-8 rounded-md" />
        <div className="skeleton h-6 w-10 rounded-md" />
      </div>
    </div>
  );
}

function SkeletonOverlay() {
  return (
    <div className="flex flex-col gap-2" role="status" aria-label="Generating endpoints…">
      <div className="flex items-center gap-2 pb-1">
        <span className="h-1.5 w-1.5 rounded-full bg-brand-500 animate-pulse" />
        <span className="text-xs font-medium text-brand-500 animate-pulse">
          AI is designing your schema…
        </span>
      </div>
      {[...Array(6)].map((_, i) => <SkeletonRow key={i} index={i} />)}
    </div>
  );
}

// ── Futuristic empty state ────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div
      className="relative flex flex-col items-center justify-center overflow-hidden
                 rounded-2xl border border-gray-800/60 px-6 py-10 text-center
                 animate-fade-in"
      style={{
        backgroundImage:
          'radial-gradient(circle, rgba(98,114,245,0.07) 1px, transparent 1px)',
        backgroundSize: '22px 22px',
      }}
    >
      <span className="pointer-events-none absolute left-0 top-0 h-10 w-px bg-gradient-to-b from-brand-500/60 to-transparent" aria-hidden="true" />
      <span className="pointer-events-none absolute left-0 top-0 h-px w-10 bg-gradient-to-r from-brand-500/60 to-transparent" aria-hidden="true" />
      <span className="pointer-events-none absolute bottom-0 right-0 h-10 w-px bg-gradient-to-t from-brand-500/60 to-transparent" aria-hidden="true" />
      <span className="pointer-events-none absolute bottom-0 right-0 h-px w-10 bg-gradient-to-l from-brand-500/60 to-transparent" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(98,114,245,0.08) 0%, transparent 100%)' }} aria-hidden="true" />

      <div className="relative mb-6 flex h-24 w-24 items-center justify-center">
        <div className="absolute inset-0 rounded-full animate-spin-slow" style={{ background: 'conic-gradient(from 0deg, rgba(98,114,245,0.0) 0%, rgba(98,114,245,0.8) 40%, rgba(192,132,252,0.6) 60%, rgba(98,114,245,0.0) 100%)', padding: '1.5px', WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)', WebkitMaskComposite: 'xor', maskComposite: 'exclude' }} aria-hidden="true" />
        <div className="absolute inset-2 rounded-full border border-brand-700/40 animate-pulse" aria-hidden="true" />
        <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-brand-700/30" style={{ background: 'linear-gradient(135deg, rgba(30,29,82,0.9) 0%, rgba(15,15,35,0.95) 100%)', boxShadow: '0 0 24px rgba(98,114,245,0.2), inset 0 1px 0 rgba(255,255,255,0.05)' }}>
          <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="url(#iconGrad)" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
            <defs>
              <linearGradient id="iconGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#8098fb" /><stop offset="50%" stopColor="#6272f5" /><stop offset="100%" stopColor="#c084fc" />
              </linearGradient>
            </defs>
            <path d="M8 9l-3 3 3 3M16 9l3 3-3 3M14 4l-4 16" />
          </svg>
        </div>
        <div className="absolute inset-0 animate-spin" style={{ animationDuration: '8s' }} aria-hidden="true">
          <span className="absolute h-1.5 w-1.5 rounded-full bg-brand-400" style={{ top: '4px', left: '50%', transform: 'translateX(-50%)' }} />
        </div>
        <div className="absolute inset-0 animate-spin" style={{ animationDuration: '12s', animationDirection: 'reverse' }} aria-hidden="true">
          <span className="absolute h-1 w-1 rounded-full bg-purple-400" style={{ bottom: '6px', right: '10px' }} />
        </div>
      </div>

      <h3 className="text-sm font-bold text-gray-300">No endpoints yet</h3>
      <p className="mt-2 max-w-[210px] text-xs leading-relaxed text-gray-600">
        Describe your API on the left and click{' '}
        <span className="font-semibold text-brand-400">Generate Mock API</span> to spin up live, hittable routes instantly.
      </p>
      <div className="mt-6 flex w-full max-w-xs flex-col gap-1.5" aria-hidden="true" style={{ opacity: 0.22 }}>
        {[{ m: 'GET', p: '/api/mock/…/users' }, { m: 'POST', p: '/api/mock/…/users' }, { m: 'DELETE', p: '/api/mock/…/users' }].map(({ m, p }) => (
          <div key={`${m}-${p}`} className="flex items-center gap-2 rounded-lg border border-gray-800/80 bg-gray-900/30 px-3 py-2">
            <span className={`method-badge ${METHOD_COLORS[m] ?? 'method-GET'}`}>{m}</span>
            <code className="text-xs text-gray-600">{p}</code>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Copy icon ─────────────────────────────────────────────────────────────────

function CopyIcon({ copied }) {
  return copied ? (
    <svg className="h-3.5 w-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  ) : (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </svg>
  );
}

// ── Accordion drawer — cURL + payload tabs ────────────────────────────────────

/**
 * Builds the cURL snippet for a specific endpoint.
 * Uses the full page origin so it's immediately runnable.
 */
function buildEndpointCurl(ep, mockPath) {
  const base = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173';
  const full = `${base}${mockPath}`;
  const hasBody = ['POST', 'PUT', 'PATCH'].includes(ep.method);
  const parts = [
    `curl -s -X ${ep.method}`,
    `  -H "Content-Type: application/json"`,
  ];
  if (hasBody) parts.push(`  -d '{"key": "value"}'`);
  parts.push(`  "${full}"`);
  return parts.join(' \\\n');
}

/**
 * Derive a representative payload shape from the schema for this endpoint.
 * Falls back to a generic object if no schema is available.
 */
function buildPayloadPreview(ep, generatedSchema) {
  const resource = ep.resource ?? Object.keys(generatedSchema ?? {})[0];
  const props = generatedSchema?.[resource]?.properties ?? {};
  if (!Object.keys(props).length) return '{\n  "key": "value"\n}';

  const obj = {};
  for (const [field, spec] of Object.entries(props)) {
    const t = spec?.type;
    if (t === 'string')  obj[field] = spec.format === 'uuid' ? '<uuid>' : spec.format === 'email' ? 'user@example.com' : `<${field}>`;
    else if (t === 'number' || t === 'integer') obj[field] = 0;
    else if (t === 'boolean') obj[field] = true;
    else if (t === 'array')   obj[field] = [];
    else                       obj[field] = null;
  }
  return JSON.stringify(obj, null, 2);
}

/** Success metrics reference table for an endpoint. */
const SUCCESS_META = {
  GET:    { status: '200 OK',     desc: 'Returns resource data matching the schema.' },
  POST:   { status: '201 Created',desc: 'Resource created. Body merged with mock data.' },
  PUT:    { status: '200 OK',     desc: 'Resource updated. Body merged with mock data.' },
  PATCH:  { status: '200 OK',     desc: 'Partial update applied to mock resource.' },
  DELETE: { status: '204 No Content', desc: 'Resource deleted. Empty response body.' },
};

function EndpointDrawer({ ep, mockPath, generatedSchema }) {
  const [tab, setTab]     = useState('curl');   // 'curl' | 'payload' | 'metrics'
  const [curlCopied, setCurlCopied] = useState(false);

  const curlStr    = buildEndpointCurl(ep, mockPath);
  const payloadStr = buildPayloadPreview(ep, generatedSchema);
  const metrics    = SUCCESS_META[ep.method] ?? SUCCESS_META.GET;

  const copyCurl = () => {
    navigator.clipboard.writeText(curlStr).catch(() => {});
    setCurlCopied(true);
    setTimeout(() => setCurlCopied(false), 1800);
  };

  const TABS = [
    { id: 'curl',    label: '$ cURL' },
    { id: 'payload', label: '📦 Payload' },
    { id: 'metrics', label: '✅ Metrics' },
  ];

  return (
    /* Animate open — max-height transition via CSS */
    <div
      className="overflow-hidden animate-fade-in"
      style={{ animationDuration: '0.18s' }}
    >
      <div
        className="mx-1 mb-1 overflow-hidden rounded-b-xl border border-t-0
                   border-indigo-900/30"
        style={{ background: 'rgba(13,17,35,0.85)', backdropFilter: 'blur(6px)' }}
      >
        {/* Tab bar */}
        <div className="flex border-b border-gray-800/50 bg-gray-900/40 px-2 pt-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`mr-0.5 rounded-t-md px-3 py-1.5 text-[11px] font-semibold
                          transition-all duration-100 focus-visible:outline-none
                          focus-visible:ring-2 focus-visible:ring-indigo-500
                          ${tab === t.id
                            ? 'bg-gray-800 text-gray-100'
                            : 'text-gray-600 hover:bg-gray-800/50 hover:text-gray-400'
                          }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── cURL tab ─────────────────────────────────────────────── */}
        {tab === 'curl' && (
          <div className="relative px-3 py-3">
            {/* Copy button */}
            <button
              onClick={copyCurl}
              className={`absolute right-3 top-3 flex items-center gap-1.5 rounded-md
                          border px-2 py-0.5 text-[10px] font-semibold
                          transition-all duration-150
                          ${curlCopied
                            ? 'border-emerald-800/60 bg-emerald-950/40 text-emerald-400'
                            : 'border-gray-700 bg-gray-800/60 text-gray-500 hover:text-gray-300'
                          }`}
              aria-label="Copy cURL command"
            >
              {curlCopied ? '✓ Copied' : 'Copy'}
            </button>

            {/* Terminal block */}
            <div
              className="overflow-hidden rounded-lg border border-indigo-900/20"
              style={{
                backgroundImage: 'radial-gradient(circle, rgba(99,102,241,0.04) 1px, transparent 1px)',
                backgroundSize: '18px 18px',
              }}
            >
              <div className="flex items-center gap-1.5 border-b border-gray-800/40 bg-gray-900/60 px-3 py-1" aria-hidden="true">
                <span className="h-1.5 w-1.5 rounded-full bg-red-500/60" />
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500/60" />
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500/60" />
                <span className="ml-2 font-mono text-[9px] text-gray-700">bash</span>
              </div>
              <pre className="overflow-x-auto px-3 py-2.5 font-mono text-[11px] leading-relaxed text-emerald-300/90 whitespace-pre">
                <span className="select-none text-indigo-400/70">$ </span>{curlStr}
              </pre>
            </div>
          </div>
        )}

        {/* ── Expected Payload tab ──────────────────────────────────── */}
        {tab === 'payload' && (
          <div className="px-3 py-3">
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-gray-600">
              Expected {['POST', 'PUT', 'PATCH'].includes(ep.method) ? 'Request' : 'Response'} Shape
            </p>
            <pre
              className="max-h-48 overflow-y-auto rounded-lg border border-gray-800
                         bg-gray-950/70 px-3 py-2.5 font-mono text-[11px]
                         leading-relaxed text-sky-300/90 whitespace-pre-wrap"
            >
              {payloadStr}
            </pre>
            {['POST', 'PUT', 'PATCH'].includes(ep.method) && (
              <p className="mt-1.5 text-[10px] text-gray-700">
                Fields sent in the request body override matching generated values.
              </p>
            )}
          </div>
        )}

        {/* ── Success Metrics tab ───────────────────────────────────── */}
        {tab === 'metrics' && (
          <div className="px-3 py-3">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-gray-600">
              Success Metrics
            </p>
            <div className="flex flex-col gap-2">
              {/* Status code */}
              <div className="flex items-center gap-2 rounded-lg border border-gray-800/60 bg-gray-900/40 px-3 py-2">
                <span className="shrink-0 text-[10px] font-semibold uppercase tracking-widest text-gray-700 w-20">Status</span>
                <span className={`font-mono text-xs font-bold ${METHOD_TEXT[ep.method] ?? 'text-gray-300'}`}>
                  {metrics.status}
                </span>
              </div>
              {/* Behavior */}
              <div className="flex items-start gap-2 rounded-lg border border-gray-800/60 bg-gray-900/40 px-3 py-2">
                <span className="shrink-0 text-[10px] font-semibold uppercase tracking-widest text-gray-700 w-20 mt-0.5">Behavior</span>
                <span className="text-xs text-gray-400 leading-relaxed">{metrics.desc}</span>
              </div>
              {/* Headers echoed */}
              <div className="flex items-center gap-2 rounded-lg border border-gray-800/60 bg-gray-900/40 px-3 py-2">
                <span className="shrink-0 text-[10px] font-semibold uppercase tracking-widest text-gray-700 w-20">Echo</span>
                <span className="font-mono text-[10px] text-indigo-400">X-Echo-x-custom-* headers reflected</span>
              </div>
              {/* Seed */}
              <div className="flex items-center gap-2 rounded-lg border border-gray-800/60 bg-gray-900/40 px-3 py-2">
                <span className="shrink-0 text-[10px] font-semibold uppercase tracking-widest text-gray-700 w-20">Seed</span>
                <span className="font-mono text-[10px] text-amber-400">?seed=true for deterministic output</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── EndpointPreview ───────────────────────────────────────────────────────────

export default function EndpointPreview() {
  const {
    endpoints, sessionId, activeEndpoint, setActiveEndpoint,
    isGenerating, clearWorkspace, generatedSchema,
  } = usePlaygroundStore();

  const [copiedSlug,   setCopiedSlug]   = useState(null);
  const [confirmClear, setConfirmClear] = useState(false);
  // Track which accordion is open — key = `${index}-${method}-${slug}`
  const [openDrawer,   setOpenDrawer]   = useState(null);

  const copyUrl = (url, slug) => {
    navigator.clipboard.writeText(window.location.origin + url).catch(() => {});
    setCopiedSlug(slug);
    setTimeout(() => setCopiedSlug(null), 1800);
  };

  const handleClear = () => {
    if (!confirmClear) {
      setConfirmClear(true);
      setTimeout(() => setConfirmClear(false), 2800);
      return;
    }
    clearWorkspace();
    setConfirmClear(false);
    setOpenDrawer(null);
  };

  const toggleDrawer = (key, ep) => {
    setOpenDrawer(prev => prev === key ? null : key);
    // Also activate endpoint in runner when opening
    setActiveEndpoint(ep);
  };

  return (
    <div className="card flex flex-col gap-3">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg
                          bg-emerald-600/20 ring-1 ring-emerald-600/40">
            <svg className="h-4 w-4 text-emerald-400" fill="none" viewBox="0 0 24 24"
                 stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                    d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656
                       l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0
                       00-5.656-5.656l-1.1 1.1" />
            </svg>
          </div>
          <h2 className="text-sm font-semibold text-gray-200">Endpoints</h2>
        </div>

        <div className="flex items-center gap-2">
          {endpoints.length > 0 && (
            <span className="rounded-full bg-brand-900/60 px-2 py-0.5 text-xs
                             font-semibold text-brand-300 ring-1 ring-brand-700/50">
              {endpoints.length}
            </span>
          )}
          {endpoints.length > 0 && <ExportDropdown compact />}
          {(endpoints.length > 0 || isGenerating) && (
            <button
              className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5
                          text-xs font-semibold transition-all duration-150
                          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500
                          ${confirmClear
                            ? 'border-red-700/60 bg-red-950/50 text-red-300 ring-1 ring-red-700/40'
                            : 'border-gray-700 bg-gray-800/60 text-gray-500 hover:border-red-800/60 hover:bg-red-950/30 hover:text-red-400'
                          }`}
              onClick={handleClear}
              title={confirmClear ? 'Click again to confirm reset' : 'Clear workspace'}
              aria-label={confirmClear ? 'Confirm clear workspace' : 'Clear workspace'}
            >
              {confirmClear ? (
                <><svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M12 3a9 9 0 100 18A9 9 0 0012 3z" /></svg>Confirm?</>
              ) : (
                <><svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>Clear</>
              )}
            </button>
          )}
        </div>
      </div>

      {/* ── Shimmer ────────────────────────────────────────────────────── */}
      {isGenerating && <SkeletonOverlay />}

      {/* ── Empty state ────────────────────────────────────────────────── */}
      {!isGenerating && !endpoints.length && <EmptyState />}

      {/* ── Endpoint accordion list ────────────────────────────────────── */}
      {!isGenerating && endpoints.length > 0 && (
        <motion.ul
          className="flex flex-col gap-1"
          role="list"
          variants={{
            hidden: {},
            show:   { transition: { staggerChildren: 0.04 } },
          }}
          initial="hidden"
          animate="show"
        >
          {endpoints.map((ep, index) => {
            const mockPath    = `/api/mock/${sessionId}/${ep.slug}`;
            const drawerKey   = `${index}-${ep.method}-${ep.slug}`;
            const isActive    = activeEndpoint?.slug === ep.slug && activeEndpoint?.method === ep.method;
            const isOpen      = openDrawer === drawerKey;
            const methodClass = METHOD_COLORS[ep.method] ?? 'method-GET';

            return (
              <motion.li
                key={drawerKey}
                className="flex flex-col"
                variants={{
                  hidden: { opacity: 0, y: 14, scale: 0.98 },
                  show:   { opacity: 1, y: 0,  scale: 1,
                    transition: { type: 'spring', stiffness: 340, damping: 26 } },
                }}
              >

                {/* ── Route card (accordion trigger) ───────────────── */}
                <div
                  className={`group relative flex cursor-pointer items-center gap-2
                    rounded-lg px-3 py-2.5 transition-all duration-150 select-none
                    border
                    ${isOpen
                      ? 'rounded-b-none border-indigo-900/40 bg-indigo-950/20 ring-1 ring-indigo-900/30'
                      : isActive
                        ? 'border-brand-700/60 bg-brand-950/40 ring-1 ring-brand-700/30'
                        : 'border-gray-800 bg-gray-800/30 hover:border-gray-700 hover:bg-gray-800/60'
                    }`}
                  onClick={() => toggleDrawer(drawerKey, ep)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleDrawer(drawerKey, ep)}
                  aria-expanded={isOpen}
                  aria-label={`${ep.method} ${mockPath}`}
                >
                  {/* Active left-edge indicator */}
                  {(isActive || isOpen) && !isOpen && (
                    <div className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-r bg-brand-500" />
                  )}

                  {/* Method badge */}
                  <span className={`method-badge ${methodClass}`}>{ep.method ?? 'GET'}</span>

                  {/* Path + description — single line, ellipsis on tiny screens */}
                  <div className="flex min-w-0 flex-1 flex-col">
                    <code className="block max-w-[180px] overflow-hidden truncate whitespace-nowrap
                                     font-mono text-xs text-gray-300 group-hover:text-gray-100
                                     transition-colors sm:max-w-full"
                          title={mockPath}>
                      {mockPath}
                    </code>
                    {ep.description && (
                      <p className="truncate text-xs text-gray-600 mt-0.5">{ep.description}</p>
                    )}
                  </div>

                  {/* Actions row */}
                  <div className="flex shrink-0 items-center gap-1.5
                                  opacity-100 [@media(hover:hover)]:opacity-0
                                  [@media(hover:hover)]:group-hover:opacity-100
                                  transition-opacity">
                    <button
                      className={`btn-ghost rounded-md p-1.5 text-xs ${copiedSlug === ep.slug ? 'text-emerald-400' : ''}`}
                      onClick={(e) => { e.stopPropagation(); copyUrl(mockPath, ep.slug); }}
                      aria-label={`Copy URL for ${ep.slug}`}
                      title="Copy URL"
                    >
                      <CopyIcon copied={copiedSlug === ep.slug} />
                    </button>
                    <button
                      className="btn-primary rounded-md px-2 py-1 text-xs"
                      onClick={(e) => { e.stopPropagation(); setActiveEndpoint(ep); }}
                      aria-label={`Try ${ep.slug}`}
                      title="Open in Request Runner"
                    >
                      Try →
                    </button>
                  </div>

                  {/* Chevron — right-most, indicates accordion state */}
                  <svg
                    className={`ml-0.5 h-3.5 w-3.5 shrink-0 text-gray-600
                                transition-transform duration-200
                                ${isOpen ? 'rotate-180 text-indigo-400' : ''}`}
                    fill="none" viewBox="0 0 24 24"
                    stroke="currentColor" strokeWidth={2.5}
                    aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>

                {/* ── Accordion drawer — spring expand ─────────── */}
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      key="drawer"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ type: 'spring', stiffness: 260, damping: 22 }}
                      style={{ overflow: 'hidden' }}
                    >
                      <EndpointDrawer
                        ep={ep}
                        mockPath={mockPath}
                        generatedSchema={generatedSchema}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.li>
            );
          })}
        </motion.ul>
      )}
    </div>
  );
}
