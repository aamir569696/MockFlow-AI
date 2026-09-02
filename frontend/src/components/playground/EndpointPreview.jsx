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

export default function EndpointPreview() {
  const { endpoints, sessionId, activeEndpoint, setActiveEndpoint, isGenerating } =
    usePlaygroundStore();
  const [copiedSlug, setCopiedSlug] = useState(null);

  const copyUrl = (url, slug) => {
    navigator.clipboard.writeText(window.location.origin + url).catch(() => {});
    setCopiedSlug(slug);
    setTimeout(() => setCopiedSlug(null), 1800);
  };

  return (
    <div className="card flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-600/20 ring-1 ring-emerald-600/40">
            <svg className="h-4 w-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          </div>
          <h2 className="text-sm font-semibold text-gray-200">
            Endpoints
          </h2>
        </div>
        {endpoints.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-brand-900/60 px-2 py-0.5 text-xs font-semibold text-brand-300 ring-1 ring-brand-700/50">
              {endpoints.length}
            </span>
            <ExportDropdown compact />
          </div>
        )}
      </div>

      {/* Loading skeleton */}
      {isGenerating && (
        <div className="flex flex-col gap-2 animate-pulse">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="skeleton h-5 w-12 rounded" />
              <div className="skeleton h-4 flex-1 rounded" />
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isGenerating && !endpoints.length && (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gray-800 ring-1 ring-gray-700">
            <svg className="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-xs text-gray-600">Routes will appear here after generation</p>
        </div>
      )}

      {/* Endpoint list */}
      {!isGenerating && endpoints.length > 0 && (
        <ul className="flex flex-col gap-1.5 animate-slide-up" role="list">
          {endpoints.map((ep, index) => {
            const mockPath = `/api/mock/${sessionId}/${ep.slug}`;
            const isActive = activeEndpoint?.slug === ep.slug && activeEndpoint?.method === ep.method;
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
                {/* Active indicator */}
                {isActive && (
                  <div className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-r bg-brand-500" />
                )}

                {/* Method badge */}
                <span className={`method-badge ${methodClass}`}>
                  {ep.method ?? 'GET'}
                </span>

                {/* Path */}
                <div className="flex min-w-0 flex-1 flex-col">
                  <code className="truncate text-xs text-gray-300 group-hover:text-gray-100 transition-colors">
                    {mockPath}
                  </code>
                  {ep.description && (
                    <p className="truncate text-xs text-gray-600 mt-0.5">{ep.description}</p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex shrink-0 items-center gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
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
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
