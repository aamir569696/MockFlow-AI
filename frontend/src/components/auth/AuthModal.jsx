import { useState } from 'react';
import { useAuthStore } from '../../store/authStore.js';
import { usePlaygroundStore } from '../../store/playgroundStore.js';
import { useNavigate } from 'react-router-dom';

// ── Save-success screen ───────────────────────────────────────────────────────

function SaveSuccessScreen({ apiKey, endpointCount, onClose }) {
  const [keyCopied, setKeyCopied] = useState(false);

  const copyKey = () => {
    navigator.clipboard.writeText(apiKey).catch(() => {});
    setKeyCopied(true);
    setTimeout(() => setKeyCopied(false), 2000);
  };

  return (
    <div className="flex flex-col items-center gap-5 py-2 animate-slide-up text-center">

      {/* Animated checkmark badge */}
      <div className="relative flex h-16 w-16 items-center justify-center">
        <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-pulse-ring" />
        <div className="flex h-14 w-14 items-center justify-center rounded-full
                        bg-emerald-950 ring-2 ring-emerald-600/60 shadow-lg shadow-emerald-900/50">
          <svg className="h-7 w-7 text-emerald-400" fill="none" viewBox="0 0 24 24"
               stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
      </div>

      {/* Headline */}
      <div className="flex flex-col gap-1">
        <h3 className="text-base font-bold text-white">
          API Endpoint Permanently Saved
        </h3>
        <p className="text-sm text-emerald-400 font-medium">
          to Cloud Sandbox ✦
        </p>
        <p className="mt-1 text-xs text-gray-500">
          {endpointCount} endpoint{endpointCount !== 1 ? 's' : ''} are now persisted
          and accessible via your developer key.
        </p>
      </div>

      {/* API key card */}
      <div className="w-full rounded-xl border border-emerald-800/50
                      bg-emerald-950/30 px-4 py-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-emerald-600">
          Your Developer API Key
        </p>
        <div className="flex items-center justify-between gap-3 rounded-lg
                        border border-emerald-800/40 bg-gray-950/80 px-3 py-2.5">
          <code className="flex-1 font-mono text-base font-bold tracking-widest
                           text-emerald-300 select-all">
            {apiKey}
          </code>
          <button
            onClick={copyKey}
            className={`shrink-0 rounded-md px-2.5 py-1.5 text-xs font-semibold
                        transition-all duration-150
                        ${keyCopied
                          ? 'bg-emerald-800/60 text-emerald-300'
                          : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200'
                        }`}
            aria-label="Copy API key"
          >
            {keyCopied ? '✓ Copied' : 'Copy'}
          </button>
        </div>
        <p className="mt-2 text-xs text-gray-700">
          Keep this key safe — use it to access your saved endpoints from any client.
        </p>
      </div>

      {/* Metadata pills */}
      <div className="flex flex-wrap justify-center gap-2">
        {[
          { label: 'Plan',     value: 'Sandbox Free' },
          { label: 'Region',   value: 'US-East-1' },
          { label: 'Expires',  value: 'Never' },
        ].map(({ label, value }) => (
          <div key={label}
               className="flex items-center gap-1.5 rounded-full border border-gray-800
                          bg-gray-900 px-3 py-1">
            <span className="text-xs text-gray-600">{label}:</span>
            <span className="text-xs font-semibold text-gray-300">{value}</span>
          </div>
        ))}
      </div>

      {/* CTA */}
      <button
        className="btn-primary w-full py-2.5"
        onClick={onClose}
        autoFocus
      >
        Continue to Playground →
      </button>

      <p className="text-xs text-gray-700">
        Your session is now authenticated — endpoints are preserved across refreshes.
      </p>
    </div>
  );
}

// ── AuthModal ─────────────────────────────────────────────────────────────────

export default function AuthModal() {
  const {
    isAuthModalOpen,
    authTrigger,
    isSaveSuccess,
    sandboxApiKey,
    closeAuthModal,
    simulateSave,
    dismissSaveSuccess,
  } = useAuthStore();

  const { endpoints, apiName, apiDescription, sessionId, generatedSchema } = usePlaygroundStore();
  const navigate = useNavigate();
  const [mode, setMode] = useState('login');

  if (!isAuthModalOpen) return null;

  const isSaveTrigger = authTrigger === 'save';

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isSaveTrigger) {
      simulateSave({ apiName, apiDescription, sessionId, endpoints, schema: generatedSchema ?? {} });
    }
    // Non-save triggers: form is a placeholder until Phase 5
  };

  // ── Success screen ────────────────────────────────────────────────────────
  if (isSaveSuccess && sandboxApiKey) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center
                   bg-black/75 backdrop-blur-md"
        role="dialog"
        aria-modal="true"
        aria-label="Save successful"
      >
        <div className="w-full max-w-md rounded-2xl border border-emerald-900/50
                        bg-gray-900 p-6 shadow-2xl shadow-black/60
                        ring-1 ring-emerald-800/20 animate-fade-in">
          <SaveSuccessScreen
            apiKey={sandboxApiKey}
            endpointCount={endpoints.length}
            onClose={() => { dismissSaveSuccess(); navigate('/dashboard'); }}
          />
        </div>
      </div>
    );
  }

  // ── Auth form ─────────────────────────────────────────────────────────────
  const triggerMessages = {
    save:   'Save your endpoints permanently — takes 10 seconds.',
    share:  'Sign in to share your mock API collection.',
    manual: null,
  };
  const contextMessage = triggerMessages[authTrigger] ?? null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center
                 bg-black/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={mode === 'login' ? 'Sign in' : 'Create account'}
      onClick={(e) => { if (e.target === e.currentTarget) closeAuthModal(); }}
    >
      <div className="w-full max-w-sm rounded-xl border border-gray-800
                      bg-gray-900 p-6 shadow-2xl animate-fade-in">

        {/* Header */}
        <div className="mb-5 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg
                              bg-brand-600/20 ring-1 ring-brand-600/40">
                <svg className="h-4 w-4 text-brand-400" fill="none" viewBox="0 0 24 24"
                     stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <h2 className="text-base font-bold text-gray-100">
                {mode === 'login' ? 'Welcome back' : 'Create account'}
              </h2>
            </div>
            {contextMessage && (
              <p className="mt-1.5 text-xs text-brand-400">{contextMessage}</p>
            )}
          </div>
          <button
            className="ml-4 shrink-0 rounded-lg p-1 text-gray-600
                       hover:bg-gray-800 hover:text-gray-400 transition-colors"
            onClick={closeAuthModal}
            aria-label="Close"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24"
                 stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-gray-500">Email</label>
            <input
              className="input"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-gray-500">Password</label>
            <input
              className="input"
              type="password"
              placeholder="••••••••"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
            />
          </div>

          <button
            type="submit"
            className="btn-primary mt-1 py-2.5"
          >
            {isSaveTrigger
              ? (mode === 'login' ? 'Sign in & Save Endpoints' : 'Create Account & Save')
              : (mode === 'login' ? 'Sign in' : 'Create account')
            }
          </button>
        </form>

        {/* Sandbox hint for save trigger */}
        {isSaveTrigger && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-brand-900/50
                          bg-brand-950/30 px-3 py-2">
            <svg className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-400" fill="none"
                 viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-xs text-brand-500">
              Sandbox mode — your endpoints save instantly with a free developer API key.
              No credit card required.
            </p>
          </div>
        )}

        {/* Mode toggle */}
        <p className="mt-4 text-center text-xs text-gray-600">
          {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
          <button
            className="text-brand-400 hover:underline focus:outline-none"
            onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
            type="button"
          >
            {mode === 'login' ? 'Sign up free' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  );
}
