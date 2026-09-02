import { Link } from 'react-router-dom';
import PromptPanel from '../components/playground/PromptPanel.jsx';
import EndpointPreview from '../components/playground/EndpointPreview.jsx';
import SchemaEditor from '../components/playground/SchemaEditor.jsx';
import RequestRunner from '../components/playground/RequestRunner.jsx';
import SavePromptBanner from '../components/playground/SavePromptBanner.jsx';
import ExportDropdown from '../components/playground/ExportDropdown.jsx';
import { usePlaygroundStore } from '../store/playgroundStore.js';
import { useAuthStore } from '../store/authStore.js';

function NavBar() {
  const { endpoints, sessionId } = usePlaygroundStore();
  const { isAuthenticated, openAuthModal } = useAuthStore();

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between
                       border-b border-gray-800/80 bg-gray-950/90
                       backdrop-blur-md px-5 py-3">
      {/* Logo */}
      <Link to="/" className="flex items-center gap-2 group">
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
          <span className="ml-1 text-gray-600 font-normal">AI</span>
        </span>
      </Link>

      {/* Centre — session pill */}
      {sessionId && (
        <div className="hidden sm:flex items-center gap-1.5 rounded-full
                        border border-gray-800 bg-gray-900 px-3 py-1">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-mono text-xs text-gray-500 tracking-tight">
            session&nbsp;
            <span className="text-gray-400">{sessionId.slice(0, 8)}…</span>
          </span>
        </div>
      )}

      {/* Right actions */}
      <div className="flex items-center gap-2">
        {endpoints.length > 0 && (
          <>
            <span className="hidden sm:inline-flex items-center gap-1 rounded-full
                             bg-brand-950/60 px-2.5 py-1 text-xs font-semibold
                             text-brand-300 ring-1 ring-brand-800/50">
              {endpoints.length} endpoint{endpoints.length !== 1 ? 's' : ''} live
            </span>
            <ExportDropdown />
          </>
        )}
        {!isAuthenticated ? (
          <button
            className="btn-ghost py-1.5 px-3 text-xs"
            onClick={() => openAuthModal('manual')}
          >
            Sign in
          </button>
        ) : (
          <Link to="/dashboard" className="btn-ghost py-1.5 px-3 text-xs">
            Dashboard
          </Link>
        )}
      </div>
    </header>
  );
}

export default function PlaygroundPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-gray-950">
      <NavBar />

      {/* ── Hero sub-header ──────────────────────────────────────────────── */}
      <div className="border-b border-gray-800/50 bg-gradient-to-b from-gray-900/40 to-transparent px-5 py-4">
        <p className="text-xs text-gray-500 max-w-2xl">
          Describe any REST API in plain English — MockFlow AI generates live, hittable
          endpoints in seconds. No sign-up required.
        </p>
      </div>

      {/* ── Main two-column workspace ────────────────────────────────────── */}
      <main className="flex flex-1 flex-col gap-0 lg:flex-row">

        {/* ── LEFT PANEL — input surface ──────────────────────────────────── */}
        <div className="flex flex-col gap-4 border-b border-gray-800/50
                        p-4 lg:w-[42%] lg:border-b-0 lg:border-r lg:p-5">

          {/* Panel label */}
          <div className="flex items-center gap-2">
            <span className="h-px flex-1 bg-gray-800" />
            <span className="text-xs font-medium tracking-widest text-gray-600 uppercase">
              Input
            </span>
            <span className="h-px flex-1 bg-gray-800" />
          </div>

          <PromptPanel />
          <SchemaEditor />
        </div>

        {/* ── RIGHT PANEL — live output ───────────────────────────────────── */}
        <div className="flex flex-1 flex-col gap-4 p-4 lg:p-5">

          {/* Panel label */}
          <div className="flex items-center gap-2">
            <span className="h-px flex-1 bg-gray-800" />
            <span className="text-xs font-medium tracking-widest text-gray-600 uppercase">
              Live Output
            </span>
            <span className="h-px flex-1 bg-gray-800" />
          </div>

          <EndpointPreview />
          <RequestRunner />
        </div>
      </main>

      {/* ── Sticky save CTA ─────────────────────────────────────────────── */}
      <SavePromptBanner />
    </div>
  );
}
