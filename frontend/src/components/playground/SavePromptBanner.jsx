import { usePlaygroundStore } from '../../store/playgroundStore.js';
import { useAuthStore } from '../../store/authStore.js';

export default function SavePromptBanner() {
  const { endpoints, apiName } = usePlaygroundStore();
  const { isAuthenticated, isSaveSuccess, openAuthModal } = useAuthStore();

  // Hide when no endpoints, already authenticated (and not just now saved), or save success shown in modal
  if (!endpoints.length || (isAuthenticated && !isSaveSuccess)) return null;
  if (isSaveSuccess) return null; // success modal is handling display

  return (
    <div
      className="sticky bottom-0 z-20 flex items-center justify-between gap-4
                 border-t border-gray-800/80 bg-gray-900/95 px-5 py-3
                 backdrop-blur-md"
      role="complementary"
      aria-label="Save your API"
    >
      {/* Left text */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="hidden sm:flex h-7 w-7 shrink-0 items-center justify-center
                        rounded-lg bg-brand-600/20 ring-1 ring-brand-600/40">
          <svg className="h-4 w-4 text-brand-400" fill="none" viewBox="0 0 24 24"
               stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round"
                  d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
          </svg>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-300 truncate">
            {apiName ? (
              <><span className="text-brand-300">{apiName}</span> is ready to save.</>
            ) : (
              'Your mock API is ready to save.'
            )}
          </p>
          <p className="text-xs text-gray-600">
            Free account · instant API key · no credit card
          </p>
        </div>
      </div>

      {/* CTA */}
      <button
        className="btn-primary shrink-0 gap-2"
        onClick={() => openAuthModal('save')}
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24"
             stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round"
                d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
        </svg>
        Save Permanently
      </button>
    </div>
  );
}
