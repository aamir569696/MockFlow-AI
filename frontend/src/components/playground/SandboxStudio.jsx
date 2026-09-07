import { useState, useEffect, useRef } from 'react';
import { usePlaygroundStore } from '../../store/playgroundStore.js';
import RequestRunner from './RequestRunner.jsx';
import SdkGenerator from './SdkGenerator.jsx';
import ExportDropdown from './ExportDropdown.jsx';

/**
 * SandboxStudio — Enterprise 3-Tab Sandbox Studio Grid.
 *
 * A fixed-shell, Postman/Vercel-style tabbed workspace that eliminates the
 * long right-panel scroll. Three isolated views share a single store, so no
 * business logic is duplicated:
 *
 *   🚀 Request Workbench — URL bar, headers, region gateway, Fire button
 *                          (RequestRunner in "workbench" view).
 *   📡 Monitor Console   — live telemetry + response body
 *                          (RequestRunner in "monitor" view). Auto-focused
 *                          the moment a fetch completes successfully.
 *   📦 Lab & Exports     — Postman v2.1 export + 10-runtime SDK Generator.
 *                          (Load/stress tooling lives on the Dashboard.)
 */

const STUDIO_TABS = [
  {
    id:    'workbench',
    label: 'Request Workbench',
    emoji: '🚀',
    hint:  'Compose & fire',
    accent: 'indigo',
  },
  {
    id:    'monitor',
    label: 'Monitor Console',
    emoji: '📡',
    hint:  'Live telemetry',
    accent: 'emerald',
  },
  {
    id:    'lab',
    label: 'Lab & Exports',
    emoji: '📦',
    hint:  'Postman · SDK',
    accent: 'purple',
  },
];

// Tailwind-safe accent class maps (no dynamic string interpolation).
const ACCENT_ACTIVE = {
  indigo:  'border-indigo-500 text-indigo-300 bg-indigo-950/30',
  emerald: 'border-emerald-500 text-emerald-300 bg-emerald-950/30',
  purple:  'border-purple-500 text-purple-300 bg-purple-950/30',
};

export default function SandboxStudio() {
  const [tab, setTab] = useState('workbench');

  // ── Auto-switch to Monitor on a successful fetch ─────────────────────────
  // Detect the isFiring falling-edge: was firing, now settled with a status
  // and no error → glide into the Monitor Console.
  const isFiring = usePlaygroundStore((s) => s.runner.isFiring);
  const status   = usePlaygroundStore((s) => s.runner.status);
  const error    = usePlaygroundStore((s) => s.runner.error);
  const wasFiring = useRef(false);

  useEffect(() => {
    if (wasFiring.current && !isFiring && status !== null && !error) {
      setTab('monitor');
    }
    wasFiring.current = isFiring;
  }, [isFiring, status, error]);

  // Live "unseen result" pip on the Monitor tab when the user is elsewhere.
  const hasResult = status !== null;

  return (
    <div className="card ambient-grid flex flex-col overflow-hidden p-0">
      {/* ── Tab controller ─────────────────────────────────────────────── */}
      <div
        role="tablist"
        aria-label="Sandbox Studio"
        className="flex shrink-0 items-stretch gap-1 border-b border-gray-800/60 p-1.5"
        style={{ background: 'rgba(15,23,42,0.6)' }}
      >
        {STUDIO_TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={active}
              aria-controls={`studio-panel-${t.id}`}
              id={`studio-tab-${t.id}`}
              onClick={() => setTab(t.id)}
              className={`group relative flex flex-1 items-center justify-center gap-2
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

              {/* Unseen-result pip on Monitor */}
              {t.id === 'monitor' && hasResult && !active && (
                <span className="absolute right-2 top-1.5 flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping
                                   rounded-full bg-emerald-400 opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Tab panels ─────────────────────────────────────────────────── */}
      <div className="min-h-0 flex-1 p-4 sm:p-5">
        {/* Tab 1 — Request Workbench */}
        <section
          id="studio-panel-workbench"
          role="tabpanel"
          aria-labelledby="studio-tab-workbench"
          hidden={tab !== 'workbench'}
          className={tab === 'workbench' ? 'flex flex-col gap-4 animate-fade-in' : ''}
        >
          {tab === 'workbench' && <RequestRunner view="workbench" />}
        </section>

        {/* Tab 2 — Monitor Console */}
        <section
          id="studio-panel-monitor"
          role="tabpanel"
          aria-labelledby="studio-tab-monitor"
          hidden={tab !== 'monitor'}
          className={tab === 'monitor' ? 'flex flex-col gap-4 animate-fade-in' : ''}
        >
          {tab === 'monitor' && <RequestRunner view="monitor" />}
        </section>

        {/* Tab 3 — Lab & Exports */}
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

              <SdkGenerator />
            </>
          )}
        </section>
      </div>
    </div>
  );
}
