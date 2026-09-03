import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore.js';
import { usePlaygroundStore } from '../store/playgroundStore.js';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const METHOD_META = {
  GET:    { bg: 'bg-emerald-950', text: 'text-emerald-400', ring: 'ring-emerald-800' },
  POST:   { bg: 'bg-blue-950',    text: 'text-blue-400',    ring: 'ring-blue-800'    },
  PUT:    { bg: 'bg-amber-950',   text: 'text-amber-400',   ring: 'ring-amber-800'   },
  PATCH:  { bg: 'bg-purple-950',  text: 'text-purple-400',  ring: 'ring-purple-800'  },
  DELETE: { bg: 'bg-red-950',     text: 'text-red-400',     ring: 'ring-red-800'     },
};

function methodMeta(m) {
  return METHOD_META[m] ?? { bg: 'bg-gray-900', text: 'text-gray-400', ring: 'ring-gray-700' };
}

function statusColor(s) {
  if (!s) return 'text-gray-600';
  if (s < 300) return 'text-emerald-400';
  if (s < 400) return 'text-blue-400';
  if (s < 500) return 'text-amber-400';
  return 'text-red-400';
}

function relativeTime(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60)  return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60)  return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Pure-SVG sparkline (no external dep)
// ─────────────────────────────────────────────────────────────────────────────

function Sparkline({ values, color = '#6272f5', height = 40, className = '' }) {
  if (!values?.length) return null;
  const w = 200;
  const h = height;
  const pad = 4;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const step = (w - pad * 2) / (values.length - 1 || 1);

  const points = values.map((v, i) => {
    const x = pad + i * step;
    const y = h - pad - ((v - min) / range) * (h - pad * 2);
    return `${x},${y}`;
  });

  const areaPoints = [
    `${pad},${h}`,
    ...points,
    `${pad + (values.length - 1) * step},${h}`,
  ];

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className={`w-full ${className}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`sg-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0"    />
        </linearGradient>
      </defs>
      {/* Area fill */}
      <polygon
        points={areaPoints.join(' ')}
        fill={`url(#sg-${color.replace('#', '')})`}
      />
      {/* Line */}
      <polyline
        points={points.join(' ')}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* End dot */}
      <circle
        cx={points[points.length - 1].split(',')[0]}
        cy={points[points.length - 1].split(',')[1]}
        r="2.5"
        fill={color}
      />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Metric card
// ─────────────────────────────────────────────────────────────────────────────

function MetricCard({ icon, label, value, sub, sparkValues, sparkColor, glowColor, trend, animDelay = '0s' }) {
  return (
    <div
      className="relative flex flex-col gap-3 overflow-hidden rounded-2xl
                 border border-gray-800/80 bg-gray-900/60 p-4
                 backdrop-blur-sm transition-all duration-300
                 hover:border-gray-700 hover:bg-gray-900/80
                 animate-fade-in"
      style={{ animationDelay: animDelay }}
    >
      {/* Glow accent top-right */}
      {glowColor && (
        <div
          className="pointer-events-none absolute -right-6 -top-6 h-24 w-24
                     rounded-full blur-2xl opacity-20"
          style={{ background: glowColor }}
          aria-hidden="true"
        />
      )}

      {/* Header row — label truncates instead of overflowing on narrow cards */}
      <div className="flex min-w-0 items-center justify-between gap-1">
        <div className="flex min-w-0 items-center gap-1.5 overflow-hidden">
          <span className="shrink-0 text-gray-500">{icon}</span>
          <span className="truncate text-xs font-medium uppercase tracking-wide text-gray-600">
            {label}
          </span>
        </div>
        {trend != null && (
          <span className={`shrink-0 flex items-center gap-0.5 rounded-full px-1.5 py-0.5
                            text-xs font-semibold
                            ${trend >= 0 ? 'bg-emerald-950/60 text-emerald-400' : 'bg-red-950/60 text-red-400'}`}>
            {trend >= 0 ? '▲' : '▼'}{Math.abs(trend)}%
          </span>
        )}
      </div>

      {/* Value */}
      <div>
        <p className="font-mono text-2xl font-bold tabular-nums text-white">
          {value}
        </p>
        {sub && <p className="mt-0.5 text-xs text-gray-600">{sub}</p>}
      </div>

      {/* Sparkline */}
      {sparkValues && (
        <Sparkline values={sparkValues} color={sparkColor ?? '#6272f5'} height={36} />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Endpoint tree row
// ─────────────────────────────────────────────────────────────────────────────

function EndpointRow({ ep, index, sessionId }) {
  const meta = methodMeta(ep.method);
  return (
    <div
      className="group flex items-center gap-3 rounded-xl border border-gray-800/50
                 bg-gray-900/40 px-3 py-2.5 transition-all duration-200
                 hover:border-gray-700/80 hover:bg-gray-800/50 animate-fade-in"
      style={{ animationDelay: `${index * 0.04}s` }}
    >
      {/* Index */}
      <span className="w-5 shrink-0 text-center font-mono text-xs text-gray-700">
        {String(index + 1).padStart(2, '0')}
      </span>

      {/* Method badge */}
      <span className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-xs
                        font-bold ring-1 ${meta.bg} ${meta.text} ${meta.ring}`}>
        {ep.method}
      </span>

      {/* Path */}
      <code className="min-w-0 flex-1 break-all text-xs text-gray-300
                       group-hover:text-gray-100 transition-colors">
        <span className="hidden sm:inline">/api/mock/{sessionId?.slice(0, 8)}…/</span>
        {ep.slug}
      </code>

      {/* Description — hidden on mobile to avoid overflow */}
      <span className="hidden lg:block shrink-0 truncate max-w-[160px] text-xs text-gray-600">
        {ep.description}
      </span>

      {/* Collection badge */}
      {ep.isCollection && (
        <span className="shrink-0 rounded-full bg-brand-950/60 px-2 py-0.5
                         text-xs text-brand-400 ring-1 ring-brand-800/50">
          list
        </span>
      )}

      {/* Live indicator */}
      <span className="shrink-0 flex items-center gap-1 text-xs text-emerald-600">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
        live
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Network log row
// ─────────────────────────────────────────────────────────────────────────────

function LogRow({ entry, index }) {
  const meta = methodMeta(entry.method);
  const isNew = index === 0;
  return (
    <div
      className={`flex items-center gap-2 rounded-lg px-3 py-2
                  transition-all duration-300 animate-fade-in
                  ${isNew
                    ? 'border border-brand-800/40 bg-brand-950/20'
                    : 'border border-transparent hover:bg-gray-800/40'
                  }`}
    >
      {/* Pulse dot */}
      <span className={`shrink-0 h-1.5 w-1.5 rounded-full
                        ${entry.error ? 'bg-red-500' : 'bg-emerald-500'}
                        ${isNew ? 'animate-pulse-ring' : ''}`} />

      {/* Method */}
      <span className={`shrink-0 w-12 font-mono text-xs font-bold ${meta.text}`}>
        {entry.method}
      </span>

      {/* Slug — flex-1 with break-all so long slugs don't push other columns */}
      <code className="min-w-0 flex-1 truncate font-mono text-xs text-gray-400">
        /{entry.slug}
      </code>

      {/* Status */}
      <span className={`shrink-0 w-10 font-mono text-xs font-bold tabular-nums
                        ${statusColor(entry.status)}`}>
        {entry.status ?? 'ERR'}
      </span>

      {/* Latency */}
      <span className="shrink-0 w-12 font-mono text-xs tabular-nums text-gray-600">
        {entry.latency != null ? `${entry.latency}ms` : '—'}
      </span>

      {/* Timestamp — hidden on narrow screens */}
      <span className="hidden shrink-0 w-16 text-right text-xs text-gray-700 sm:block">
        {relativeTime(entry.ts)}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Collection card
// ─────────────────────────────────────────────────────────────────────────────

function CollectionCard({ col, onSelect, isActive }) {
  return (
    <button
      className={`w-full text-left flex flex-col gap-2 rounded-xl border p-3
                  transition-all duration-200 animate-fade-in
                  ${isActive
                    ? 'border-brand-700/60 bg-brand-950/30 ring-1 ring-brand-700/30'
                    : 'border-gray-800 bg-gray-900/50 hover:border-gray-700 hover:bg-gray-800/40'
                  }`}
      onClick={onSelect}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold text-gray-200 truncate">{col.apiName}</p>
        <span className="shrink-0 rounded-full bg-gray-800 px-1.5 py-0.5
                         font-mono text-xs text-gray-500">
          {col.endpoints.length}
        </span>
      </div>
      <p className="truncate text-xs text-gray-600">{col.apiDescription || 'No description'}</p>
      <div className="flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
        <span className="text-xs text-gray-700">{relativeTime(col.savedAt)}</span>
      </div>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DashboardPage
// ─────────────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { isAuthenticated, user, sandboxApiKey, savedCollections } = useAuthStore();
  const { requestLog } = usePlaygroundStore();
  const navigate = useNavigate();

  const [activeColIdx, setActiveColIdx] = useState(0);

  // Auth guard
  useEffect(() => {
    if (!isAuthenticated) navigate('/playground', { replace: true });
  }, [isAuthenticated, navigate]);

  if (!isAuthenticated) return null;

  const activeCol = savedCollections[activeColIdx] ?? null;

  // ── Derived metrics ────────────────────────────────────────────────────────
  const totalEndpoints = savedCollections.reduce((s, c) => s + c.endpoints.length, 0);
  const totalRequests  = requestLog.length;

  // Sparkline: last 10 requests latencies (or placeholders)
  const latencySpark = requestLog.length
    ? requestLog.slice(0, 10).map(r => r.latency ?? 31).reverse()
    : [18, 24, 20, 31, 28, 22, 31, 26, 29, 31];

  // Sparkline: request volume — last 10 bucketed by index (placeholder curve)
  const volumeSpark = requestLog.length
    ? requestLog.slice(0, 10).map((_, i) => requestLog.length - i).reverse()
    : [1, 3, 2, 5, 4, 6, 5, 8, 7, totalRequests || 10];

  const avgLatency = requestLog.length
    ? Math.round(requestLog.reduce((s, r) => s + (r.latency ?? 31), 0) / requestLog.length)
    : 31;

  const successRate = requestLog.length
    ? Math.round((requestLog.filter(r => r.status && r.status < 400).length / requestLog.length) * 100)
    : 100;

  return (
    <div className="relative min-h-dvh bg-gray-950 text-gray-100">

      {/* ── Global background glows ──────────────────────────────────────── */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-1/4 top-0 h-[500px] w-[700px]
                        -translate-y-1/2 rounded-full bg-brand-700/8 blur-3xl" />
        <div className="absolute bottom-0 right-1/4 h-[400px] w-[600px]
                        translate-y-1/3 rounded-full bg-purple-700/6 blur-3xl" />
      </div>

      {/* ── Nav ──────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 flex items-center justify-between
                         border-b border-gray-800/80 bg-gray-950/90
                         backdrop-blur-md px-5 py-3 animate-fade-in">
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg
                            bg-brand-600 shadow-lg shadow-brand-900/50
                            transition-transform group-hover:scale-105">
              <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24"
                   stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round"
                      d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span className="text-sm font-bold tracking-tight">
              Mock<span className="text-brand-400">Flow</span>
              <span className="ml-1 font-normal text-gray-600">AI</span>
            </span>
          </Link>

          <span className="hidden sm:block text-gray-700">/</span>
          <span className="hidden sm:block text-sm font-medium text-gray-400">
            Dashboard
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* API key pill */}
          {sandboxApiKey && (
            <div className="hidden sm:flex items-center gap-1.5 rounded-full
                            border border-emerald-800/50 bg-emerald-950/40
                            px-3 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-mono text-xs text-emerald-400">{sandboxApiKey}</span>
            </div>
          )}

          {/* User pill */}
          <div className="flex items-center gap-2 rounded-full border border-gray-800
                          bg-gray-900 px-3 py-1">
            <div className="flex h-5 w-5 items-center justify-center rounded-full
                            bg-brand-600/30 text-xs font-bold text-brand-400">
              {user?.displayName?.[0] ?? 'D'}
            </div>
            <span className="hidden sm:block text-xs text-gray-400">
              {user?.displayName ?? 'Developer'}
            </span>
          </div>

          <Link to="/playground" className="btn-ghost py-1.5 px-3 text-xs">
            ← Playground
          </Link>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-7xl px-4 py-6 sm:px-6">

        {/* ── Page title ───────────────────────────────────────────────── */}
        <div className="mb-6 animate-fade-in">
          <h1 className="text-xl font-bold text-white">Analytics Dashboard</h1>
          <p className="mt-0.5 text-sm text-gray-600">
            {savedCollections.length} collection{savedCollections.length !== 1 ? 's' : ''} saved
            · {totalEndpoints} endpoints live
            · Session sandbox
          </p>
        </div>

        {/* ── Metric cards row ─────────────────────────────────────────── */}
        {/* 2 cols on mobile → 4 cols on sm+ */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MetricCard
            animDelay="0s"
            glowColor="#6272f5"
            sparkColor="#6272f5"
            sparkValues={volumeSpark}
            trend={12}
            icon={
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24"
                   stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            }
            label="Total Request Volume"
            value={totalRequests || '0'}
            sub="All-time mock hits"
          />

          <MetricCard
            animDelay="0.05s"
            glowColor="#34d399"
            sparkColor="#34d399"
            sparkValues={latencySpark}
            trend={-8}
            icon={
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24"
                   stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
            label="Avg Response Time"
            value={`${avgLatency}ms`}
            sub="Last 10 requests"
          />

          <MetricCard
            animDelay="0.1s"
            glowColor="#a78bfa"
            icon={
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24"
                   stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                      d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            }
            label="Live Endpoints"
            value={totalEndpoints}
            sub={`${savedCollections.length} collection${savedCollections.length !== 1 ? 's' : ''}`}
          />

          <MetricCard
            animDelay="0.15s"
            glowColor="#34d399"
            icon={
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24"
                   stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
            label="Success Rate"
            value={`${successRate}%`}
            sub="2xx responses"
          />
        </div>

        {/* ── Main grid: collections sidebar + endpoint tree ───────────── */}
        {/* Single column on mobile/tablet → side-by-side on lg+ */}
        <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-[240px_1fr]">

          {/* Collections sidebar */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-600">
                Collections
              </h2>
              <Link to="/playground"
                    className="text-xs text-brand-500 hover:text-brand-400 transition-colors">
                + New
              </Link>
            </div>

            {savedCollections.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl
                              border border-dashed border-gray-800 py-10 text-center">
                <p className="text-xs text-gray-700">No saved collections yet</p>
                <Link to="/playground"
                      className="mt-2 text-xs text-brand-500 hover:underline">
                  Generate an API →
                </Link>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {savedCollections.map((col, i) => (
                  <CollectionCard
                    key={col.id}
                    col={col}
                    isActive={i === activeColIdx}
                    onSelect={() => setActiveColIdx(i)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Endpoint tree */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-600">
                {activeCol ? activeCol.apiName : 'Endpoint Tree'}
              </h2>
              {activeCol && (
                <span className="text-xs text-gray-700">
                  {activeCol.endpoints.length} routes
                  · session <span className="font-mono">{activeCol.sessionId?.slice(0, 8)}…</span>
                </span>
              )}
            </div>

            {!activeCol ? (
              <div className="flex flex-col items-center justify-center rounded-xl
                              border border-dashed border-gray-800 py-16 text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center
                                rounded-xl bg-gray-800 ring-1 ring-gray-700">
                  <svg className="h-6 w-6 text-gray-600" fill="none"
                       viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round"
                          d="M8 9l3 3-3 3m5 0h3" />
                  </svg>
                </div>
                <p className="text-xs text-gray-700">
                  Save a mock API to see its endpoint tree here
                </p>
              </div>
            ) : (
              <div className="rounded-2xl border border-gray-800/60
                              bg-gray-900/30 backdrop-blur-sm overflow-hidden">
                {/* Tree header */}
                <div className="flex items-center gap-2 border-b border-gray-800/60
                                bg-gray-900/60 px-4 py-2.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs text-gray-500 font-mono">
                    /api/mock/{activeCol.sessionId?.slice(0, 8)}…/
                  </span>
                  <span className="ml-auto rounded-full bg-emerald-950/60 px-2 py-0.5
                                   text-xs font-semibold text-emerald-400
                                   ring-1 ring-emerald-800/50">
                    {activeCol.endpoints.length} live
                  </span>
                </div>

                {/* Rows */}
                <div className="flex flex-col gap-1 p-3 max-h-96 overflow-y-auto">
                  {activeCol.endpoints.map((ep, i) => (
                    <EndpointRow
                      key={`${ep.method}-${ep.slug}-${i}`}
                      ep={ep}
                      index={i}
                      sessionId={activeCol.sessionId}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Live network log ─────────────────────────────────────────── */}
        <div className="rounded-2xl border border-gray-800/60
                        bg-gray-900/30 backdrop-blur-sm overflow-hidden
                        animate-fade-in" style={{ animationDelay: '0.2s' }}>

          {/* Log header */}
          <div className="flex items-center justify-between border-b border-gray-800/60
                          bg-gray-900/60 px-4 py-2.5">
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full
                ${requestLog.length ? 'bg-emerald-500 animate-pulse' : 'bg-gray-700'}`} />
              <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500">
                Live Network Log
              </h2>
            </div>
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-gray-800 px-2 py-0.5
                               font-mono text-xs text-gray-600">
                {requestLog.length} events
              </span>
            </div>
          </div>

          {/* Column header — hidden on mobile (too narrow), visible sm+ */}
          <div className="hidden border-b border-gray-800/40 bg-gray-900/40
                          px-3 py-1.5 sm:grid
                          sm:grid-cols-[16px_52px_1fr_44px_52px_72px] sm:gap-3">
            {['', 'METHOD', 'ROUTE', 'STATUS', 'TIME', 'WHEN'].map((h) => (
              <span key={h} className="text-xs font-semibold uppercase
                                       tracking-widest text-gray-700">
                {h}
              </span>
            ))}
          </div>

          {/* Log rows */}
          <div className="max-h-64 overflow-y-auto">
            {requestLog.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <p className="text-xs text-gray-700">
                  No requests yet — fire a live fetch hit from the Playground
                </p>
                <Link to="/playground"
                      className="mt-2 text-xs text-brand-500 hover:underline">
                  Go to Playground →
                </Link>
              </div>
            ) : (
              <div className="flex flex-col divide-y divide-gray-800/30 px-1 py-1">
                {requestLog.map((entry, i) => (
                  <LogRow key={entry.id} entry={entry} index={i} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Footer ───────────────────────────────────────────────────── */}
        <footer className="mt-8 text-center text-xs text-gray-800">
          MockFlow AI · Sandbox Dashboard · All data is session-local
        </footer>
      </main>
    </div>
  );
}
