import { useState } from 'react';
import { usePlaygroundStore } from '../../store/playgroundStore.js';

const METHOD_COLORS = {
  GET:    'text-emerald-400',
  POST:   'text-blue-400',
  PUT:    'text-amber-400',
  PATCH:  'text-purple-400',
  DELETE: 'text-red-400',
};

const CATEGORY_LABELS = {
  valid:        { label: 'Valid',        cls: 'text-emerald-400 bg-emerald-950/40 ring-emerald-800/50' },
  invalid_type: { label: 'Invalid type', cls: 'text-amber-400 bg-amber-950/40 ring-amber-800/50' },
  missing_field:{ label: 'Missing field',cls: 'text-orange-400 bg-orange-950/40 ring-orange-800/50' },
  edge_case:    { label: 'Edge case',    cls: 'text-purple-400 bg-purple-950/40 ring-purple-800/50' },
  invalid_id:   { label: 'Invalid id',   cls: 'text-pink-400 bg-pink-950/40 ring-pink-800/50' },
  auth:         { label: 'Auth',         cls: 'text-sky-400 bg-sky-950/40 ring-sky-800/50' },
};

function catMeta(c) {
  return CATEGORY_LABELS[c] ?? { label: c ?? 'test', cls: 'text-gray-400 bg-gray-800 ring-gray-700' };
}

// Summary bar colour by pass percentage.
function barColor(pct) {
  if (pct >= 80) return { bar: 'bg-emerald-500', text: 'text-emerald-400' };
  if (pct >= 50) return { bar: 'bg-amber-500',   text: 'text-amber-400' };
  return             { bar: 'bg-red-500',     text: 'text-red-400' };
}

// ── One result row (expandable) ─────────────────────────────────────────────────
function ResultRow({ r }) {
  const [open, setOpen] = useState(false);
  const mColor = METHOD_COLORS[r.method] ?? 'text-gray-400';
  const cm = catMeta(r.category);

  return (
    <div className={`rounded-lg border transition-colors
                     ${r.pass ? 'border-emerald-900/40 bg-emerald-950/10' : 'border-red-900/40 bg-red-950/10'}`}>
      {/* Row header — click to expand */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
        aria-expanded={open}
      >
        {/* Pass/fail icon */}
        <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold
                          ${r.pass ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
          {r.pass ? '✓' : '✕'}
        </span>
        <span className={`shrink-0 font-mono text-[10px] font-bold ${mColor}`}>{r.method}</span>
        <span className="min-w-0 flex-1 truncate text-xs text-gray-300" title={r.description}>
          {r.description}
        </span>
        <span className={`hidden shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold ring-1 sm:inline-block ${cm.cls}`}>
          {cm.label}
        </span>
        <span className="shrink-0 font-mono text-[10px] tabular-nums text-gray-600">
          {r.latency != null ? `${r.latency}ms` : '—'}
        </span>
        {/* expected vs actual */}
        <span className="shrink-0 font-mono text-[10px] tabular-nums">
          <span className="text-gray-600">{r.expectedStatus}</span>
          <span className="text-gray-700"> / </span>
          <span className={r.pass ? 'text-emerald-400' : 'text-red-400'}>{r.actualStatus ?? 'ERR'}</span>
        </span>
        <svg className={`h-3 w-3 shrink-0 text-gray-600 transition-transform ${open ? 'rotate-180' : ''}`}
             fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expanded detail */}
      {open && (
        <div className="border-t border-gray-800/60 px-3 py-2.5 animate-fade-in">
          <div className="grid grid-cols-2 gap-3 text-[11px]">
            <div>
              <p className="mb-0.5 font-semibold uppercase tracking-widest text-gray-600 text-[9px]">Expected</p>
              <p className="text-gray-400">{r.expectedOutcome} <span className="font-mono text-gray-600">({r.expectedStatus})</span></p>
            </div>
            <div>
              <p className="mb-0.5 font-semibold uppercase tracking-widest text-gray-600 text-[9px]">Actual</p>
              <p className={r.pass ? 'text-emerald-400' : 'text-red-400'}>
                Status {r.actualStatus ?? 'ERR'} · {r.latency != null ? `${r.latency}ms` : '—'}
              </p>
            </div>
          </div>

          {/* Request */}
          <p className="mt-2 mb-0.5 font-semibold uppercase tracking-widest text-gray-600 text-[9px]">Request</p>
          <pre className="overflow-x-auto rounded-md border border-gray-800 bg-gray-950/70 px-2.5 py-1.5 font-mono text-[10px] text-gray-400">
{`${r.method} ${r.path}${r.query?.id ? `?id=${r.query.id}` : ''}`}{r.useAuth ? '\nAuthorization: Bearer <token>' : ''}{r.body ? `\n\n${JSON.stringify(r.body, null, 2)}` : ''}
          </pre>

          {/* Response */}
          <p className="mt-2 mb-0.5 font-semibold uppercase tracking-widest text-gray-600 text-[9px]">Response</p>
          <pre className="smooth-scroll max-h-40 overflow-auto rounded-md border border-gray-800 bg-gray-950/70 px-2.5 py-1.5 font-mono text-[10px] text-emerald-300/80"
               data-lenis-prevent>
{r.error ? `// network error: ${r.error}` : JSON.stringify(r.response, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

// ── TestRunner ───────────────────────────────────────────────────────────────────
export default function TestRunner() {
  const endpoints = usePlaygroundStore((s) => s.endpoints);
  const testSuite = usePlaygroundStore((s) => s.testSuite);
  const generateTestSuite = usePlaygroundStore((s) => s.generateTestSuite);
  const runTestSuite      = usePlaygroundStore((s) => s.runTestSuite);

  const { cases, results, generating, running, currentIndex, summary, error, source } = testSuite;
  const hasApi   = endpoints.length > 0;
  const busy     = generating || running;
  const failedCount = results.filter((r) => !r.pass).length;

  // Generate + run in one click for the primary CTA.
  const runFullSuite = async () => {
    const gen = await generateTestSuite();
    if (gen?.ok) await runTestSuite(false);
  };

  return (
    <div className="rounded-2xl border border-gray-800/60 bg-gray-900/30 backdrop-blur-sm">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-800/60 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-600/20 ring-1 ring-emerald-600/40">
            <svg className="h-4 w-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="flex flex-col">
            <h3 className="text-sm font-bold text-gray-100">AI Test Suite</h3>
            <span className="text-[10px] text-gray-600">
              Auto-generated QA tests fired at your live endpoints
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {summary && failedCount > 0 && !busy && (
            <button
              type="button"
              onClick={() => runTestSuite(true)}
              className="rounded-lg border border-amber-800/50 bg-amber-950/30 px-3 py-1.5
                         text-xs font-semibold text-amber-300 transition-colors hover:bg-amber-950/50"
            >
              Re-run failed ({failedCount})
            </button>
          )}
          {summary && !busy && (
            <button
              type="button"
              onClick={() => runTestSuite(false)}
              className="rounded-lg border border-gray-700 bg-gray-800/60 px-3 py-1.5
                         text-xs font-semibold text-gray-300 transition-colors hover:border-gray-600 hover:text-white"
            >
              Re-run all
            </button>
          )}
          <button
            type="button"
            onClick={runFullSuite}
            disabled={!hasApi || busy}
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs
                       font-bold text-white transition-colors hover:bg-emerald-500
                       focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400
                       disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? (
              <>
                <svg className="h-3.5 w-3.5 animate-spin-slow" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
                {generating ? 'Generating…' : 'Running…'}
              </>
            ) : (
              <>▶ Run AI Test Suite</>
            )}
          </button>
        </div>
      </div>

      <div className="px-4 py-3">
        {/* Not-ready / error / empty states */}
        {!hasApi ? (
          <p className="py-8 text-center text-xs text-gray-600">
            Generate an API first, then run the test suite against it.
          </p>
        ) : error ? (
          <div className="flex items-start gap-2 rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-2.5">
            <span className="text-red-400">⚠</span>
            <p className="text-xs text-red-300">{error}</p>
          </div>
        ) : (
          <>
            {/* Loading progress */}
            {busy && (
              <div className="flex flex-col gap-2 py-2 animate-fade-in">
                <p className="text-xs text-gray-400">
                  {generating
                    ? 'Generating test cases with AI…'
                    : `Running test ${currentIndex} of ${cases.length}…`}
                </p>
                {running && (
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-800">
                    <div className="h-full rounded-full bg-emerald-500 transition-all duration-200"
                         style={{ width: `${cases.length ? Math.round((currentIndex / cases.length) * 100) : 0}%` }} />
                  </div>
                )}
              </div>
            )}

            {/* Summary header */}
            {summary && !busy && (() => {
              const c = barColor(summary.pct);
              return (
                <div className="mb-3 flex flex-col gap-1.5 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <span className={`text-sm font-bold ${c.text}`}>
                      {summary.passed}/{summary.total} passed
                    </span>
                    <span className={`font-mono text-xs font-bold ${c.text}`}>{summary.pct}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-gray-800">
                    <div className={`h-full rounded-full transition-all duration-500 ${c.bar}`}
                         style={{ width: `${summary.pct}%` }} />
                  </div>
                  {source && (
                    <span className="text-[10px] text-gray-700">
                      {summary.total} cases · {source === 'ai' ? 'AI-generated' : 'schema-derived'} · fired at live endpoints
                    </span>
                  )}
                </div>
              );
            })()}

            {/* Results list */}
            {results.length > 0 && !busy && (
              <div className="smooth-scroll flex max-h-[46vh] flex-col gap-1.5 overflow-y-auto pr-1"
                   data-lenis-prevent>
                {results.map((r) => <ResultRow key={r.id} r={r} />)}
              </div>
            )}

            {/* Idle prompt */}
            {!summary && !busy && (
              <p className="py-6 text-center text-xs text-gray-600">
                Click <span className="font-semibold text-emerald-400">Run AI Test Suite</span> to generate
                and execute ~15 varied test cases against your mock API.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
