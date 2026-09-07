import { useState } from 'react';
import { usePlaygroundStore } from '../../store/playgroundStore.js';

const EXAMPLES = [
  'add a discount field to products',
  'make phone number required',
  'add a reviews resource',
];

/**
 * ModifySchemaBar — conversational, plain-English schema editing.
 *
 * The user types an instruction ("add a discount field to products"); it's sent
 * to the AI, which returns an updated schema/endpoint definition applied to the
 * store. Shows loading, a confirmation summary of what changed, a single-step
 * undo, and a clear error for ambiguous instructions (never corrupts state).
 */
export default function ModifySchemaBar() {
  const [instruction, setInstruction] = useState('');

  const generatedSchema  = usePlaygroundStore((s) => s.generatedSchema);
  const isEditingSchema  = usePlaygroundStore((s) => s.isEditingSchema);
  const editError        = usePlaygroundStore((s) => s.editError);
  const lastEditSummary  = usePlaygroundStore((s) => s.lastEditSummary);
  const schemaSnapshot   = usePlaygroundStore((s) => s.schemaSnapshot);
  const editSchema       = usePlaygroundStore((s) => s.editSchema);
  const undoSchemaEdit   = usePlaygroundStore((s) => s.undoSchemaEdit);
  const clearEditFeedback= usePlaygroundStore((s) => s.clearEditFeedback);

  // Nothing to edit until an API exists.
  if (!generatedSchema) return null;

  const canSubmit = instruction.trim().length > 0 && !isEditingSchema;

  const submit = async (e) => {
    e?.preventDefault?.();
    if (!canSubmit) return;
    const res = await editSchema(instruction);
    if (res?.ok) setInstruction('');   // keep text on error so the user can tweak it
  };

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-indigo-900/30
                    bg-indigo-950/10 p-3">
      {/* Label */}
      <div className="flex items-center gap-2">
        <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md
                        bg-indigo-600/20 ring-1 ring-indigo-600/40">
          <svg className="h-3 w-3 text-indigo-400" fill="none" viewBox="0 0 24 24"
               stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round"
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </div>
        <span className="text-xs font-semibold text-gray-300">Modify your API</span>
        <span className="ml-auto text-[10px] text-gray-700">plain English · AI-powered</span>
      </div>

      {/* Input row */}
      <form onSubmit={submit} className="flex items-center gap-2">
        <input
          type="text"
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          disabled={isEditingSchema}
          placeholder='e.g. "add a discount field to products"'
          aria-label="Schema modification instruction"
          className="input flex-1 py-2 text-xs disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={!canSubmit}
          aria-busy={isEditingSchema}
          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2
                     text-xs font-bold text-white transition-colors hover:bg-indigo-500
                     focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400
                     disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isEditingSchema ? (
            <>
              <svg className="h-3.5 w-3.5 animate-spin-slow" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              Updating…
            </>
          ) : (
            <>
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24"
                   stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Apply
            </>
          )}
        </button>
      </form>

      {/* Example chips (only before first edit, to guide the user) */}
      {!isEditingSchema && !lastEditSummary && !editError && (
        <div className="flex flex-wrap gap-1.5">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => setInstruction(ex)}
              className="rounded-full border border-gray-800 bg-gray-900/50 px-2.5 py-0.5
                         text-[10px] text-gray-500 transition-colors
                         hover:border-indigo-800/50 hover:text-indigo-400"
            >
              {ex}
            </button>
          ))}
        </div>
      )}

      {/* Loading hint */}
      {isEditingSchema && (
        <p className="text-[11px] text-indigo-400/80 animate-fade-in">
          Updating schema — applying your change and re-syncing endpoints…
        </p>
      )}

      {/* Confirmation summary + undo */}
      {lastEditSummary && !isEditingSchema && (
        <div className="flex items-start gap-2 rounded-lg border border-emerald-900/40
                        bg-emerald-950/20 px-3 py-2 animate-fade-in">
          <svg className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" fill="none"
               viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-emerald-300">✅ {lastEditSummary.summary}</p>
            {lastEditSummary.affectedEndpoints?.length > 0 && (
              <p className="mt-0.5 text-[10px] text-emerald-600/90">
                Affects {lastEditSummary.affectedEndpoints.length} endpoint
                {lastEditSummary.affectedEndpoints.length !== 1 ? 's' : ''}:{' '}
                <span className="font-mono">{lastEditSummary.affectedEndpoints.join(', ')}</span>
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {schemaSnapshot && (
              <button
                type="button"
                onClick={undoSchemaEdit}
                className="rounded-md border border-gray-700 bg-gray-900/60 px-2 py-1
                           text-[10px] font-semibold text-gray-400 transition-colors
                           hover:border-amber-700/50 hover:text-amber-300"
                title="Revert this change"
              >
                ↩ Undo
              </button>
            )}
            <button
              type="button"
              onClick={clearEditFeedback}
              className="rounded-md p-1 text-gray-600 transition-colors hover:text-gray-400"
              aria-label="Dismiss"
              title="Dismiss"
            >
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Error — ambiguous / failed instruction */}
      {editError && !isEditingSchema && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-900/50
                        bg-amber-950/20 px-3 py-2 animate-fade-in">
          <svg className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" fill="none"
               viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round"
                  d="M12 9v2m0 4h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L14.7 3.9a2 2 0 00-3.4 0z" />
          </svg>
          <p className="min-w-0 flex-1 text-xs text-amber-300/90">{editError}</p>
          <button
            type="button"
            onClick={clearEditFeedback}
            className="shrink-0 rounded-md p-1 text-gray-600 transition-colors hover:text-gray-400"
            aria-label="Dismiss error"
          >
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
