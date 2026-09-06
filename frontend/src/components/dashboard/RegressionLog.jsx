import { useState, useEffect, useCallback } from 'react';

/**
 * RegressionLog — API Performance Regression Log Table.
 *
 * Persists a rolling history of stress-test baselines in localStorage and
 * renders them as a scannable dark grid. It is fully decoupled from the
 * StressTester: it listens for the `mockflow:stressrun` CustomEvent that the
 * tester dispatches on completion, then appends + persists the record.
 *
 * Record shape (from the event detail):
 *   { id, timestamp, intensity, total, avgLatency, successRate, throughputKB }
 */

const STORAGE_KEY = 'mockflow.regressionLog.v1';
const MAX_RECORDS = 25;

function loadHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persist(records) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch { /* quota / disabled storage — non-fatal */ }
}

function formatTime(ts) {
  try {
    return new Date(ts).toLocaleString(undefined, {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  } catch {
    return '—';
  }
}

// Colour-grade the stability rate.
function stabilityColor(rate) {
  if (rate >= 99) return '#34d399';   // emerald
  if (rate >= 90) return '#fbbf24';   // amber
  return '#f87171';                   // red
}

// Colour-grade latency against soft thresholds (lower is better).
function latencyColor(ms) {
  if (ms <= 50)  return '#34d399';
  if (ms <= 200) return '#818cf8';
  if (ms <= 500) return '#fbbf24';
  return '#f87171';
}

export default function RegressionLog() {
  const [history, setHistory] = useState(loadHistory);

  // ── Subscribe to stress-run completions ───────────────────────────────────
  useEffect(() => {
    const onRun = (e) => {
      const rec = e.detail;
      if (!rec) return;
      setHistory((prev) => {
        const next = [rec, ...prev].slice(0, MAX_RECORDS);
        persist(next);
        return next;
      });
    };
    window.addEventListener('mockflow:stressrun', onRun);
    return () => window.removeEventListener('mockflow:stressrun', onRun);
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    persist([]);
  }, []);

  // Derived trend: is the latest run faster/slower than the previous one?
  const latest = history[0];
  const prev   = history[1];
  const delta  = latest && prev ? latest.avgLatency - prev.avgLatency : null;

  return (
    <div
      className="relative flex h-full flex-col overflow-hidden rounded-2xl
                 border border-indigo-900/30 animate-fade-in"
      style={{
        background: 'linear-gradient(135deg, rgba(15,23,42,0.72) 0%, rgba(30,27,75,0.55) 100%)',
        backdropFilter: 'blur(14px) saturate(1.4)',
        boxShadow: '0 0 30px rgba(99,102,241,0.10), inset 0 1px 0 rgba(255,255,255,0.04)',
      }}
    >
      {/* Ambient glow blob */}
      <div className="pointer-events-none absolute -left-16 -top-16 h-48 w-48
                      rounded-full blur-3xl"
           style={{ background: 'rgba(168,85,247,0.16)' }} aria-hidden="true" />

      {/* ── Sub-header ─────────────────────────────────────────────────── */}
      <div className="relative flex items-center justify-between gap-2
                      border-b border-gray-800/50 px-5 py-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl
                          bg-purple-600/20 ring-1 ring-purple-500/40">
            <svg className="h-4 w-4 text-purple-300" fill="none" viewBox="0 0 24 24"
                 stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                    d="M3 3v18h18M18.7 8l-5.1 5.2-2.8-2.7L7 14.3" />
            </svg>
          </div>
          <div>
            <h2 className="text-sm font-bold text-gray-100">Performance Regression Log</h2>
            <p className="text-[11px] text-gray-600">
              {history.length
                ? `${history.length} baseline${history.length !== 1 ? 's' : ''} recorded`
                : 'Awaiting first stress run'}
            </p>
          </div>
        </div>

        {/* Clear History flush trigger */}
        <button
          onClick={clearHistory}
          disabled={!history.length}
          className="flex items-center gap-1.5 rounded-lg border border-gray-700/60
                     bg-gray-900/60 px-2.5 py-1.5 text-[11px] font-semibold text-gray-400
                     transition-colors hover:border-red-500/40 hover:text-red-300
                     focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400
                     disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:border-gray-700/60 disabled:hover:text-gray-400"
          aria-label="Clear regression history"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24"
               stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round"
                  d="M19 7l-.9 12.1a2 2 0 01-2 1.9H7.9a2 2 0 01-2-1.9L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3M4 7h16" />
          </svg>
          Clear History
        </button>
      </div>

      {/* ── Body ───────────────────────────────────────────────────────── */}
      <div className="relative flex-1 px-5 py-4">
        {!history.length ? (
          <div className="flex h-full min-h-[8rem] flex-col items-center justify-center
                          gap-1 text-center">
            <span className="text-xs text-gray-700">No historical runs yet.</span>
            <span className="text-[11px] text-gray-800">
              Execute a stress run to capture a baseline.
            </span>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {/* Column header row */}
            <div className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-3
                            px-3 pb-1 text-[10px] font-semibold uppercase
                            tracking-widest text-gray-600">
              <span className="w-8">#</span>
              <span>Timestamp</span>
              <span className="text-right">Avg Latency</span>
              <span className="text-right">Stability</span>
            </div>

            {/* Rows */}
            <div className="flex flex-col gap-1.5">
              {history.map((r, i) => (
                <div
                  key={r.id}
                  className={`grid grid-cols-[auto_1fr_auto_auto] items-center gap-3
                              rounded-xl border px-3 py-2.5 transition-colors
                              ${i === 0
                                ? 'border-indigo-600/40 bg-indigo-950/30'
                                : 'border-gray-800/60 bg-gray-900/40 hover:bg-gray-900/70'}`}
                >
                  {/* index + intensity badge */}
                  <div className="flex w-8 flex-col items-start">
                    <span className="font-mono text-xs font-bold text-gray-500">
                      {history.length - i}
                    </span>
                    <span className="rounded bg-gray-800/80 px-1 text-[9px] font-semibold text-gray-500">
                      {r.intensity}×
                    </span>
                  </div>

                  {/* timestamp */}
                  <div className="flex flex-col">
                    <span className="text-xs text-gray-300">{formatTime(r.timestamp)}</span>
                    <span className="text-[10px] text-gray-700">
                      {r.total} requests · {Number(r.throughputKB ?? 0).toFixed(1)} KB
                    </span>
                  </div>

                  {/* avg latency */}
                  <div className="flex items-center justify-end gap-1 text-right">
                    {i === 0 && delta != null && (
                      <span
                        className="font-mono text-[10px]"
                        style={{ color: delta <= 0 ? '#34d399' : '#f87171' }}
                        title={`${delta > 0 ? '+' : ''}${delta.toFixed(1)}ms vs previous`}
                      >
                        {delta <= 0 ? '▼' : '▲'}
                      </span>
                    )}
                    <span className="font-mono text-sm font-bold tabular-nums"
                          style={{ color: latencyColor(r.avgLatency) }}>
                      {Number(r.avgLatency).toFixed(1)}
                    </span>
                    <span className="font-mono text-[10px] text-gray-600">ms</span>
                  </div>

                  {/* stability rate */}
                  <div className="flex items-center justify-end gap-1.5 text-right">
                    <span className="h-1.5 w-1.5 rounded-full"
                          style={{ background: stabilityColor(r.successRate) }} />
                    <span className="font-mono text-sm font-bold tabular-nums"
                          style={{ color: stabilityColor(r.successRate) }}>
                      {Number(r.successRate).toFixed(1)}
                    </span>
                    <span className="font-mono text-[10px] text-gray-600">%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
