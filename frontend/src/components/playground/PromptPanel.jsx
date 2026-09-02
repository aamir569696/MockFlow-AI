import { useState } from 'react';
import { usePlaygroundStore } from '../../store/playgroundStore.js';

const EXAMPLES = [
  'A blog API with posts, authors, tags, and comments',
  'An e-commerce API with products, orders, customers, and reviews',
  'A task management API with projects, tasks, assignees, and labels',
  'A social media API with users, posts, likes, and followers',
  'A hotel booking API with rooms, reservations, guests, and amenities',
];

const MAX_CHARS = 1000;

export default function PromptPanel() {
  const [localPrompt, setLocalPrompt] = useState('');
  const { isGenerating, generateError, generate, apiName, apiDescription } =
    usePlaygroundStore();

  const charCount = localPrompt.length;
  const isOverLimit = charCount > MAX_CHARS;
  const canSubmit = localPrompt.trim().length > 0 && !isGenerating && !isOverLimit;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    await generate(localPrompt.trim());
  };

  const applyExample = (ex) => setLocalPrompt(ex);

  return (
    <div className="card flex flex-col gap-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-600/20 ring-1 ring-brand-600/40">
          <svg className="h-4 w-4 text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <h2 className="text-sm font-semibold text-gray-200">Describe your API</h2>
      </div>

      {/* Success banner */}
      {apiName && !isGenerating && (
        <div className="flex items-start gap-2 rounded-lg border border-emerald-800/50 bg-emerald-950/40 px-3 py-2 animate-fade-in">
          <svg className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
        <div className="flex items-start gap-2 rounded-lg border border-red-800/50 bg-red-950/40 px-3 py-2 animate-fade-in">
          <svg className="mt-0.5 h-4 w-4 shrink-0 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M12 3a9 9 0 100 18A9 9 0 0012 3z" />
          </svg>
          <p className="text-xs text-red-300">{generateError}</p>
        </div>
      )}

      {/* Textarea */}
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
          {/* Char counter */}
          <span
            className={`absolute bottom-2 right-3 font-mono text-xs tabular-nums
              ${isOverLimit ? 'text-red-400' : charCount > MAX_CHARS * 0.8 ? 'text-amber-500' : 'text-gray-600'}`}
          >
            {charCount}/{MAX_CHARS}
          </span>
        </div>

        {/* Examples */}
        <div className="flex flex-wrap gap-1.5">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              disabled={isGenerating}
              onClick={() => applyExample(ex)}
              className="rounded-full border border-gray-700 bg-gray-800/60 px-2.5 py-0.5
                         text-xs text-gray-400 transition-all duration-100
                         hover:border-brand-700 hover:bg-brand-950/60 hover:text-brand-300
                         disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {ex.split(' ').slice(1, 4).join(' ')}…
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
              <svg
                className="h-4 w-4 animate-spin-slow"
                fill="none" viewBox="0 0 24 24"
              >
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              Generating…
            </>
          ) : (
            <>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Generate Mock API
            </>
          )}
        </button>

        <p className="text-center text-xs text-gray-700">
          Press <kbd className="rounded border border-gray-700 bg-gray-800 px-1 py-0.5 font-mono text-xs text-gray-500">⌘ Enter</kbd> to generate
        </p>
      </form>

      {/* Loading skeleton */}
      {isGenerating && (
        <div className="flex flex-col gap-2 animate-fade-in" aria-live="polite" aria-label="Generating API…">
          <div className="skeleton h-3 w-3/4 rounded" />
          <div className="skeleton h-3 w-1/2 rounded" />
          <div className="skeleton h-3 w-5/6 rounded" />
        </div>
      )}
    </div>
  );
}
