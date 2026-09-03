import { useState } from 'react';
import { usePlaygroundStore } from '../../store/playgroundStore.js';
import ExportDropdown from './ExportDropdown.jsx';

const METHOD_COLORS = {
  GET:    'method-GET',
  POST:   'method-POST',
  PUT:    'method-PUT',
  PATCH:  'method-PATCH',
  DELETE: 'method-DELETE',
};

// ── Shimmer skeleton row ──────────────────────────────────────────────────────
// Each row has a method-badge-shaped block + a path bar of randomised width.
// The sweep animation comes from the CSS `skeleton` class + a pseudo-element
// shimmer defined via a background gradient animation.

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
      {/* Method badge placeholder */}
      <div className="skeleton h-5 w-12 shrink-0 rounded" />
      {/* Path bar */}
      <div className={`skeleton h-3 ${barWidth} rounded`} />
      {/* Action buttons placeholder */}
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
      {/* Generating label */}
      <div className="flex items-center gap-2 pb-1">
        <span className="h-1.5 w-1.5 rounded-full bg-brand-500 animate-pulse" />
        <span className="text-xs font-medium text-brand-500 animate-pulse">
          AI is designing your schema…
        </span>
      </div>
      {/* Six shimmer rows — matches typical endpoint count */}
      {[...Array(6)].map((_, i) => (
        <SkeletonRow key={i} index={i} />
      ))}
    </div>
  );
}

// ── Premium empty state ───────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center
                    animate-fade-in">
      {/* Illustrated icon stack */}
      <div className="relative mb-5 flex h-20 w-20 items-center justify-center">
        {/* Outer glow ring */}
        <div className="absolute inset-0 rounded-2xl bg-brand-600/10
                        ring-1 ring-brand-700/30" />
        {/* Inner icon surface */}
        <div className="relative flex h-14 w-14 items-center justify-center
                        rounded-xl bg-gray-900 ring-1 ring-gray-800">
          <svg className="h-7 w-7 text-gray-600" fill="none" viewBox="0 0 24 24"
               stroke="currentColor" strokeWidth={1.25}>
            <path strokeLinecap="round" strokeLinejoin="round"
                  d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5
                     a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        {/* Floating method pill decorations */}
        <span className="absolute -top-1.5 -right-2 rounded-full bg-emerald-950
                         px-1.5 py-0.5 font-mono text-[9px] font-bold text-emerald-500
                         ring-1 ring-emerald-800/60">
          GET
        </span>
        <span className="absolute -bottom-1.5 -left-2 rounded-full bg-blue-950
                         px-1.5 py-0.5 font-mono text-[9px] font-bold text-blue-500
                         ring-1 ring-blue-800/60">
          POST
        </span>
      </div>

      {/* Copy */}
      <h3 className="text-sm font-semibold text-gray-400">No endpoints yet</h3>
      <p className="mt-1.5 max-w-[220px] text-xs leading-relaxed text-gray-600">
        Describe your API in the panel on the left and click{' '}
        <span className="font-semibold text-brand-500">Generate Mock API</span> to
        create live, hittable routes instantly.
      </p>

      {/* Decorative route previews */}
      <div className="mt-5 flex flex-col gap-1.5 w-full max-w-xs opacity-30"
           aria-hidden="true">
        {[
          { m: 'GET',    p: '/api/mock/…/users'    },
          { m: 'POST',   p: '/api/mock/…/users'    },
          { m: 'DELETE', p: '/api/mock/…/users'    },
        ].map(({ m, p }) => (
          <div key={`${m}-${p}`}
               className="flex items-center gap-2 rounded-lg border border-gray-800
                          bg-gray-900/40 px-3 py-2">
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
    <svg className="h-3.5 w-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24"
         stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  ) : (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24"
         stroke="currentColor" strokeWidth={2}>
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path strokeLinecap="round" strokeLinejoin="round"
            d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </svg>
  );
}

// ── EndpointPreview ───────────────────────────────────────────────────────────

export default function EndpointPreview() {
  const {
    endpoints, sessionId, activeEndpoint, setActiveEndpoint,
    isGenerating, clearWorkspace,
  } = usePlaygroundStore();

  const [copiedSlug, setCopiedSlug] = useState(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const copyUrl = (url, slug) => {
    navigator.clipboard.writeText(window.location.origin + url).catch(() => {});
    setCopiedSlug(slug);
    setTimeout(() => setCopiedSlug(null), 1800);
  };

  const handleClear = () => {
    if (!confirmClear) {
      setConfirmClear(true);
      setTimeout(() => setConfirmClear(false), 2800); // auto-cancel after 2.8s
      return;
    }
    clearWorkspace();
    setConfirmClear(false);
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
          {/* Count badge */}
          {endpoints.length > 0 && (
            <span className="rounded-full bg-brand-900/60 px-2 py-0.5 text-xs
                             font-semibold text-brand-300 ring-1 ring-brand-700/50">
              {endpoints.length}
            </span>
          )}

          {/* Export button — only when endpoints exist */}
          {endpoints.length > 0 && <ExportDropdown compact />}

          {/* Clear Workspace button */}
          {(endpoints.length > 0 || isGenerating) && (
            <button
              className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5
                          text-xs font-semibold transition-all duration-150
                          focus-visible:outline-none focus-visible:ring-2
                          focus-visible:ring-red-500
                          ${confirmClear
                            ? 'border-red-700/60 bg-red-950/50 text-red-300 ring-1 ring-red-700/40'
                            : 'border-gray-700 bg-gray-800/60 text-gray-500 hover:border-red-800/60 hover:bg-red-950/30 hover:text-red-400'
                          }`}
              onClick={handleClear}
              title={confirmClear ? 'Click again to confirm reset' : 'Clear workspace'}
              aria-label={confirmClear ? 'Confirm clear workspace' : 'Clear workspace'}
            >
              {confirmClear ? (
                <>
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24"
                       stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round"
                          d="M12 9v2m0 4h.01M12 3a9 9 0 100 18A9 9 0 0012 3z" />
                  </svg>
                  Confirm?
                </>
              ) : (
                <>
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24"
                       stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round"
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0
                             01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0
                             00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Clear
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* ── Shimmer skeleton while generating ─────────────────────────── */}
      {isGenerating && <SkeletonOverlay />}

      {/* ── Premium empty state ────────────────────────────────────────── */}
      {!isGenerating && !endpoints.length && <EmptyState />}

      {/* ── Endpoint list ──────────────────────────────────────────────── */}
      {!isGenerating && endpoints.length > 0 && (
        <ul className="flex flex-col gap-1.5 animate-slide-up" role="list">
          {endpoints.map((ep, index) => {
            const mockPath = `/api/mock/${sessionId}/${ep.slug}`;
            const isActive =
              activeEndpoint?.slug === ep.slug &&
              activeEndpoint?.method === ep.method;
            const methodClass = METHOD_COLORS[ep.method] ?? 'method-GET';

            return (
              <li
                key={`${index}-${ep.method}-${ep.slug}`}
                className={`group relative flex items-center gap-2 rounded-lg
                  border px-3 py-2.5 transition-all duration-150 cursor-pointer
                  ${isActive
                    ? 'border-brand-700/60 bg-brand-950/40 ring-1 ring-brand-700/30'
                    : 'border-gray-800 bg-gray-800/30 hover:border-gray-700 hover:bg-gray-800/60'
                  }`}
                onClick={() => setActiveEndpoint(ep)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && setActiveEndpoint(ep)}
                aria-pressed={isActive}
                aria-label={`${ep.method} ${mockPath}`}
              >
                {/* Active left-edge indicator */}
                {isActive && (
                  <div className="absolute left-0 top-1/2 h-4 w-0.5
                                  -translate-y-1/2 rounded-r bg-brand-500" />
                )}

                {/* Method badge */}
                <span className={`method-badge ${methodClass}`}>
                  {ep.method ?? 'GET'}
                </span>

                {/* Path + description */}
                <div className="flex min-w-0 flex-1 flex-col">
                  <code className="break-all text-xs text-gray-300
                                   group-hover:text-gray-100 transition-colors
                                   [word-break:break-all]">
                    {mockPath}
                  </code>
                  {ep.description && (
                    <p className="truncate text-xs text-gray-600 mt-0.5">
                      {ep.description}
                    </p>
                  )}
                </div>

                {/* Actions — always visible on touch, hover-fade on pointer devices */}
                <div className="flex shrink-0 items-center gap-1.5
                                opacity-100 transition-opacity
                                [@media(hover:hover)]:opacity-0
                                [@media(hover:hover)]:group-hover:opacity-100">
                  <button
                    className={`btn-ghost rounded-md p-1.5 text-xs
                      ${copiedSlug === ep.slug ? 'text-emerald-400' : ''}`}
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
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
