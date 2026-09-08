import { useState, useEffect, useRef } from 'react';
import { usePlaygroundStore } from '../../store/playgroundStore.js';
import RequestRunner from './RequestRunner.jsx';
import SdkGenerator from './SdkGenerator.jsx';
import ExportDropdown from './ExportDropdown.jsx';
import ShareDocs from './ShareDocs.jsx';
import TestRunner from './TestRunner.jsx';

/**
 * SandboxStudio — 3-tab workspace shell.
 *
 * Three tabs share a single Zustand store (no duplicated request logic):
 *
 *   🚀 Request Workbench — compose AND fire a request; the response renders
 *                          inline in the same tab, right below the Fire button
 *                          (RequestRunner "all" view = controls + telemetry +
 *                          response body). Tab switching NEVER happens here.
 *   📡 Monitor Console   — passive, read-only history of every past request
 *                          (method, path, status, latency, time), auto-updated
 *                          in the background from the store's requestLog. Shows
 *                          an unseen-count badge on the tab when new entries
 *                          arrive while the user is elsewhere; clears on open.
 *   🧪 Test Suite        — AI-generated QA test runner (generate/execute/report),
 *                          isolated from the Monitor history. Shows a badge when
 *                          a run completes while the user is on another tab.
 *   📦 Lab & Exports     — static reference only: Postman export + SDK snippets.
 *
 * Tabs change ONLY on explicit user click — there is no programmatic switch.
 */

const STUDIO_TABS = [
  { id: 'workbench', label: 'Request Workbench', emoji: '🚀', accent: 'indigo'  },
  { id: 'monitor',   label: 'Monitor Console',   emoji: '📡', accent: 'emerald' },
  { id: 'tests',     label: 'Test Suite',        emoji: '🧪', accent: 'sky'     },
  { id: 'lab',       label: 'Lab & Exports',     emoji: '📦', accent: 'purple'  },
];

// Tailwind-safe accent class maps (no dynamic string interpolation).
const ACCENT_ACTIVE = {
  indigo:  'border-indigo-500 text-indigo-300 bg-indigo-950/30',
  emerald: 'border-emerald-500 text-emerald-300 bg-emerald-950/30',
  sky:     'border-sky-500 text-sky-300 bg-sky-950/30',
  purple:  'border-purple-500 text-purple-300 bg-purple-950/30',
};

// ── Status → colour ────────────────────────────────────────────────────────────
function statusColor(code, isError) {
  if (isError) return 'text-red-400';
  if (!code)   return 'text-gray-500';
  if (code < 300) return 'text-emerald-400';
  if (code < 400) return 'text-blue-400';
  if (code < 500) return 'text-amber-400';
  return 'text-red-400';
}

const METHOD_COLORS = {
  GET:    'text-emerald-400',
  POST:   'text-blue-400',
  PUT:    'text-amber-400',
  PATCH:  'text-purple-400',
  DELETE: 'text-red-400',
};

function relativeTime(iso) {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const s = Math.floor(diff / 1000);
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    return `${Math.floor(m / 60)}h ago`;
  } catch {
    return '—';
  }
}

// ── Monitor Console — passive request history ───────────────────────────────────
function MonitorConsole({ requestLog }) {
  if (!requestLog.length) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl
                      border border-dashed border-gray-800 py-12 text-center">
        <p className="text-xs text-gray-600">No requests yet</p>
        <p className="mt-1 text-[11px] text-gray-700">
          Fire a request from the Request Workbench to see it logged here.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-600">
          Request History
        </span>
        <span className="rounded-full bg-gray-800 px-2 py-0.5 font-mono text-[10px] text-gray-500">
          {requestLog.length} logged
        </span>
      </div>

      {/* Column header */}
      <div className="grid grid-cols-[3.5rem_1fr_3rem_4rem_4rem] items-center gap-2
                      px-2 text-[10px] font-semibold uppercase tracking-widest text-gray-700">
        <span>Method</span>
        <span>Route</span>
        <span className="text-right">Code</span>
        <span className="text-right">Latency</span>
        <span className="text-right">When</span>
      </div>

      {/* Rows */}
      <div className="smooth-scroll flex max-h-[42vh] flex-col gap-1 overflow-y-auto pr-1"
           data-lenis-prevent>
        {requestLog.map((entry, i) => (
          <div
            key={entry.id}
            className={`grid grid-cols-[3.5rem_1fr_3rem_4rem_4rem] items-center gap-2
                        rounded-lg border px-2 py-2 transition-colors animate-fade-in
                        ${i === 0
                          ? 'border-emerald-900/40 bg-emerald-950/10'
                          : 'border-gray-800/60 bg-gray-900/40 hover:bg-gray-900/70'}`}
          >
            <span className={`font-mono text-[11px] font-bold ${METHOD_COLORS[entry.method] ?? 'text-gray-400'}`}>
              {entry.method}
            </span>
            <code className="min-w-0 truncate font-mono text-[11px] text-gray-400" title={`/${entry.slug}`}>
              /{entry.slug}
            </code>
            <span className={`text-right font-mono text-[11px] font-bold tabular-nums ${statusColor(entry.status, !!entry.error)}`}>
              {entry.status ?? 'ERR'}
            </span>
            <span className="text-right font-mono text-[11px] tabular-nums text-gray-600">
              {entry.latency != null ? `${entry.latency}ms` : '—'}
            </span>
            <span className="text-right font-mono text-[10px] text-gray-700">
              {relativeTime(entry.ts)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SandboxStudio() {
  const [tab, setTab] = useState('workbench');

  // ── Shared request history (single source of truth in the store) ─────────
  const requestLog = usePlaygroundStore((s) => s.requestLog);

  // ── Unseen-entry badge for the Monitor tab ───────────────────────────────
  // Track the newest log id the user has actually seen (i.e. had the Monitor
  // tab open for). New entries arriving while they're elsewhere raise a count.
  const seenTopIdRef = useRef(requestLog[0]?.id ?? null);
  const [unseenCount, setUnseenCount] = useState(0);

  // Recompute unseen count whenever the log grows and Monitor isn't active.
  useEffect(() => {
    if (tab === 'monitor') {
      // Viewing Monitor → everything is seen; sync the marker and clear badge.
      seenTopIdRef.current = requestLog[0]?.id ?? null;
      if (unseenCount !== 0) setUnseenCount(0);
      return;
    }
    // Not viewing Monitor → count entries newer than the last-seen marker.
    const seenIdx = seenTopIdRef.current
      ? requestLog.findIndex((e) => e.id === seenTopIdRef.current)
      : -1;
    const newCount = seenIdx === -1 ? requestLog.length : seenIdx;
    if (newCount !== unseenCount) setUnseenCount(newCount);
  }, [requestLog, tab, unseenCount]);

  // ── "New test run" badge for the Test Suite tab ──────────────────────────
  // The store replaces testSuite.summary with a fresh object each completed run.
  // If that happens while the user is on another tab, flag an unseen result.
  const testSummary = usePlaygroundStore((s) => s.testSuite.summary);
  const seenSummaryRef = useRef(testSummary);
  const [testUnseen, setTestUnseen] = useState(false);

  useEffect(() => {
    if (tab === 'tests') {
      seenSummaryRef.current = testSummary;
      if (testUnseen) setTestUnseen(false);
      return;
    }
    if (testSummary && testSummary !== seenSummaryRef.current) {
      setTestUnseen(true);
    }
  }, [testSummary, tab, testUnseen]);

  // Explicit user tab click — the ONLY way tabs change. Opening a tab clears
  // that tab's notification badge.
  const handleTabClick = (id) => {
    if (id === 'monitor') {
      seenTopIdRef.current = requestLog[0]?.id ?? null;
      setUnseenCount(0);
    }
    if (id === 'tests') {
      seenSummaryRef.current = testSummary;
      setTestUnseen(false);
    }
    setTab(id);
  };

  return (
    <div className="card ambient-grid flex flex-col overflow-hidden p-0">
      {/* ── Tab controller ─────────────────────────────────────────────── */}
      <div
        role="tablist"
        aria-label="Sandbox Studio"
        className="flex items-center gap-2 overflow-x-auto whitespace-nowrap
                   scrollbar-none pb-1 w-full max-w-full border-b border-gray-800/60 p-1.5"
        style={{ background: 'rgba(15,23,42,0.6)' }}
      >
        {STUDIO_TABS.map((t) => {
          const active = tab === t.id;
          const showMonitorBadge = t.id === 'monitor' && !active && unseenCount > 0;
          const showTestBadge    = t.id === 'tests'   && !active && testUnseen;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={active}
              aria-controls={`studio-panel-${t.id}`}
              id={`studio-tab-${t.id}`}
              onClick={() => handleTabClick(t.id)}
              className={`group relative flex flex-shrink-0 items-center justify-center gap-2
                          rounded-lg border-b-2 px-3 py-2.5 text-xs font-semibold
                          tracking-wide transition-all duration-200
                          focus-visible:outline-none focus-visible:ring-2
                          focus-visible:ring-inset focus-visible:ring-indigo-500
                          ${active
                            ? ACCENT_ACTIVE[t.accent]
                            : 'border-transparent text-gray-600 hover:bg-gray-800/40 hover:text-gray-300'}`}
            >
              <span className="text-sm leading-none" aria-hidden="true">{t.emoji}</span>
              <span className="hidden sm:inline">{t.label}</span>
              <span className="sm:hidden">{t.label.split(' ')[0]}</span>

              {/* Unseen-entries count badge on Monitor */}
              {showMonitorBadge && (
                <span
                  className="absolute right-1.5 top-1 flex min-w-[1rem] items-center
                             justify-center rounded-full bg-emerald-500 px-1
                             text-[9px] font-bold leading-4 text-gray-950"
                  aria-label={`${unseenCount} new request${unseenCount !== 1 ? 's' : ''} logged`}
                >
                  {unseenCount > 9 ? '9+' : unseenCount}
                </span>
              )}

              {/* New-test-run dot badge on Test Suite */}
              {showTestBadge && (
                <span className="absolute right-2 top-1.5 flex h-2 w-2"
                      aria-label="New test run completed">
                  <span className="absolute inline-flex h-full w-full animate-ping
                                   rounded-full bg-sky-400 opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-sky-400" />
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Tab panels ─────────────────────────────────────────────────── */}
      <div className="min-h-0 flex-1 p-4 sm:p-5">
        {/* Tab 1 — Request Workbench (compose + fire + inline response) */}
        <section
          id="studio-panel-workbench"
          role="tabpanel"
          aria-labelledby="studio-tab-workbench"
          hidden={tab !== 'workbench'}
          className={tab === 'workbench' ? 'flex flex-col gap-4 animate-fade-in' : ''}
        >
          {tab === 'workbench' && <RequestRunner view="all" />}
        </section>

        {/* Tab 2 — Monitor Console (passive request history) */}
        <section
          id="studio-panel-monitor"
          role="tabpanel"
          aria-labelledby="studio-tab-monitor"
          hidden={tab !== 'monitor'}
          className={tab === 'monitor' ? 'flex flex-col gap-4 animate-fade-in' : ''}
        >
          {tab === 'monitor' && <MonitorConsole requestLog={requestLog} />}
        </section>

        {/* Tab 3 — Test Suite (AI-generated QA test runner) */}
        <section
          id="studio-panel-tests"
          role="tabpanel"
          aria-labelledby="studio-tab-tests"
          hidden={tab !== 'tests'}
          className={tab === 'tests' ? 'flex flex-col gap-4 animate-fade-in' : ''}
        >
          {tab === 'tests' && <TestRunner />}
        </section>

        {/* Tab 4 — Lab & Exports (static reference only) */}
        <section
          id="studio-panel-lab"
          role="tabpanel"
          aria-labelledby="studio-tab-lab"
          hidden={tab !== 'lab'}
          className={tab === 'lab' ? 'flex flex-col gap-4 animate-fade-in' : ''}
        >
          {tab === 'lab' && (
            <>
              {/* Postman v2.1 export bar */}
              <div className="flex items-center justify-between gap-3 rounded-xl
                              border border-gray-800/70 bg-gray-900/50 px-3 py-2.5">
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-gray-300">
                    Collection & SDK Exports
                  </span>
                  <span className="text-[10px] text-gray-600">
                    Postman v2.1 JSON · 10-language client SDKs
                  </span>
                </div>
                <ExportDropdown />
              </div>

              {/* Share a public, read-only docs link */}
              <ShareDocs />

              <SdkGenerator />
            </>
          )}
        </section>
      </div>
    </div>
  );
}
