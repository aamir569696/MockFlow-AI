import { useState } from 'react';
import { useHistoryStore } from '../../store/useHistoryStore.js';
import { usePlaygroundStore } from '../../store/playgroundStore.js';

const METHOD_COLORS = {
  GET:    'text-emerald-400 bg-emerald-950 ring-emerald-800',
  POST:   'text-blue-400    bg-blue-950    ring-blue-800',
  PUT:    'text-amber-400   bg-amber-950   ring-amber-800',
  PATCH:  'text-purple-400  bg-purple-950  ring-purple-800',
  DELETE: 'text-red-400     bg-red-950     ring-red-800',
};

function relativeTime(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60)  return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ── Single history card ───────────────────────────────────────────────────────

function HistoryCard({ entry, isActive, onRestore, onRemove }) {
  const methodCounts = entry.endpoints.reduce((acc, ep) => {
    acc[ep.method] = (acc[ep.method] || 0) + 1;
    return acc;
  }, {});

  return (
    <div
      className={`group relative flex flex-col gap-2 rounded-xl border p-3
                  transition-all duration-200 cursor-pointer animate-fade-in
                  ${isActive
                    ? 'border-brand-700/60 bg-brand-950/30 ring-1 ring-brand-700/30'
                    : 'border-gray-800 bg-gray-900/50 hover:border-gray-700 hover:bg-gray-800/50'
                  }`}
      onClick={onRestore}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onRestore()}
      aria-label={`Restore: ${entry.apiName}`}
    >
      {/* Active left-edge bar */}
      {isActive && (
        <div className="absolute left-0 top-3 bottom-3 w-0.5 rounded-r bg-brand-500" />
      )}

      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="truncate text-xs font-semibold text-gray-200">
            {entry.apiName}
          </p>
          <p className="text-xs text-gray-700 tabular-nums">
            {relativeTime(entry.savedAt)}
          </p>
        </div>

        {/* Remove button — shown on hover */}
        <button
          className="shrink-0 rounded-md p-1 text-gray-700 opacity-0 transition-all
                     group-hover:opacity-100 hover:bg-gray-800 hover:text-red-400"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          aria-label={`Remove ${entry.apiName} from history`}
          title="Remove"
        >
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24"
               stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Prompt preview */}
      <p className="line-clamp-2 text-xs leading-relaxed text-gray-600">
        {entry.prompt}
      </p>

      {/* Method badges + endpoint count */}
      <div className="flex flex-wrap items-center gap-1.5">
        {Object.entries(methodCounts).map(([method, count]) => {
          const colors = METHOD_COLORS[method] ?? 'text-gray-400 bg-gray-900 ring-gray-700';
          return (
            <span
              key={method}
              className={`rounded px-1.5 py-0.5 font-mono text-[9px] font-bold
                          ring-1 ${colors}`}
            >
              {method} {count > 1 ? `×${count}` : ''}
            </span>
          );
        })}
        <span className="ml-auto text-xs text-gray-700">
          {entry.endpoints.length} route{entry.endpoints.length !== 1 ? 's' : ''}
        </span>
      </div>
    </div>
  );
}

// ── MockHistorySidebar ────────────────────────────────────────────────────────

export default function MockHistorySidebar() {
  const { entries, remove, clear } = useHistoryStore();
  const {
    sessionId: activeSessionId,
    generate,
    isGenerating,
  } = usePlaygroundStore();

  const [collapsed, setCollapsed] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const handleRestore = (entry) => {
    // Re-run generation with the original prompt so the backend
    // creates a fresh session + registers all endpoints again.
    // This keeps the live routes in sync with the frontend state.
    if (!isGenerating) generate(entry.prompt);
  };

  const handleClear = () => {
    if (!confirmClear) {
      setConfirmClear(true);
      setTimeout(() => setConfirmClear(false), 2500);
      return;
    }
    clear();
    setConfirmClear(false);
  };

  return (
    <div className={`flex flex-col gap-0 overflow-hidden rounded-xl border
                     border-gray-800/80 bg-gray-900/40 transition-all duration-300
                     ${collapsed ? 'max-h-[44px]' : 'max-h-[50dvh] lg:max-h-[600px]'}`}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-3 py-2.5
                      border-b border-gray-800/60 bg-gray-900/60">
        <button
          className="flex items-center gap-2 focus:outline-none"
          onClick={() => setCollapsed((c) => !c)}
          aria-expanded={!collapsed}
          aria-controls="mock-history-list"
        >
          <div className="flex h-5 w-5 items-center justify-center rounded-md
                          bg-amber-600/20 ring-1 ring-amber-600/40">
            <svg className="h-3 w-3 text-amber-400" fill="none" viewBox="0 0 24 24"
                 stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <span className="text-xs font-semibold text-gray-300">Recent History</span>
          {entries.length > 0 && (
            <span className="rounded-full bg-amber-950/60 px-1.5 py-0.5 font-mono
                             text-[10px] font-bold text-amber-400 ring-1 ring-amber-800/50">
              {entries.length}
            </span>
          )}
        </button>

        <div className="flex items-center gap-1.5">
          {/* Clear all */}
          {entries.length > 0 && !collapsed && (
            <button
              onClick={handleClear}
              className={`rounded-md px-2 py-1 text-xs font-medium transition-all
                          ${confirmClear
                            ? 'bg-red-950/50 text-red-300 ring-1 ring-red-700/50'
                            : 'text-gray-600 hover:bg-gray-800 hover:text-gray-400'
                          }`}
              aria-label="Clear all history"
            >
              {confirmClear ? 'Confirm?' : 'Clear all'}
            </button>
          )}
          {/* Collapse toggle */}
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="rounded-md p-1 text-gray-600 hover:bg-gray-800
                       hover:text-gray-400 transition-colors"
            aria-label={collapsed ? 'Expand history' : 'Collapse history'}
          >
            <svg
              className={`h-3.5 w-3.5 transition-transform duration-200
                          ${collapsed ? 'rotate-180' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Body ───────────────────────────────────────────────────────── */}
      <div
        id="mock-history-list"
        className="smooth-scroll flex flex-col gap-2 overflow-y-auto p-2.5
                   max-h-[calc(50dvh-44px)] transition-all duration-300 lg:max-h-[520px]"
        data-lenis-prevent
        aria-live="polite"
      >
        {entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <div className="mb-2 flex h-10 w-10 items-center justify-center
                            rounded-xl bg-gray-800 ring-1 ring-gray-700">
              <svg className="h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24"
                   stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round"
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-xs text-gray-700">
              No history yet — generate an API to start.
            </p>
          </div>
        ) : (
          entries.map((entry) => (
            <HistoryCard
              key={entry.id}
              entry={entry}
              isActive={entry.sessionId === activeSessionId}
              onRestore={() => handleRestore(entry)}
              onRemove={() => remove(entry.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}
