import { useState, useEffect, useRef, useCallback } from 'react';
import { usePlaygroundStore } from '../../store/playgroundStore.js';

/**
 * TrafficInspector — Live Traffic Webhook Inspector.
 *
 * Polls GET /api/traffic/:sessionId every POLL_MS and streams inbound HTTP
 * events onto a glowing console log. New events are prepended with a brief
 * highlight animation. Uses delta polling (?since=) so each request only
 * transfers events the client hasn't seen yet.
 */

const POLL_MS = 2000;

// ── Status → colour ───────────────────────────────────────────────────────────

function statusColor(code) {
  if (!code)        return { text: 'text-gray-500', dot: 'bg-gray-600',    glow: '' };
  if (code < 300)   return { text: 'text-emerald-400', dot: 'bg-emerald-500', glow: 'shadow-emerald-500/50' };
  if (code < 400)   return { text: 'text-blue-400',    dot: 'bg-blue-500',    glow: 'shadow-blue-500/50' };
  if (code < 500)   return { text: 'text-amber-400',   dot: 'bg-amber-500',   glow: 'shadow-amber-500/50' };
  return              { text: 'text-red-400',     dot: 'bg-red-500',     glow: 'shadow-red-500/50' };
}

const METHOD_COLOR = {
  GET:    'text-emerald-400',
  POST:   'text-blue-400',
  PUT:    'text-amber-400',
  PATCH:  'text-purple-400',
  DELETE: 'text-red-400',
};

function relTime(iso) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 5)  return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

// ── Single log line ─────────────────────────────────────────────────────────

function LogLine({ evt, isNew }) {
  const sc = statusColor(evt.status);
  const mc = METHOD_COLOR[evt.method] ?? 'text-gray-400';
  return (
    <div
      className={`flex items-center gap-2 rounded-md px-2 py-1.5 font-mono text-[11px]
                  transition-all duration-500
                  ${isNew ? 'bg-indigo-950/30 ring-1 ring-indigo-800/40' : ''}`}
    >
      {/* Status dot */}
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${sc.dot} shadow-lg ${sc.glow}
                        ${isNew ? 'animate-pulse' : ''}`} />
      {/* Method */}
      <span className={`w-12 shrink-0 font-bold ${mc}`}>{evt.method}</span>
      {/* Slug */}
      <span className="min-w-0 flex-1 truncate text-gray-400">/{evt.slug}</span>
      {/* Status code */}
      <span className={`w-9 shrink-0 text-right font-bold tabular-nums ${sc.text}`}>
        {evt.status}
      </span>
      {/* Latency */}
      <span className="w-14 shrink-0 text-right tabular-nums text-gray-600">
        {evt.latencyMs}ms
      </span>
      {/* Time */}
      <span className="hidden w-16 shrink-0 text-right text-gray-700 sm:block">
        {relTime(evt.ts)}
      </span>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function TrafficInspector() {
  const { sessionId } = usePlaygroundStore();

  const [events, setEvents]   = useState([]);
  const [live, setLive]       = useState(true);
  const [connected, setConnected] = useState(false);
  const [newIds, setNewIds]   = useState(new Set());

  const latestIdRef = useRef(null);   // newest event id we've seen
  const timerRef    = useRef(null);

  // ── Poll fn — fetches only NEW events via ?since= ──────────────────────────
  const poll = useCallback(async () => {
    if (!sessionId) return;
    try {
      const since = latestIdRef.current ? `?since=${encodeURIComponent(latestIdRef.current)}` : '';
      const res   = await fetch(`/api/traffic/${sessionId}${since}`);
      if (!res.ok) { setConnected(false); return; }
      setConnected(true);

      const data = await res.json();
      const fresh = data.events ?? [];

      if (fresh.length) {
        latestIdRef.current = fresh[0].id;   // newest is first (server prepends)
        // Track which ids are new for the highlight animation
        const freshIds = new Set(fresh.map(e => e.id));
        setNewIds(freshIds);
        setEvents(prev => [...fresh, ...prev].slice(0, 100));
        // Clear the "new" highlight after 1.5s
        setTimeout(() => setNewIds(new Set()), 1500);
      }
    } catch {
      setConnected(false);
    }
  }, [sessionId]);

  // ── Polling lifecycle ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!live || !sessionId) return;
    poll();                                    // immediate first hit
    timerRef.current = setInterval(poll, POLL_MS);
    return () => clearInterval(timerRef.current);
  }, [live, sessionId, poll]);

  const clearLog = () => {
    setEvents([]);
    latestIdRef.current = null;
  };

  return (
    <div className="rounded-2xl border border-gray-800/60 bg-gray-900/30
                    backdrop-blur-sm overflow-hidden animate-fade-in">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-b border-gray-800/60
                      bg-gray-900/60 px-4 py-2.5">
        <div className="flex items-center gap-2">
          {/* Live signal */}
          <span className="relative flex h-2 w-2">
            {live && connected && (
              <span className="absolute inline-flex h-full w-full animate-ping
                               rounded-full bg-emerald-400/50" />
            )}
            <span className={`relative inline-flex h-2 w-2 rounded-full
              ${live && connected ? 'bg-emerald-400' : 'bg-gray-600'}`} />
          </span>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500">
            Live Traffic Inspector
          </h2>
          <span className="rounded-full bg-gray-800 px-2 py-0.5 font-mono text-[10px] text-gray-600">
            {events.length} events
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Live toggle */}
          <button
            onClick={() => setLive(l => !l)}
            className={`flex items-center gap-1.5 rounded-md border px-2 py-0.5
                        text-[10px] font-semibold transition-all
                        ${live
                          ? 'border-emerald-800/60 bg-emerald-950/40 text-emerald-400'
                          : 'border-gray-700 bg-gray-800/60 text-gray-500 hover:text-gray-300'
                        }`}
            aria-pressed={live}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${live ? 'bg-emerald-400 animate-pulse' : 'bg-gray-600'}`} />
            {live ? 'LIVE' : 'PAUSED'}
          </button>
          {/* Clear */}
          <button
            onClick={clearLog}
            className="rounded-md border border-gray-700 bg-gray-800/60 px-2 py-0.5
                       text-[10px] font-semibold text-gray-500
                       transition-all hover:border-gray-600 hover:text-gray-300"
          >
            Clear
          </button>
        </div>
      </div>

      {/* ── Column labels ──────────────────────────────────────────────── */}
      <div className="hidden items-center gap-2 border-b border-gray-800/40
                      bg-gray-900/40 px-4 py-1.5 font-mono text-[9px]
                      font-semibold uppercase tracking-widest text-gray-700 sm:flex">
        <span className="w-1.5 shrink-0" />
        <span className="w-12 shrink-0">Method</span>
        <span className="min-w-0 flex-1">Route</span>
        <span className="w-9 shrink-0 text-right">Code</span>
        <span className="w-14 shrink-0 text-right">Latency</span>
        <span className="w-16 shrink-0 text-right">When</span>
      </div>

      {/* ── Console log ────────────────────────────────────────────────── */}
      <div
        className="max-h-72 overflow-y-auto px-2 py-2"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(99,102,241,0.03) 1px, transparent 1px)',
          backgroundSize: '18px 18px',
        }}
      >
        {!sessionId ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <p className="text-xs text-gray-700">No active session to monitor</p>
          </div>
        ) : events.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="mb-2 flex h-10 w-10 items-center justify-center
                            rounded-xl bg-gray-800 ring-1 ring-gray-700">
              <svg className="h-5 w-5 text-gray-600 animate-pulse" fill="none"
                   viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round"
                      d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <p className="text-xs text-gray-700">
              {live ? 'Listening for inbound requests…' : 'Monitoring paused'}
            </p>
            <p className="mt-1 font-mono text-[10px] text-gray-800">
              Fire a request from the Playground or any external client
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-0.5">
            {events.map((evt) => (
              <LogLine key={evt.id} evt={evt} isNew={newIds.has(evt.id)} />
            ))}
          </div>
        )}
      </div>

      {/* ── Footer status ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-t border-gray-800/40
                      bg-gray-900/40 px-4 py-1.5">
        <span className="font-mono text-[10px] text-gray-700">
          polling every {POLL_MS / 1000}s
          {sessionId && <> · session <span className="text-gray-600">{sessionId.slice(0, 8)}…</span></>}
        </span>
        <span className={`font-mono text-[10px] ${connected ? 'text-emerald-600' : 'text-gray-700'}`}>
          {connected ? '● connected' : '○ waiting'}
        </span>
      </div>
    </div>
  );
}
