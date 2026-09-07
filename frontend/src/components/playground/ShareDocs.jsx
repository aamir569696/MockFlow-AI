import { useState } from 'react';
import { usePlaygroundStore } from '../../store/playgroundStore.js';

/**
 * ShareDocs — publish/share a public, read-only docs link for the current API.
 *
 * The docs page (/docs/:sessionId) regenerates from live session state on each
 * view, so "publishing" is simply surfacing the shareable URL — no snapshot
 * step needed. Anyone with the link can view the docs without logging in.
 */
export default function ShareDocs() {
  const sessionId = usePlaygroundStore((s) => s.sessionId);
  const endpoints = usePlaygroundStore((s) => s.endpoints);
  const [copied, setCopied] = useState(false);

  const ready   = Boolean(sessionId && endpoints.length);
  const docsUrl = ready && typeof window !== 'undefined'
    ? `${window.location.origin}/docs/${sessionId}`
    : '';

  const copy = () => {
    if (!docsUrl) return;
    navigator.clipboard?.writeText(docsUrl).then(
      () => { setCopied(true); setTimeout(() => setCopied(false), 1800); },
      () => {},
    );
  };

  return (
    <div className="rounded-xl border border-gray-800/70 bg-gray-900/50 p-3">
      <div className="flex items-center gap-2">
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md
                        bg-sky-600/20 ring-1 ring-sky-600/40">
          <svg className="h-3.5 w-3.5 text-sky-400" fill="none" viewBox="0 0 24 24"
               stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round"
                  d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
          </svg>
        </div>
        <div className="flex flex-col">
          <span className="text-xs font-semibold text-gray-300">Share Public Docs</span>
          <span className="text-[10px] text-gray-600">
            Read-only, no login required · always reflects your latest schema
          </span>
        </div>
      </div>

      {!ready ? (
        <p className="mt-3 rounded-lg border border-dashed border-gray-800 px-3 py-2.5
                      text-center text-[11px] text-gray-600">
          Generate an API first to get a shareable docs link.
        </p>
      ) : (
        <div className="mt-3 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={docsUrl}
              onFocus={(e) => e.target.select()}
              aria-label="Public docs URL"
              className="input flex-1 py-1.5 font-mono text-[11px] text-gray-300"
            />
            <button
              type="button"
              onClick={copy}
              className={`flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5
                          text-[11px] font-semibold transition-all
                          ${copied
                            ? 'border-emerald-800/60 bg-emerald-950/40 text-emerald-400'
                            : 'border-gray-700 bg-gray-800/60 text-gray-300 hover:border-gray-600 hover:text-white'}`}
              aria-label="Copy docs link"
            >
              {copied ? (
                <><svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>Copied</>
              ) : (
                <><svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="9" y="9" width="13" height="13" rx="2" /><path strokeLinecap="round" strokeLinejoin="round" d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg>Copy link</>
              )}
            </button>
          </div>
          <a
            href={docsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 rounded-lg bg-sky-600/90 px-3 py-2
                       text-xs font-bold text-white transition-colors hover:bg-sky-500
                       focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            Open Docs Page
          </a>
        </div>
      )}
    </div>
  );
}
