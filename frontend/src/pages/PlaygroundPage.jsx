import { useState } from 'react';
import { Link } from 'react-router-dom';
import PromptPanel from '../components/playground/PromptPanel.jsx';
import EndpointPreview from '../components/playground/EndpointPreview.jsx';
import SchemaEditor from '../components/playground/SchemaEditor.jsx';
import SavePromptBanner from '../components/playground/SavePromptBanner.jsx';
import ExportDropdown from '../components/playground/ExportDropdown.jsx';
import MockHistorySidebar from '../components/playground/MockHistorySidebar.jsx';
import SandboxStudio from '../components/playground/SandboxStudio.jsx';
import { usePlaygroundStore } from '../store/playgroundStore.js';
import { useAuthStore } from '../store/authStore.js';

// ── NavBar ────────────────────────────────────────────────────────────────────

/**
 * Pulsing connectivity node — amber when guest, green when authenticated.
 * Three concentric rings animate at different speeds to suggest live signal.
 */
function ConnectivityNode({ isAuthenticated }) {
  const color = isAuthenticated
    ? { dot: 'bg-emerald-400', ring1: 'bg-emerald-500/20', ring2: 'bg-emerald-500/10' }
    : { dot: 'bg-amber-400',  ring1: 'bg-amber-500/20',  ring2: 'bg-amber-500/10'  };

  return (
    <span className="relative flex h-3 w-3 shrink-0 items-center justify-center"
          aria-hidden="true">
      {/* Outer slow-pulse ring */}
      <span
        className={`absolute inline-flex h-full w-full rounded-full ${color.ring2} animate-ping`}
        style={{ animationDuration: '2.4s' }}
      />
      {/* Middle ring */}
      <span
        className={`absolute inline-flex h-2.5 w-2.5 rounded-full ${color.ring1} animate-ping`}
        style={{ animationDuration: '1.8s', animationDelay: '0.3s' }}
      />
      {/* Core dot */}
      <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${color.dot}`} />
    </span>
  );
}

function NavBar() {
  const { endpoints, sessionId } = usePlaygroundStore();
  const { isAuthenticated, openAuthModal } = useAuthStore();

  return (
    <header
      className="sticky top-0 z-30 flex min-w-0 items-center justify-between gap-2
                 border-b border-indigo-500/20 px-3 py-3 sm:px-5"
      style={{
        /* Frosted glass */
        background: 'rgba(15, 23, 42, 0.60)',     /* slate-900/60 */
        backdropFilter: 'blur(14px) saturate(1.6)',
        WebkitBackdropFilter: 'blur(14px) saturate(1.6)',
        /* Subtle noise texture using a very faint radial pattern */
        backgroundImage:
          'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(99,102,241,0.08) 0%, transparent 70%)',
      }}
    >
      {/* ── Brand logo ──────────────────────────────────────────────────── */}
      <Link to="/" className="group flex shrink-0 items-center gap-2.5">
        {/* Icon mark */}
        <div
          className="flex h-7 w-7 items-center justify-center rounded-lg
                     transition-transform duration-200 group-hover:scale-105"
          style={{
            background: 'linear-gradient(135deg, #6272f5 0%, #a78bfa 100%)',
            boxShadow: '0 0 12px rgba(98,114,245,0.45), inset 0 1px 0 rgba(255,255,255,0.15)',
          }}
        >
          <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24"
               stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round"
                  d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>

        {/* Gradient brand title */}
        <span
          className="text-sm font-extrabold tracking-tight"
          style={{
            backgroundImage:
              'linear-gradient(90deg, #a4bcfd 0%, #8098fb 35%, #c084fc 75%, #a4bcfd 100%)',
            backgroundSize: '200% auto',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          ⚡ MockFlow
          <span
            className="ml-0.5 hidden sm:inline"
            style={{ WebkitTextFillColor: 'rgba(148,163,184,0.6)' }}
          >
            {' '}AI
          </span>
        </span>
      </Link>

      {/* ── Session pill — sm+ only ──────────────────────────────────────── */}
      {sessionId && (
        <div className="hidden min-w-0 flex-1 items-center justify-center sm:flex">
          <div
            className="flex min-w-0 max-w-xs items-center gap-2 rounded-full
                       border border-gray-700/50 px-3 py-1"
            style={{
              background: 'rgba(30,41,59,0.70)',
              backdropFilter: 'blur(8px)',
            }}
          >
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400 animate-pulse" />
            <span className="truncate font-mono text-xs text-slate-500 tracking-tight">
              <span className="hidden md:inline text-slate-600">session&nbsp;</span>
              <span className="text-slate-400">{sessionId.slice(0, 8)}…</span>
            </span>
          </div>
        </div>
      )}

      {/* ── Right actions ────────────────────────────────────────────────── */}
      <div className="flex shrink-0 items-center gap-2">
        {/* Endpoint count pill */}
        {endpoints.length > 0 && (
          <span
            className="hidden items-center gap-1.5 rounded-full px-2.5 py-1
                       text-xs font-semibold md:inline-flex"
            style={{
              background: 'rgba(98,114,245,0.12)',
              border: '1px solid rgba(98,114,245,0.30)',
              color: '#a4bcfd',
            }}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-brand-400 animate-pulse" />
            {endpoints.length}
            <span className="hidden lg:inline">
              {' '}endpoint{endpoints.length !== 1 ? 's' : ''} live
            </span>
          </span>
        )}

        {/* Export */}
        {endpoints.length > 0 && <ExportDropdown compact />}

        {/* Auth / Dashboard — with connectivity node */}
        {!isAuthenticated ? (
          <button
            className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs
                       font-medium text-slate-300 transition-all duration-150
                       hover:text-white focus-visible:outline-none
                       focus-visible:ring-2 focus-visible:ring-indigo-500"
            style={{
              background: 'rgba(30,41,59,0.60)',
              border: '1px solid rgba(99,102,241,0.20)',
              backdropFilter: 'blur(8px)',
            }}
            onClick={() => openAuthModal('manual')}
            aria-label="Sign in"
          >
            <ConnectivityNode isAuthenticated={false} />
            <span className="hidden sm:inline">Sign in</span>
            {/* Icon-only on xs */}
            <svg className="h-3.5 w-3.5 sm:hidden" fill="none" viewBox="0 0 24 24"
                 stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </button>
        ) : (
          <Link
            to="/dashboard"
            className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs
                       font-medium text-slate-300 transition-all duration-150
                       hover:text-white focus-visible:outline-none
                       focus-visible:ring-2 focus-visible:ring-indigo-500"
            style={{
              background: 'rgba(30,41,59,0.60)',
              border: '1px solid rgba(52,211,153,0.20)',
              backdropFilter: 'blur(8px)',
            }}
            aria-label="Dashboard"
          >
            <ConnectivityNode isAuthenticated={true} />
            <span className="hidden sm:inline">Dashboard</span>
            <svg className="h-3.5 w-3.5 sm:hidden" fill="none" viewBox="0 0 24 24"
                 stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                    d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2
                       2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0
                       011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          </Link>
        )}
      </div>
    </header>
  );
}

// ── SubHeader ─────────────────────────────────────────────────────────────────

function SubHeader() {
  return (
    <div
      className="relative border-b border-gray-800/40 px-4 py-3 sm:px-6"
      style={{
        background:
          'linear-gradient(180deg, rgba(15,23,42,0.75) 0%, rgba(3,7,18,0.0) 100%)',
      }}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">

        {/* ── Headline + subtitle block ──────────────────────────────────── */}
        <div className="flex flex-col gap-0.5">
          {/* Gradient headline */}
          <h1
            className="text-lg font-extrabold leading-tight tracking-tight sm:text-xl"
            style={{
              backgroundImage:
                'linear-gradient(90deg, #e0e7ff 0%, #a4bcfd 30%, #8098fb 60%, #c084fc 100%)',
              backgroundSize: '200% auto',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            ⚡ Autonomous API Prototyping Grid
          </h1>

          {/* Subtitle */}
          <p
            className="max-w-xl px-1 text-sm leading-relaxed text-slate-400 sm:px-0"
            style={{ color: 'rgba(148,163,184,0.60)' }}
          >
            Type requirements in plain language —{' '}
            <span style={{ color: 'rgba(165,180,252,0.75)' }}>
              MockFlow automatically compiles, secures, and exposes
            </span>{' '}
            scalable live HTTP routes instantly.
          </p>
        </div>

        {/* ── Gemini badge ───────────────────────────────────────────────── */}
        <div
          className="flex w-full max-w-full flex-wrap items-center justify-between gap-2
                     self-start overflow-x-auto whitespace-nowrap scrollbar-none
                     rounded-full px-3 py-1.5 text-xs sm:w-auto sm:self-auto sm:text-sm"
          style={{
            background:
              'linear-gradient(135deg, rgba(15,23,42,0.90) 0%, rgba(30,27,75,0.85) 100%)',
            border: '1px solid rgba(129,140,248,0.28)',
            backdropFilter: 'blur(12px)',
            boxShadow: '0 0 16px rgba(99,102,241,0.15)',
          }}
        >
          {/* Animated signal bead */}
          <span className="relative flex h-2 w-2 shrink-0">
            <span
              className="absolute inline-flex h-full w-full rounded-full
                         bg-indigo-400/40 animate-ping"
              style={{ animationDuration: '1.8s' }}
            />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-indigo-400" />
          </span>

          {/* Robot emoji */}
          <span className="text-sm leading-none" aria-hidden="true">🤖</span>

          {/* Badge text */}
          <span
            className="font-sans text-[11px] font-semibold tracking-wide whitespace-nowrap"
            style={{ color: 'rgba(165,180,252,0.88)' }}
          >
            Gemini 2.5-Flash Active
          </span>

          {/* Separator + zero cost note */}
          <span style={{ color: 'rgba(71,85,105,0.50)' }} aria-hidden="true">•</span>
          <span
            className="font-mono text-[10px] font-medium whitespace-nowrap"
            style={{ color: 'rgba(52,211,153,0.70)' }}
          >
            Zero-Cost Sync
          </span>

          {/* Live bolt */}
          <svg
            className="h-3 w-3 shrink-0"
            fill="currentColor" viewBox="0 0 24 24"
            style={{ color: 'rgba(129,140,248,0.65)' }}
            aria-hidden="true"
          >
            <path d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
      </div>
    </div>
  );
}

// ── Mobile panel tab switcher ─────────────────────────────────────────────────

const TABS = [
  { id: 'input',  label: 'Input',  icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
  { id: 'output', label: 'Output', icon: 'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1' },
];

function MobileTabs({ active, onChange }) {
  return (
    <div
      className="flex border-b border-gray-800/50 lg:hidden"
      role="tablist"
      aria-label="Workspace panels"
      style={{ background: 'rgba(15,23,42,0.80)' }}
    >
      {TABS.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={active === tab.id}
          aria-controls={`panel-${tab.id}`}
          id={`tab-${tab.id}`}
          onClick={() => onChange(tab.id)}
          className={`flex flex-1 items-center justify-center gap-2 py-3 text-xs
                      font-semibold tracking-wide transition-colors duration-150
                      ${active === tab.id
                        ? 'border-b-2 border-indigo-500 text-indigo-300 bg-indigo-950/20'
                        : 'border-b-2 border-transparent text-gray-600 hover:text-gray-400'
                      }`}
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24"
               stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d={tab.icon} />
          </svg>
          {tab.label}
        </button>
      ))}
    </div>
  );
}

// ── PlaygroundPage ─────────────────────────────────────────────────────────────

export default function PlaygroundPage() {
  const [activeTab, setActiveTab] = useState('input');

  return (
    <div className="flex min-h-dvh flex-col overflow-x-hidden bg-gray-950">
      <NavBar />
      <SubHeader />
      <MobileTabs active={activeTab} onChange={setActiveTab} />

      {/* ── Main workspace ─────────────────────────────────────────────── */}
      <main className="flex min-w-0 flex-1 flex-col lg:flex-row">

        {/* LEFT PANEL — Input */}
        <section
          id="panel-input"
          role="tabpanel"
          aria-labelledby="tab-input"
          className={`ambient-grid flex min-w-0 flex-col gap-4 p-4 sm:p-5
                      lg:w-[42%] lg:border-r lg:border-gray-800/40
                      transition-shadow duration-300
                      ${activeTab === 'input' ? 'flex' : 'hidden lg:flex'}`}
          style={{
            boxShadow: 'inset 0 0 25px rgba(99,102,241,0.06), 0 0 25px rgba(99,102,241,0.06)',
          }}
        >
          <div className="hidden items-center gap-2 lg:flex">
            <span className="h-px flex-1 bg-gray-800/60" />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-700">
              Input
            </span>
            <span className="h-px flex-1 bg-gray-800/60" />
          </div>
          <PromptPanel />
          <MockHistorySidebar />
          <SchemaEditor />
        </section>

        {/* RIGHT PANEL — Live Output */}
        <section
          id="panel-output"
          role="tabpanel"
          aria-labelledby="tab-output"
          className={`ambient-grid flex min-w-0 flex-1 flex-col gap-4 p-4 sm:p-5
                      transition-shadow duration-300
                      ${activeTab === 'output' ? 'flex' : 'hidden lg:flex'}`}
          style={{
            boxShadow: 'inset 0 0 25px rgba(52,211,153,0.04), 0 0 25px rgba(99,102,241,0.05)',
          }}
        >
          <div className="hidden items-center gap-2 lg:flex">
            <span className="h-px flex-1 bg-gray-800/60" />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-700">
              Live Output
            </span>
            <span className="h-px flex-1 bg-gray-800/60" />
          </div>
          <EndpointPreview />
          <SandboxStudio />
        </section>
      </main>

      <SavePromptBanner />
    </div>
  );
}
