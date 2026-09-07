import { useState, useEffect } from 'react';
import { usePlaygroundStore } from '../../store/playgroundStore.js';

/**
 * ShareDocsButton — quick-access navbar entry point for the public docs link.
 *
 * A small "🔗 Share Docs" navbar button that opens a compact modal with the
 * same content as the Share Public Docs section in Lab & Exports (link + Copy
 * link + Open Docs Page). This is an ADDITIONAL entry point — the Lab & Exports
 * section is left untouched. Renders nothing until an API has been generated.
 */
export default function ShareDocsButton() {
  const sessionId = usePlaygroundStore((s) => s.sessionId);
  const endpoints = usePlaygroundStore((s) => s.endpoints);

  const [open, setOpen]     = useState(false);
  const [copied, setCopied] = useState(false);

  const ready   = Boolean(sessionId && endpoints.length);
  const docsUrl = ready && typeof window !== 'undefined'
    ? `${window.location.origin}/docs/${sessionId}`
    : '';

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // Only a meaningful action once there's an API to document.
  if (!ready) return null;

  const copy = () => {
    navigator.clipboard?.writeText(docsUrl).then(
      () => { setCopied(true); setTimeout(() => setCopied(false), 1800); },
      () => {},
    );
  };

  return (
    <>
      {/* Navbar trigger */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs
                   font-medium text-slate-300 transition-all duration-150
                   hover:text-white focus-visible:outline-none
                   focus-visible:ring-2 focus-visible:ring-sky-500"
        style={{
          background: 'rgba(30,41,59,0.60)',
          border: '1px solid rgba(56,189,248,0.22)',
          backdropFilter: 'blur(8px)',
        }}
        aria-label="Share public docs"
        aria-haspopup="dialog"
        title="Share a public, read-only docs link"
      >
        <span aria-hidden="true">🔗</span>
        <span className="hidden sm:inline">Share Docs</span>
      </button>

      {/* Modal popover */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-24
                     animate-fade-in"
          role="dialog"
          aria-modal="true"
          aria-labelledby="share-docs-title"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-gray-950/80 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />

          {/* Panel */}
          <div
            className="relative w-full max-w-md rounded-2xl border border-sky-900/40
                       bg-gray-900/95 p-5 shadow-2xl shadow-black/60"
            style={{ boxShadow: '0 0 40px rgba(56,189,248,0.10)' }}
          >
            {/* Header */}
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl
                              bg-sky-600/20 ring-1 ring-sky-600/40">
                <svg className="h-4.5 w-4.5 text-sky-400" fill="none" viewBox="0 0 24 24"
                     stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                        d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <h3 id="share-docs-title" className="text-sm font-bold text-gray-100">
                  Share Public Docs
                </h3>
                <p className="mt-0.5 text-xs leading-relaxed text-gray-500">
                  Read-only, no login required. Always reflects your latest schema.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="shrink-0 rounded-md p-1 text-gray-600 transition-colors hover:text-gray-300"
                aria-label="Close"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Link + copy */}
            <div className="mt-4 flex items-center gap-2">
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

            {/* Open docs page */}
            <a
              href={docsUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className="mt-2 flex items-center justify-center gap-1.5 rounded-lg bg-sky-600/90
                         px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-sky-500
                         focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              Open Docs Page
            </a>

            <p className="mt-3 text-center text-[10px] text-gray-700">
              Also available in the Lab &amp; Exports tab.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
