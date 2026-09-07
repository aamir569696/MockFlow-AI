import { useState, useEffect } from 'react';
import { usePlaygroundStore } from '../../store/playgroundStore.js';

/**
 * PurgeWorkspace — destructive "start over" action, isolated at the very bottom
 * of the panel and gated behind an explicit confirmation dialog so it can't be
 * triggered by an accidental click near the Generate button.
 *
 * Purge itself is delegated to the store's purgeWorkspace() — all state/session
 * reset logic lives there and is untouched here.
 */
export default function PurgeWorkspace() {
  const purgeWorkspace = usePlaygroundStore((s) => s.purgeWorkspace);
  const isGenerating   = usePlaygroundStore((s) => s.isGenerating);

  const [open, setOpen]         = useState(false);   // confirmation dialog
  const [isPurging, setPurging] = useState(false);

  // Close the dialog on Escape for keyboard users.
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape' && !isPurging) setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, isPurging]);

  const confirmPurge = async () => {
    setPurging(true);
    try {
      await purgeWorkspace();
      setOpen(false);
    } finally {
      setPurging(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Divider label */}
      <div className="flex items-center gap-2">
        <span className="h-px flex-1 bg-gray-800/70" />
        <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-700">
          Danger Zone
        </span>
        <span className="h-px flex-1 bg-gray-800/70" />
      </div>

      {/* Trigger — opens the confirmation dialog (does NOT purge directly) */}
      <button
        type="button"
        disabled={isGenerating || isPurging}
        onClick={() => setOpen(true)}
        className="group flex w-full items-center justify-center gap-2 rounded-xl
                   border border-gray-700/60 bg-gray-800/30 px-4 py-2.5 text-xs
                   font-semibold text-gray-500 transition-all duration-200
                   hover:border-red-800/50 hover:bg-red-950/20 hover:text-red-400
                   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500
                   disabled:cursor-not-allowed disabled:opacity-40"
        aria-label="Purge workspace"
        title="Wipe all state and start with a fresh session"
      >
        <span aria-hidden="true">🧹</span>
        Purge Workspace
      </button>

      {/* ── Confirmation dialog ──────────────────────────────────────────── */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4
                     animate-fade-in"
          role="dialog"
          aria-modal="true"
          aria-labelledby="purge-dialog-title"
          aria-describedby="purge-dialog-desc"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-gray-950/80 backdrop-blur-sm"
            onClick={() => !isPurging && setOpen(false)}
            aria-hidden="true"
          />

          {/* Panel */}
          <div
            className="relative w-full max-w-sm rounded-2xl border border-red-900/40
                       bg-gray-900/95 p-5 shadow-2xl shadow-black/60"
            style={{ boxShadow: '0 0 40px rgba(248,113,113,0.10)' }}
          >
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center
                              rounded-xl border border-red-900/40 bg-red-950/40
                              ring-1 ring-red-900/20">
                <svg className="h-5 w-5 text-red-400" fill="none" viewBox="0 0 24 24"
                     stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                        d="M12 9v3.75m0 3.75h.008M10.34 3.94l-8.4 14.5A1.5 1.5 0 003.24 21h17.52a1.5 1.5 0 001.3-2.56l-8.4-14.5a1.5 1.5 0 00-2.6 0z" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <h3 id="purge-dialog-title" className="text-sm font-bold text-gray-100">
                  Purge workspace?
                </h3>
                <p id="purge-dialog-desc" className="mt-1 text-xs leading-relaxed text-gray-500">
                  This wipes your prompt, generated endpoints, schema, request history,
                  and saved state, then starts a fresh session. This cannot be undone.
                </p>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={isPurging}
                className="rounded-lg border border-gray-700 bg-gray-900/60 px-3.5 py-2
                           text-xs font-semibold text-gray-300 transition-colors
                           hover:border-gray-600 hover:text-white
                           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-500
                           disabled:cursor-not-allowed disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmPurge}
                disabled={isPurging}
                autoFocus
                className="flex items-center gap-2 rounded-lg bg-red-600 px-3.5 py-2
                           text-xs font-bold text-white transition-colors
                           hover:bg-red-500
                           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400
                           disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isPurging ? (
                  <>
                    <svg className="h-3.5 w-3.5 animate-spin-slow" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10"
                              stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor"
                            d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                    </svg>
                    Purging…
                  </>
                ) : (
                  <>
                    <span aria-hidden="true">🧹</span>
                    Yes, purge everything
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
