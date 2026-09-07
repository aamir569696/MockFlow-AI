import { useState, useRef, useCallback } from 'react';
import { usePlaygroundStore } from '../../store/playgroundStore.js';

/**
 * StressTester — Visual API Performance Benchmark & Stress-Tester.
 *
 * Fires N concurrent GET requests (batched via Promise.all) at the active
 * session's live wildcard endpoints, streams execution state to a terminal
 * log, animates a progress bar, and renders a compiled telemetry summary.
 */

const INTENSITIES = [50, 100, 200];
const BATCH_SIZE  = 25;   // requests fired per Promise.all wave

export default function StressTester() {
  const { sessionId, endpoints, apiName } = usePlaygroundStore();

  const [intensity, setIntensity] = useState(100);
  const [running, setRunning]     = useState(false);
  const [progress, setProgress]   = useState(0);
  const [log, setLog]             = useState([]);
  const [summary, setSummary]     = useState(null);
  const logRef = useRef(null);

  const pushLog = useCallback((line, tone = 'info') => {
    setLog(prev => [...prev.slice(-60), { id: `${Date.now()}-${Math.random()}`, line, tone }]);
    // Auto-scroll after paint
    requestAnimationFrame(() => {
      if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
    });
  }, []);

  // ── Fire a single request, measuring latency + payload size ───────────────
  const fireOne = useCallback(async (ep) => {
    const url = `/api/mock/${sessionId}/${ep.slug}`;
    const t0  = performance.now();
    try {
      const res  = await fetch(url, { headers: { 'x-mockflow-session': sessionId } });
      const text = await res.text();
      return {
        ok:       res.ok,
        status:   res.status,
        latency:  performance.now() - t0,
        bytes:    new TextEncoder().encode(text).length,
      };
    } catch {
      return { ok: false, status: 0, latency: performance.now() - t0, bytes: 0 };
    }
  }, [sessionId]);

  // ── Execute the full stress run ───────────────────────────────────────────
  const execute = useCallback(async () => {
    if (running || !sessionId || !endpoints.length) return;

    setRunning(true);
    setProgress(0);
    setSummary(null);
    setLog([]);

    const getEndpoints = endpoints.filter(e => e.method === 'GET');
    const pool = getEndpoints.length ? getEndpoints : endpoints;

    // Prepend an explicit benchmark warning so the concurrent stress packets
    // showing up in the Traffic Inspector aren't mistaken for real traffic.
    pushLog(`⚠️ [BENCHMARK RUN IN PROGRESS] — Logging concurrent stress execution waves`, 'warn');
    pushLog(`⚡ Initializing stress run — ${intensity} concurrent hits`, 'accent');
    pushLog(`→ Target: ${apiName || 'Mock API'} · session ${sessionId.slice(0, 8)}…`, 'muted');
    pushLog(`→ Endpoint pool: ${pool.length} route${pool.length !== 1 ? 's' : ''}`, 'muted');

    const results = [];
    const totalBatches = Math.ceil(intensity / BATCH_SIZE);
    let fired = 0;

    // Wrap the whole run so an unexpected rejection can never strand the panel
    // with a stuck spinner — `running` is always cleared in `finally`.
    try {
      for (let batch = 0; batch < totalBatches; batch++) {
        const remaining = intensity - fired;
        const size = Math.min(BATCH_SIZE, remaining);

        pushLog(`▸ Firing batch loop ${batch + 1}/${totalBatches} — ${size} parallel requests…`, 'info');

        // Build a batch of promises hitting round-robin endpoints
        const wave = Array.from({ length: size }, (_, i) =>
          fireOne(pool[(fired + i) % pool.length])
        );

        // Aggressive concurrent fire. fireOne never throws (it resolves to an
        // {ok:false} result on failure), but allSettled is used defensively so
        // a single unexpected rejection can't abort the entire run.
        // eslint-disable-next-line no-await-in-loop
        const settled = await Promise.allSettled(wave);
        const batchResults = settled.map(s =>
          s.status === 'fulfilled' ? s.value : { ok: false, status: 0, latency: 0, bytes: 0 }
        );
        results.push(...batchResults);
        fired += size;

        const okCount = batchResults.filter(r => r.ok).length;
        pushLog(`  ✓ Batch ${batch + 1} settled — ${okCount}/${size} OK`, okCount === size ? 'ok' : 'warn');

        setProgress(Math.round((fired / intensity) * 100));
      }

      // ── Compile telemetry ────────────────────────────────────────────────
      const latencies   = results.map(r => r.latency);
      const okCount      = results.filter(r => r.ok).length;
      const totalBytes   = results.reduce((s, r) => s + r.bytes, 0);
      const avgLatency   = latencies.reduce((s, l) => s + l, 0) / (latencies.length || 1);
      const minLatency   = latencies.length ? Math.min(...latencies) : 0;
      const maxLatency   = latencies.length ? Math.max(...latencies) : 0;
      const p95          = [...latencies].sort((a, b) => a - b)[Math.floor(latencies.length * 0.95)] ?? maxLatency;
      const successRate  = (okCount / (results.length || 1)) * 100;
      const throughputKB = totalBytes / 1024;

      pushLog(`✅ Run complete — ${okCount}/${results.length} succeeded`, 'ok');

      setSummary({
        total:        results.length,
        avgLatency:   avgLatency.toFixed(1),
        minLatency:   minLatency.toFixed(1),
        maxLatency:   maxLatency.toFixed(1),
        p95:          p95.toFixed(1),
        successRate:  successRate.toFixed(1),
        throughputKB: throughputKB.toFixed(2),
        throughputMB: (throughputKB / 1024).toFixed(3),
      });

      // ── Broadcast the baseline diagnostics to the Regression Log ───────────
      // Loosely coupled: the RegressionLog listens for this event and persists
      // the record to localStorage. Keeps the two panels decoupled (no props).
      window.dispatchEvent(new CustomEvent('mockflow:stressrun', {
        detail: {
          id:          `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          timestamp:   Date.now(),
          intensity,
          total:       results.length,
          avgLatency:  Number(avgLatency.toFixed(1)),
          successRate: Number(successRate.toFixed(1)),
          throughputKB: Number(throughputKB.toFixed(2)),
        },
      }));
    } catch (err) {
      // Defensive — should be unreachable given fireOne/allSettled, but a stuck
      // panel is worse than a clear message.
      pushLog(`✕ Stress run aborted — ${err?.message ?? 'unexpected error'}`, 'warn');
    } finally {
      setRunning(false);
    }
  }, [running, sessionId, endpoints, intensity, apiName, fireOne, pushLog]);

  const disabled = !sessionId || !endpoints.length;

  const toneClass = {
    accent: 'text-indigo-300',
    ok:     'text-emerald-400',
    warn:   'text-amber-400',
    info:   'text-gray-400',
    muted:  'text-gray-600',
  };

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-indigo-900/30
                 animate-fade-in"
      style={{
        background: 'linear-gradient(135deg, rgba(15,23,42,0.72) 0%, rgba(30,27,75,0.55) 100%)',
        backdropFilter: 'blur(14px) saturate(1.4)',
        boxShadow: '0 0 30px rgba(99,102,241,0.10), inset 0 1px 0 rgba(255,255,255,0.04)',
      }}
    >
      {/* Ambient glow blob */}
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48
                      rounded-full blur-3xl"
           style={{ background: 'rgba(99,102,241,0.18)' }} aria-hidden="true" />

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="relative flex flex-col gap-3 border-b border-gray-800/50
                      px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl
                          bg-indigo-600/20 ring-1 ring-indigo-500/40">
            <svg className="h-4 w-4 text-indigo-300" fill="none" viewBox="0 0 24 24"
                 stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                    d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <h2 className="text-sm font-bold text-gray-100">Performance Stress-Tester</h2>
            <p className="text-[11px] text-gray-600">
              Concurrent batch benchmark · Promise.all wavefire
            </p>
          </div>
        </div>

        {/* Controls — stack full-width on mobile, inline row on sm+ */}
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center sm:gap-2">
          {/* Intensity select */}
          <div className="flex w-full items-center justify-between gap-1.5 rounded-lg
                          border border-gray-700/60 bg-gray-900/60 px-2 py-2
                          sm:w-auto sm:justify-start sm:py-1">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-600">
              Intensity
            </span>
            <select
              value={intensity}
              onChange={(e) => setIntensity(Number(e.target.value))}
              disabled={running}
              className="rounded-md border-0 bg-transparent font-mono text-xs font-bold
                         text-indigo-300 focus:outline-none focus:ring-1 focus:ring-indigo-500
                         disabled:opacity-40"
              aria-label="Concurrent hit intensity"
            >
              {INTENSITIES.map(n => (
                <option key={n} value={n} className="bg-gray-900">{n} hits</option>
              ))}
            </select>
          </div>

          {/* Execute button */}
          <button
            onClick={execute}
            disabled={disabled || running}
            aria-label="Execute performance stress run"
            aria-busy={running}
            title={disabled
              ? 'Generate an API first to enable the stress-tester'
              : `Fire ${intensity} concurrent requests at your live mock endpoints and measure latency, stability, and throughput`}
            className={`flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5
                        text-xs font-bold tracking-wide transition-all duration-200
                        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400
                        disabled:cursor-not-allowed disabled:opacity-40
                        sm:w-auto sm:py-2
                        ${running
                          ? 'bg-indigo-950/60 text-indigo-400 ring-1 ring-indigo-700/50'
                          : 'bg-indigo-600 text-white hover:bg-indigo-500'}`}
            style={!running && !disabled ? { boxShadow: '0 0 18px rgba(99,102,241,0.45)' } : {}}
          >
            {running ? (
              <>
                <svg className="h-3.5 w-3.5 animate-spin-slow" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
                Running… {progress}%
              </>
            ) : (
              <>▶️ Execute Performance Stress Run</>
            )}
          </button>
        </div>
      </div>

      {/* ── Body ───────────────────────────────────────────────────────── */}
      <div className="relative flex flex-col gap-4 px-5 py-4">

        {disabled && (
          <p className="py-6 text-center text-xs text-gray-700">
            Generate an API in the Playground to unlock the stress-tester.
          </p>
        )}

        {!disabled && (
          <>
            {/* Progress bar */}
            {(running || progress > 0) && (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-600">
                    Execution Progress
                  </span>
                  <span className="font-mono text-xs font-bold tabular-nums text-indigo-300">
                    {progress}%
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-gray-800/80">
                  <div
                    className="h-full rounded-full transition-all duration-300 ease-out"
                    style={{
                      width: `${progress}%`,
                      background: 'linear-gradient(90deg, #6272f5 0%, #a78bfa 50%, #34d399 100%)',
                      boxShadow: '0 0 12px rgba(99,102,241,0.6)',
                    }}
                  />
                </div>
              </div>
            )}

            {/* Terminal log */}
            {log.length > 0 && (
              <div
                ref={logRef}
                className="max-h-44 overflow-y-auto rounded-xl border border-gray-800/60
                           bg-gray-950/80 px-3 py-2.5 font-mono text-[11px] leading-relaxed"
                style={{
                  backgroundImage: 'radial-gradient(circle, rgba(99,102,241,0.04) 1px, transparent 1px)',
                  backgroundSize: '18px 18px',
                }}
              >
                {log.map((l) => (
                  <div key={l.id} className={`animate-fade-in break-words ${toneClass[l.tone] ?? 'text-gray-400'}`}>
                    <span className="select-none text-indigo-500/50">$ </span>{l.line}
                  </div>
                ))}
              </div>
            )}

            {/* Telemetry summary grid */}
            {summary && (
              <div className="flex flex-col gap-2 animate-slide-up">
                <div className="flex items-center gap-2">
                  <span className="h-px flex-1 bg-gray-800" />
                  <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-gray-600">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Benchmark Report
                  </span>
                  <span className="h-px flex-1 bg-gray-800" />
                </div>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {/* Avg latency */}
                  <MetricTile
                    label="Avg Compile Latency"
                    value={`${summary.avgLatency}`}
                    unit="ms"
                    color="#818cf8"
                    sub={`p95 ${summary.p95}ms · max ${summary.maxLatency}ms`}
                  />
                  {/* Success rate */}
                  <MetricTile
                    label="Server Stability"
                    value={summary.successRate}
                    unit="%"
                    color={Number(summary.successRate) >= 99 ? '#34d399' : Number(summary.successRate) >= 90 ? '#fbbf24' : '#f87171'}
                    sub={`${summary.total} total requests`}
                  />
                  {/* Throughput */}
                  <MetricTile
                    label="Data Throughput"
                    value={summary.throughputKB >= 1024 ? summary.throughputMB : summary.throughputKB}
                    unit={summary.throughputKB >= 1024 ? 'MB' : 'KB'}
                    color="#c084fc"
                    sub={`across ${summary.total} payloads`}
                  />
                </div>

                {/* Latency spread bar */}
                <div className="rounded-xl border border-gray-800/60 bg-gray-900/40 px-3 py-2.5">
                  <div className="mb-1.5 flex items-center justify-between text-[10px] text-gray-600">
                    <span>min {summary.minLatency}ms</span>
                    <span className="font-semibold text-gray-500">latency distribution</span>
                    <span>max {summary.maxLatency}ms</span>
                  </div>
                  <div className="relative h-1.5 w-full rounded-full bg-gray-800">
                    {/* avg marker */}
                    <div
                      className="absolute top-1/2 h-3 w-0.5 -translate-y-1/2 rounded bg-indigo-400"
                      style={{ left: `${Math.min((summary.avgLatency / summary.maxLatency) * 100, 100)}%`, boxShadow: '0 0 8px rgba(129,140,248,0.8)' }}
                    />
                    {/* p95 marker */}
                    <div
                      className="absolute top-1/2 h-3 w-0.5 -translate-y-1/2 rounded bg-amber-400"
                      style={{ left: `${Math.min((summary.p95 / summary.maxLatency) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Metric tile ─────────────────────────────────────────────────────────────

function MetricTile({ label, value, unit, color, sub }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-gray-800/70
                    bg-gray-900/60 px-3 py-3 backdrop-blur-sm">
      <span className="truncate text-[10px] font-semibold uppercase tracking-widest text-gray-600">
        {label}
      </span>
      <div className="flex items-baseline gap-1">
        <span className="font-mono text-xl font-bold tabular-nums" style={{ color }}>
          {value}
        </span>
        <span className="font-mono text-xs" style={{ color }}>{unit}</span>
      </div>
      {sub && <span className="truncate text-[10px] text-gray-700">{sub}</span>}
    </div>
  );
}
