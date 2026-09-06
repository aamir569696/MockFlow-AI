import { useState } from 'react';
import { motion } from 'framer-motion';
import { usePlaygroundStore } from '../../store/playgroundStore.js';

// ── Power-Prompt Quick Action Badges ─────────────────────────────────────────
// Each badge has an emoji category marker, a short display label, and the
// full prompt text that gets injected when the badge is clicked.

const BADGES = [
  {
    emoji:   '🛒',
    label:   'E-Commerce',
    prompt:  'An e-commerce API with products, orders, customers, and reviews',
    gradient: 'from-blue-950/80 to-indigo-950/80',
    border:   'border-blue-800/40',
    glow:     'hover:border-blue-600/60 hover:shadow-blue-900/40',
    text:     'text-blue-300',
  },
  {
    emoji:   '📝',
    label:   'Blog',
    prompt:  'A blog API with posts, authors, tags, and comments',
    gradient: 'from-emerald-950/80 to-teal-950/80',
    border:   'border-emerald-800/40',
    glow:     'hover:border-emerald-600/60 hover:shadow-emerald-900/40',
    text:     'text-emerald-300',
  },
  {
    emoji:   '✅',
    label:   'Tasks',
    prompt:  'A task management API with projects, tasks, assignees, and labels',
    gradient: 'from-amber-950/80 to-orange-950/80',
    border:   'border-amber-800/40',
    glow:     'hover:border-amber-600/60 hover:shadow-amber-900/40',
    text:     'text-amber-300',
  },
  {
    emoji:   '👥',
    label:   'Social',
    prompt:  'A social media API with users, posts, likes, and followers',
    gradient: 'from-pink-950/80 to-rose-950/80',
    border:   'border-pink-800/40',
    glow:     'hover:border-pink-600/60 hover:shadow-pink-900/40',
    text:     'text-pink-300',
  },
  {
    emoji:   '🏨',
    label:   'Booking',
    prompt:  'A hotel booking API with rooms, reservations, guests, and amenities',
    gradient: 'from-purple-950/80 to-violet-950/80',
    border:   'border-purple-800/40',
    glow:     'hover:border-purple-600/60 hover:shadow-purple-900/40',
    text:     'text-purple-300',
  },
];

const MAX_CHARS = 1000;

export default function PromptPanel() {
  const [localPrompt, setLocalPrompt] = useState('');
  const [isPurging,   setIsPurging]   = useState(false);
  const [purgeConfirm, setPurgeConfirm] = useState(false);

  const { isGenerating, generateError, generate, apiName, apiDescription, purgeWorkspace } =
    usePlaygroundStore();

  const charCount  = localPrompt.length;
  const isOverLimit = charCount > MAX_CHARS;
  const canSubmit  = localPrompt.trim().length > 0 && !isGenerating && !isOverLimit;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    await generate(localPrompt.trim());
  };

  return (
    <motion.div
      className="relative flex flex-col gap-4 overflow-hidden rounded-xl
                 border border-gray-800/60 p-4"
      style={{
        backgroundImage: [
          'radial-gradient(circle, rgba(98,114,245,0.05) 1px, transparent 1px)',
          'linear-gradient(120deg, rgba(17,17,27,0.97) 0%, rgba(30,27,75,0.92) 25%, rgba(17,17,27,0.97) 50%, rgba(30,29,82,0.92) 75%, rgba(17,17,27,0.97) 100%)',
        ].join(', '),
        backgroundSize: '20px 20px, 300% 300%',
      }}
      animate={isGenerating ? {
        backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
      } : {
        backgroundPosition: '0% 50%',
      }}
      transition={isGenerating ? {
        backgroundPosition: {
          duration: 4,
          repeat: Infinity,
          ease: 'linear',
        },
      } : {
        backgroundPosition: { duration: 0.6 },
      }}
    >
      {/* Corner accent — top-left */}
      <span className="pointer-events-none absolute left-0 top-0 h-8 w-px
                        bg-gradient-to-b from-brand-500/50 to-transparent" aria-hidden="true" />
      <span className="pointer-events-none absolute left-0 top-0 h-px w-8
                        bg-gradient-to-r from-brand-500/50 to-transparent" aria-hidden="true" />
      {/* Corner accent — bottom-right */}
      <span className="pointer-events-none absolute bottom-0 right-0 h-8 w-px
                        bg-gradient-to-t from-brand-500/50 to-transparent" aria-hidden="true" />
      <span className="pointer-events-none absolute bottom-0 right-0 h-px w-8
                        bg-gradient-to-l from-brand-500/50 to-transparent" aria-hidden="true" />

      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg
                        bg-brand-600/20 ring-1 ring-brand-600/40">
          <svg className="h-4 w-4 text-brand-400" fill="none" viewBox="0 0 24 24"
               stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round"
                  d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <h2 className="text-sm font-semibold text-gray-200">Describe your API</h2>
      </div>

      {/* Success banner */}
      {apiName && !isGenerating && (
        <div className="flex items-start gap-2 rounded-lg border border-emerald-800/50
                        bg-emerald-950/40 px-3 py-2 animate-fade-in">
          <svg className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" fill="none"
               viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          <div>
            <p className="text-xs font-semibold text-emerald-300">{apiName}</p>
            {apiDescription && (
              <p className="mt-0.5 text-xs text-emerald-600">{apiDescription}</p>
            )}
          </div>
        </div>
      )}

      {/* Error banner */}
      {generateError && !isGenerating && (
        <div className="flex items-start gap-2 rounded-lg border border-red-800/50
                        bg-red-950/40 px-3 py-2 animate-fade-in">
          <svg className="mt-0.5 h-4 w-4 shrink-0 text-red-400" fill="none"
               viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round"
                  d="M12 9v2m0 4h.01M12 3a9 9 0 100 18A9 9 0 0012 3z" />
          </svg>
          <p className="text-xs text-red-300">{generateError}</p>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="relative">
          <textarea
            className={`input min-h-[120px] resize-y pr-16 font-sans text-sm leading-relaxed
              ${isOverLimit ? 'border-red-600 focus:border-red-500 focus:ring-red-500/30' : ''}
              ${isGenerating ? 'opacity-60' : ''}`}
            placeholder='e.g. "A REST API for a blog with posts, authors, and comments"'
            value={localPrompt}
            onChange={(e) => setLocalPrompt(e.target.value)}
            disabled={isGenerating}
            aria-label="API description prompt"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit(e);
            }}
          />
          <span
            className={`absolute bottom-2 right-3 font-mono text-xs tabular-nums
              ${isOverLimit ? 'text-red-400' : charCount > MAX_CHARS * 0.8 ? 'text-amber-500' : 'text-gray-600'}`}
          >
            {charCount}/{MAX_CHARS}
          </span>
        </div>

        {/* ── Power-Prompt Quick Action Badges ───────────────────────── */}
        <div className="flex flex-wrap gap-2">
          {BADGES.map((badge) => (
            <button
              key={badge.label}
              type="button"
              disabled={isGenerating}
              onClick={() => setLocalPrompt(badge.prompt)}
              className={`group relative flex items-center gap-1.5 overflow-hidden
                          rounded-full border px-3 py-1
                          bg-gradient-to-r backdrop-blur-sm
                          text-xs font-medium
                          shadow-sm transition-all duration-200
                          hover:-translate-y-px hover:shadow-md
                          active:translate-y-0 active:scale-95
                          focus-visible:outline-none focus-visible:ring-2
                          focus-visible:ring-brand-500
                          disabled:cursor-not-allowed disabled:opacity-40
                          disabled:hover:translate-y-0 disabled:hover:shadow-sm
                          ${badge.gradient} ${badge.border} ${badge.glow} ${badge.text}`}
              title={badge.prompt}
              aria-label={`Quick prompt: ${badge.prompt}`}
            >
              {/* Shimmer overlay on hover */}
              <span
                className="pointer-events-none absolute inset-0 translate-x-[-100%]
                           bg-gradient-to-r from-transparent via-white/5 to-transparent
                           transition-transform duration-500
                           group-hover:translate-x-[100%]"
                aria-hidden="true"
              />
              <span className="shrink-0 text-sm leading-none" aria-hidden="true">
                {badge.emoji}
              </span>
              <span className="relative">{badge.label}</span>
            </button>
          ))}
        </div>

        {/* Submit */}
        <button
          type="submit"
          className="btn-primary relative overflow-hidden self-end"
          disabled={!canSubmit}
          aria-busy={isGenerating}
        >
          {isGenerating ? (
            <>
              <svg className="h-4 w-4 animate-spin-slow" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10"
                        stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor"
                      d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              Generating…
            </>
          ) : (
            <>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24"
                   stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round"
                      d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Generate Mock API
            </>
          )}
        </button>

        <p className="text-center text-xs text-gray-700">
          Press{' '}
          <kbd className="rounded border border-gray-700 bg-gray-800 px-1 py-0.5
                          font-mono text-xs text-gray-500">
            ⌘ Enter
          </kbd>{' '}
          to generate
        </p>
      </form>

      {/* Loading skeleton */}
      {isGenerating && (
        <div className="flex flex-col gap-2 animate-fade-in"
             aria-live="polite" aria-label="Generating API…">
          <div className="skeleton h-3 w-3/4 rounded" />
          <div className="skeleton h-3 w-1/2 rounded" />
          <div className="skeleton h-3 w-5/6 rounded" />
        </div>
      )}

      {/* ── Purge Workspace ──────────────────────────────────────────────── */}
      {/* Separated by a thin divider — clearly a destructive secondary action */}
      <div className="flex items-center gap-2 pt-1">
        <span className="h-px flex-1 bg-gray-800/70" />
        <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-700">
          danger zone
        </span>
        <span className="h-px flex-1 bg-gray-800/70" />
      </div>

      <button
        type="button"
        disabled={isGenerating || isPurging}
        onClick={async () => {
          if (!purgeConfirm) {
            // First click: arm the button — auto-disarm after 3 s
            setPurgeConfirm(true);
            setTimeout(() => setPurgeConfirm(false), 3000);
            return;
          }
          // Second click within 3 s: execute purge
          setPurgeConfirm(false);
          setIsPurging(true);
          setLocalPrompt('');           // clear local textarea too
          try { await purgeWorkspace(); } finally { setIsPurging(false); }
        }}
        className={`group flex w-full items-center justify-center gap-2 rounded-xl
                    border px-4 py-2.5 text-xs font-semibold
                    transition-all duration-200
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500
                    disabled:cursor-not-allowed disabled:opacity-40
                    ${purgeConfirm
                      ? 'border-red-700/70 bg-red-950/50 text-red-300 ring-1 ring-red-700/40 animate-pulse'
                      : 'border-gray-700/60 bg-gray-800/30 text-gray-500 hover:border-red-800/50 hover:bg-red-950/20 hover:text-red-400'
                    }`}
        aria-label={purgeConfirm ? 'Confirm workspace purge' : 'Purge workspace'}
        title={purgeConfirm ? 'Click again to confirm — this cannot be undone' : 'Wipe all state and start with a fresh session UUID'}
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
        ) : purgeConfirm ? (
          <>
            <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24"
                 stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round"
                    d="M12 9v2m0 4h.01M12 3a9 9 0 100 18A9 9 0 0012 3z" />
            </svg>
            Confirm purge? (click again)
          </>
        ) : (
          <>
            <span aria-hidden="true">🧹</span>
            Purge Workspace
          </>
        )}
      </button>
    </motion.div>
  );
}
