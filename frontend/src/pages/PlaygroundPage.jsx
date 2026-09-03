import { useState } from 'react';
import { Link } from 'react-router-dom';
import PromptPanel from '../components/playground/PromptPanel.jsx';
import EndpointPreview from '../components/playground/EndpointPreview.jsx';
import SchemaEditor from '../components/playground/SchemaEditor.jsx';
import RequestRunner from '../components/playground/RequestRunner.jsx';
import SavePromptBanner from '../components/playground/SavePromptBanner.jsx';
import ExportDropdown from '../components/playground/ExportDropdown.jsx';
import MockHistorySidebar from '../components/playground/MockHistorySidebar.jsx';
import { usePlaygroundStore } from '../store/playgroundStore.js';
import { useAuthStore } from '../store/authStore.js';

// ── NavBar ────────────────────────────────────────────────────────────────────

function NavBar() {
  const { endpoints, sessionId } = usePlaygroundStore();
  const { isAuthenticated, openAuthModal } = useAuthStore();

  return (
    <header className="sticky top-0 z-30 flex min-w-0 items-center justify-between
                       gap-2 border-b border-gray-800/80 bg-gray-950/90
                       backdrop-blur-md px-3 py-3 sm:px-5">

      {/* Logo — always visible, never shrinks below icon */}
      <Link to="/" className="flex shrink-0 items-center gap-2 group">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg
                        bg-brand-600 shadow-lg shadow-brand-900/50
                        transition-transform group-hover:scale-105">
          <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24"
               stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round"
                  d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <span className="text-sm font-bold tracking-tight">
          Mock<span className="text-brand-400">Flow</span>
          {/* "AI" text hidden on very small screens */}
          <span className="ml-1 hidden font-normal text-gray-600 sm:inline">AI</span>
        </span>
      </Link>

      {/* Session pill — only sm+ to avoid nav overflow on 360px */}
      {sessionId && (
        <div className="hidden min-w-0 flex-1 items-center justify-center sm:flex">
          <div className="flex min-w-0 max-w-xs items-center gap-1.5 rounded-full
                          border border-gray-800 bg-gray-900 px-3 py-1">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500 animate-pulse" />
            <span className="truncate font-mono text-xs text-gray-500 tracking-tight">
              <span className="hidden md:inline">session&nbsp;</span>
              <span className="text-gray-400">{sessionId.slice(0, 8)}…</span>
            </span>
          </div>
        </div>
      )}

      {/* Right actions */}
      <div className="flex shrink-0 items-center gap-1.5">
        {/* Endpoint count pill — only md+ */}
        {endpoints.length > 0 && (
          <span className="hidden items-center gap-1 rounded-full bg-brand-950/60
                           px-2 py-1 text-xs font-semibold text-brand-300
                           ring-1 ring-brand-800/50 md:inline-flex">
            {endpoints.length}
            <span className="hidden lg:inline">
              {' '}endpoint{endpoints.length !== 1 ? 's' : ''} live
            </span>
          </span>
        )}

        {/* Export — icon-only on mobile, labelled on sm+ */}
        {endpoints.length > 0 && <ExportDropdown compact />}

        {/* Auth button — icon-only on mobile */}
        {!isAuthenticated ? (
          <button
            className="btn-ghost p-1.5 text-xs sm:px-3 sm:py-1.5"
            onClick={() => openAuthModal('manual')}
            aria-label="Sign in"
          >
            <svg className="h-4 w-4 sm:hidden" fill="none" viewBox="0 0 24 24"
                 stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span className="hidden sm:inline">Sign in</span>
          </button>
        ) : (
          <Link to="/dashboard"
                className="btn-ghost p-1.5 text-xs sm:px-3 sm:py-1.5"
                aria-label="Dashboard">
            <svg className="h-4 w-4 sm:hidden" fill="none" viewBox="0 0 24 24"
                 stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                    d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2
                       2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0
                       011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <span className="hidden sm:inline">Dashboard</span>
          </Link>
        )}
      </div>
    </header>
  );
}

// ── Mobile panel tab switcher — hidden on lg+ ─────────────────────────────────

const TABS = [
  {
    id:    'input',
    label: 'Input',
    icon:  'M13 10V3L4 14h7v7l9-11h-7z',
  },
  {
    id:    'output',
    label: 'Output',
    icon:  'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1',
  },
];

function MobileTabs({ active, onChange }) {
  return (
    <div className="flex border-b border-gray-800/60 bg-gray-950 lg:hidden"
         role="tablist"
         aria-label="Workspace panels">
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
                        ? 'border-b-2 border-brand-500 text-brand-300 bg-brand-950/20'
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
    <div className="flex min-h-dvh flex-col bg-gray-950">
      <NavBar />

      {/* Sub-header */}
      <div className="border-b border-gray-800/50 bg-gradient-to-b from-gray-900/40
                      to-transparent px-4 py-3 sm:px-5">
        <p className="max-w-2xl text-xs text-gray-500">
          Describe any REST API in plain English — MockFlow AI generates live,
          hittable endpoints in seconds. No sign-up required.
        </p>
      </div>

      {/* Mobile tab bar */}
      <MobileTabs active={activeTab} onChange={setActiveTab} />

      {/* ── Main workspace ──────────────────────────────────────────────── */}
      <main className="flex min-w-0 flex-1 flex-col lg:flex-row">

        {/* LEFT PANEL — Input */}
        <section
          id="panel-input"
          role="tabpanel"
          aria-labelledby="tab-input"
          className={`flex min-w-0 flex-col gap-4 p-4 sm:p-5
                      lg:w-[42%] lg:border-r lg:border-gray-800/50
                      ${activeTab === 'input' ? 'flex' : 'hidden lg:flex'}`}
        >
          <div className="hidden items-center gap-2 lg:flex">
            <span className="h-px flex-1 bg-gray-800" />
            <span className="text-xs font-medium uppercase tracking-widest text-gray-600">
              Input
            </span>
            <span className="h-px flex-1 bg-gray-800" />
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
          className={`flex min-w-0 flex-1 flex-col gap-4 p-4 sm:p-5
                      ${activeTab === 'output' ? 'flex' : 'hidden lg:flex'}`}
        >
          <div className="hidden items-center gap-2 lg:flex">
            <span className="h-px flex-1 bg-gray-800" />
            <span className="text-xs font-medium uppercase tracking-widest text-gray-600">
              Live Output
            </span>
            <span className="h-px flex-1 bg-gray-800" />
          </div>
          <EndpointPreview />
          <RequestRunner />
        </section>
      </main>

      <SavePromptBanner />
    </div>
  );
}
