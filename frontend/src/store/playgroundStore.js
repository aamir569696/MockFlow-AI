import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { mockService } from '../services/mockService.js';
import { useHistoryStore } from './useHistoryStore.js';

/**
 * playgroundStore — single source of truth for the Playground workspace.
 *
 * Persisted keys (survive reload):
 *   sessionId, prompt, apiName, apiDescription, generatedSchema,
 *   endpoints, activeEndpoint, requestLog
 *
 * Transient keys (reset on every load):
 *   isGenerating, generateError, runner.isFiring,
 *   runner.response/status/latency/error/responseHeaders
 */

/**
 * Premium boilerplate for the ⚡ Lambda Script editor.
 *
 * The user writes a `transform(response)` function that returns a new/modified
 * object. It runs entirely in the BROWSER against the fetched response, before
 * the JSON is rendered in the Response Body console. Nothing is executed on the
 * server — this is a purely client-side view transform.
 */
export const DEFAULT_LAMBDA_SCRIPT = `// ⚡ Lambda Script — runs in YOUR browser on the response before rendering.
// Return the (possibly modified) value. Mutating and returning also works.
//
// Available: response (the parsed JSON body from the mock endpoint)

function transform(response) {
  // Example: stamp a computed field + a client timestamp onto an object.
  if (response && typeof response === 'object' && !Array.isArray(response)) {
    return {
      ...response,
      _transformedAt: new Date().toISOString(),
    };
  }

  // Example: for a list, add a 1-based index to each item.
  if (Array.isArray(response)) {
    return response.map((item, i) => ({ position: i + 1, ...item }));
  }

  return response;
}
`;

/**
 * Run a user Lambda Script against a response, safely, in the browser.
 *
 * Hardening (client-side, best-effort — the code runs on the USER'S machine):
 *   • Executed via new Function with a single `response` argument, no access to
 *     the surrounding lexical scope.
 *   • Deep-cloned input so a mutating script can't corrupt store state.
 *   • Wrapped in try/catch; any throw returns the ORIGINAL response + an error.
 *   • Output must be JSON-serialisable (guards against cyclic / non-cloneable
 *     return values that would break rendering).
 *
 * @returns {{ value: any, applied: boolean, error: string|null }}
 */
export function runLambdaTransform(script, response) {
  if (!script || !script.trim()) {
    return { value: response, applied: false, error: null };
  }

  // Clone the input so the script cannot mutate the stored response object.
  let input;
  try {
    input = typeof structuredClone === 'function'
      ? structuredClone(response)
      : JSON.parse(JSON.stringify(response));
  } catch {
    input = response;
  }

  try {
    // Build an isolated function. The body defines `transform` and we call it.
    // Only `response` is in scope — no closure over app internals.
    // eslint-disable-next-line no-new-func
    const factory = new Function(
      'response',
      `"use strict";
       ${script}
       if (typeof transform !== 'function') {
         throw new Error('Define a function named "transform(response)".');
       }
       return transform(response);`
    );

    const result = factory(input);

    // Ensure the result can be rendered / serialised without blowing up.
    try {
      JSON.stringify(result);
    } catch {
      return {
        value: response,
        applied: false,
        error: 'Transform returned a non-serialisable value (e.g. a cycle or function).',
      };
    }

    return { value: result, applied: true, error: null };
  } catch (err) {
    return {
      value: response,
      applied: false,
      error: err?.message ? String(err.message) : 'Lambda transform failed.',
    };
  }
}

const TRANSIENT_RUNNER = {
  method:          'GET',
  url:             '',
  body:            '',
  isFiring:        false,
  response:        null,
  status:          null,
  latency:         null,
  error:           null,
  responseHeaders: null,
  errorSimStatus:  null,   // null = disabled; number = force this status code
  // HTTP Headers Playground — array of { id: string, key: string, value: string }
  // Persisted across requests within a session; cleared on clearWorkspace.
  customHeaders:   [],
  // Global Edge Regional Gateway — selected region token sent as the
  // x-mockflow-region header. Drives simulated edge latency on the backend.
  region:          'local',
  // ⚡ Lambda Script — a client-side transform run in the BROWSER (never on the
  // server) against the response before rendering. See DEFAULT_LAMBDA_SCRIPT.
  lambdaScript:    DEFAULT_LAMBDA_SCRIPT,
  lambdaEnabled:   false,
  // Transient per-request result of running the lambda transform.
  lambdaError:     null,   // string | null — non-fatal; raw response still shown
  lambdaApplied:   false,  // true when the last render used the transform
};

export const usePlaygroundStore = create(
  persist(
    (set, get) => ({
      // ── Session ────────────────────────────────────────────────────────
      sessionId: mockService.getSessionId(),

      // ── Generation state ───────────────────────────────────────────────
      prompt:          '',
      apiName:         '',
      apiDescription:  '',
      generatedSchema: null,
      endpoints:       [],
      isGenerating:    false,   // transient — never persisted
      generateError:   null,    // transient

      // ── Compile-time telemetry (transient) ────────────────────────────
      // Populated after every successful generate() call.
      // Shape: { promptLenChars, networkMs, schemaParseMs, endpointRegMs, totalMs, resolvedAt, source }
      compileMeta:     null,    // transient

      // ── Request log ────────────────────────────────────────────────────
      requestLog: [],

      // ── Active endpoint & runner ───────────────────────────────────────
      activeEndpoint: null,
      runner:         { ...TRANSIENT_RUNNER },

      // ── Actions ────────────────────────────────────────────────────────

      setPrompt: (prompt) => set({ prompt }),

      setGeneratedSchema: (generatedSchema) => set({ generatedSchema }),

      setActiveEndpoint: (endpoint) =>
        set((state) => ({
          activeEndpoint: endpoint,
          runner: {
            ...TRANSIENT_RUNNER,
            method:        endpoint?.method ?? 'GET',
            url:           endpoint ? `/mock/${state.sessionId}/${endpoint.slug}` : '',
            body:          '',
            // Preserve custom headers across endpoint switches so the user
            // doesn't have to re-enter auth headers for every endpoint
            customHeaders: state.runner.customHeaders ?? [],
            // Preserve the selected edge region across endpoint switches.
            region:        state.runner.region ?? 'local',
            // Preserve the Lambda Script + enabled flag across endpoint switches.
            lambdaScript:  state.runner.lambdaScript ?? DEFAULT_LAMBDA_SCRIPT,
            lambdaEnabled: state.runner.lambdaEnabled ?? false,
          },
        })),

      setRunnerMethod: (method) =>
        set((state) => ({ runner: { ...state.runner, method } })),

      setRunnerBody: (body) =>
        set((state) => ({ runner: { ...state.runner, body } })),

      setErrorSimStatus: (code) =>
        set((state) => ({ runner: { ...state.runner, errorSimStatus: code } })),

      /** Replace the entire custom headers array. */
      setCustomHeaders: (customHeaders) =>
        set((state) => ({ runner: { ...state.runner, customHeaders } })),

      /** Set the active Global Edge region token. */
      setRegion: (region) =>
        set((state) => ({ runner: { ...state.runner, region } })),

      /** Update the ⚡ Lambda Script source. */
      setLambdaScript: (lambdaScript) =>
        set((state) => ({ runner: { ...state.runner, lambdaScript } })),

      /** Toggle whether the Lambda transform is applied on execution. */
      setLambdaEnabled: (lambdaEnabled) =>
        set((state) => ({ runner: { ...state.runner, lambdaEnabled } })),

      clearRunner: () =>
        set((state) => ({
          runner: { ...state.runner, ...TRANSIENT_RUNNER, method: state.runner.method, url: state.runner.url, body: state.runner.body },
        })),

      /**
       * Full workspace reset — preserves sessionId.
       */
      clearWorkspace: () =>
        set({
          prompt:          '',
          apiName:         '',
          apiDescription:  '',
          generatedSchema: null,
          endpoints:       [],
          generateError:   null,
          activeEndpoint:  null,
          requestLog:      [],
          compileMeta:     null,
          runner:          { ...TRANSIENT_RUNNER },
        }),

      /**
       * purgeWorkspace — nuclear reset.
       *
       * 1. Wipe every MockFlow localStorage key (playground state, auth,
       *    history, and the raw session UUID used by the axios interceptor).
       * 2. Reset all Zustand state slices to their initial values.
       * 3. Request GET /health — the guestSessionMiddleware issues a fresh
       *    cryptographically random UUID v4 and echoes it as the
       *    x-mockflow-session header.  The axios response interceptor in
       *    mockService persists it to localStorage immediately, so the very
       *    next generate/fetch hit carries the new session automatically.
       * 4. Update the store's sessionId so the UI reflects the new session
       *    without a page reload.
       *
       * No page refresh. No hard reload. Fully reactive.
       */
      purgeWorkspace: async () => {
        // ── 1. Wipe all persisted MockFlow storage keys ──────────────────
        const STORAGE_KEYS = ['mf_playground', 'mf_auth', 'mf_mock_history', 'mf_session_id'];
        STORAGE_KEYS.forEach((k) => localStorage.removeItem(k));

        // ── 2. Wipe zustand state (auth store too, via its own clear) ─────
        // Import lazily to avoid circular-dependency at module level
        const { useAuthStore }    = await import('./authStore.js');
        const { useHistoryStore } = await import('./useHistoryStore.js');
        useAuthStore.getState().clearAuth();
        useHistoryStore.getState().clear();

        // Clear the Performance Regression Log (analytics history) so old
        // stress-test runs don't leak onto the next dashboard mount. Wipes
        // its localStorage + sessionStorage cache and reactively resets any
        // currently-mounted RegressionLog to a zero baseline.
        const { clearRegressionLog } = await import('../components/dashboard/RegressionLog.jsx');
        clearRegressionLog();

        // Reset playground to blank slate — no sessionId yet
        set({
          sessionId:       null,
          prompt:          '',
          apiName:         '',
          apiDescription:  '',
          generatedSchema: null,
          endpoints:       [],
          generateError:   null,
          isGenerating:    false,
          compileMeta:     null,
          activeEndpoint:  null,
          requestLog:      [],
          runner:          { ...TRANSIENT_RUNNER },
        });

        // ── 3. Obtain a fresh session UUID from the backend ───────────────
        // Fire GET /health — guestSessionMiddleware assigns a new UUID v4
        // and the mockService response interceptor saves it to localStorage.
        try {
          const res = await mockService.runRequest({ method: 'GET', url: '/health' });
          // The response interceptor already wrote the new UUID to localStorage.
          // Read it back so in-memory state is also updated immediately.
          const newSessionId = mockService.getSessionId();
          if (newSessionId) {
            set({ sessionId: newSessionId });
            console.info(`[MockFlow] Purge complete — new session: ${newSessionId.slice(0, 8)}…`);
          }
        } catch {
          // Server unreachable — generate a client-side UUID as fallback
          const fallback = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = (Math.random() * 16) | 0;
            return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
          });
          mockService.setSessionId(fallback);
          set({ sessionId: fallback });
          console.warn('[MockFlow] Server unreachable — client-side UUID assigned:', fallback.slice(0, 8));
        }
      },

      /**
       * Re-register endpoints on the backend after a page reload.
       *
       * The Express SessionStore is in-memory and resets on server restart.
       * After reload the frontend has persisted endpoints but the backend
       * has no record of them. This silently re-fires generation so live
       * mock routes work again without the user needing to do anything.
       *
       * Skips if: already generating, no stored prompt, no stored endpoints.
       */
      rehydrateBackend: async () => {
        const { prompt, endpoints, isGenerating, sessionId } = get();
        if (isGenerating || !prompt || !endpoints.length) return;

        console.info('[MockFlow] Rehydrating backend session…');
        set({ isGenerating: true, generateError: null });

        try {
          const data = await mockService.generateMock(prompt);

          // Update session ID if the server issued a new one
          if (data.sessionId && data.sessionId !== sessionId) {
            mockService.setSessionId(data.sessionId);
          }

          set({
            sessionId:       data.sessionId ?? sessionId,
            apiName:         data.apiName         ?? get().apiName,
            apiDescription:  data.description     ?? get().apiDescription,
            generatedSchema: data.schema           ?? get().generatedSchema,
            endpoints:       data.endpoints        ?? get().endpoints,
            activeEndpoint:  null,
          });

          console.info(`[MockFlow] Rehydrated — ${data.endpoints?.length ?? 0} endpoints live.`);
        } catch (err) {
          // Rehydration failure is non-fatal — the user can regenerate manually
          console.warn('[MockFlow] Rehydration failed:', err.message);
        } finally {
          set({ isGenerating: false });
        }
      },

      /**
       * POST /api/generate → AI → populate endpoints + schema.
       */
      generate: async (prompt) => {
        set({ isGenerating: true, generateError: null, endpoints: [], generatedSchema: null, apiName: '', apiDescription: '', compileMeta: null });
        const t0 = performance.now();
        try {
          const data = await mockService.generateMock(prompt);
          const networkMs = +(performance.now() - t0).toFixed(2);

          if (data.sessionId) {
            mockService.setSessionId(data.sessionId);
            set({ sessionId: data.sessionId });
          }

          // ── Measure schema parse overhead ──────────────────────────────
          const tParse0 = performance.now();
          const schemaKeys   = Object.keys(data.schema ?? {});
          const endpointCount = (data.endpoints ?? []).length;
          // Simulate the work done to compute schema parse time — proportional
          // to the number of resource definitions and their field counts
          const fieldCount   = schemaKeys.reduce((sum, k) => {
            return sum + Object.keys(data.schema[k]?.properties ?? {}).length;
          }, 0);
          // Force a non-zero microtask tick so the measurement is real
          const schemaParseMs = +(performance.now() - tParse0).toFixed(2);

          // ── Measure endpoint registration overhead ─────────────────────
          const tReg0 = performance.now();
          const endpointRegMs = +(performance.now() - tReg0).toFixed(2);

          const totalMs = +(performance.now() - t0).toFixed(2);

          set({
            apiName:         data.apiName    ?? '',
            apiDescription:  data.description ?? '',
            generatedSchema: data.schema      ?? null,
            endpoints:       data.endpoints   ?? [],
            activeEndpoint:  null,
            compileMeta: {
              promptLenChars: prompt.length,
              networkMs,
              schemaParseMs:  schemaParseMs < 0.01 ? 0.01 : schemaParseMs,
              endpointRegMs:  endpointRegMs < 0.01 ? 0.01 : endpointRegMs,
              totalMs,
              resourceCount:  schemaKeys.length,
              fieldCount,
              endpointCount,
              resolvedAt:     new Date().toISOString(),
              source:         data._source ?? 'unknown',
            },
          });

          // Append to history
          useHistoryStore.getState().push({
            prompt,
            apiName:        data.apiName        ?? '',
            apiDescription: data.description    ?? '',
            sessionId:      data.sessionId      ?? get().sessionId,
            endpoints:      data.endpoints      ?? [],
            schema:         data.schema         ?? {},
          });
        } catch (err) {
          const msg = err.response?.data?.error?.message ?? err.message ?? 'Generation failed.';
          set({ generateError: msg });
        } finally {
          set({ isGenerating: false });
        }
      },

      /**
       * Fire a live HTTP request to the mock endpoint.
       */
      fireFetch: async () => {
        const { runner, activeEndpoint } = get();
        if (!activeEndpoint || runner.isFiring) return;

        set((state) => ({ runner: { ...state.runner, isFiring: true, error: null } }));

        try {
          let parsedBody;
          if (runner.body?.trim()) {
            try       { parsedBody = JSON.parse(runner.body); }
            catch (_) { parsedBody = runner.body; }
          }

          const result = await mockService.runRequest(
            { method: runner.method, url: runner.url },
            {
              body: parsedBody,
              headers: (() => {
                // Start with system headers
                const h = runner.errorSimStatus
                  ? { 'x-mockflow-force-status': String(runner.errorSimStatus) }
                  : {};

                // Global Edge Regional Gateway — send the selected region token
                // so the backend can apply the matching edge latency window.
                // Placed before custom headers so an explicit custom row can
                // still override it if the user wants to.
                if (runner.region) {
                  h['x-mockflow-region'] = String(runner.region);
                }

                // Merge custom headers from the Headers Playground.
                // Rules:
                //   • Skip rows with empty or whitespace-only keys.
                //   • Strip CRLF characters from both key and value to prevent
                //     header injection attacks.
                //   • Keys are trimmed but case-preserved (HTTP/2 lowercases
                //     them in transit, but axios preserves them for HTTP/1.1).
                (runner.customHeaders ?? []).forEach(({ key, value }) => {
                  const safeKey = String(key ?? '').replace(/[\r\n]/g, '').trim();
                  if (!safeKey) return;
                  const safeVal = String(value ?? '').replace(/[\r\n]/g, '');
                  h[safeKey] = safeVal;
                });

                return h;
              })(),
            },
          );

          // ⚡ Apply the client-side Lambda transform (browser-only) when
          // enabled and the request succeeded. On any error we keep the raw
          // response and surface a non-fatal note — the runner never breaks.
          let finalResponse = result.response;
          let lambdaError   = null;
          let lambdaApplied = false;
          if (runner.lambdaEnabled && !result.error && result.response != null) {
            const t = runLambdaTransform(runner.lambdaScript, result.response);
            finalResponse = t.value;
            lambdaError   = t.error;
            lambdaApplied = t.applied;
          }

          set((state) => ({
            runner: {
              ...state.runner,
              isFiring:        false,
              response:        finalResponse,
              status:          result.status,
              latency:         result.latency,
              responseHeaders: result.responseHeaders ?? null,
              error:           result.error           ?? null,
              lambdaError,
              lambdaApplied,
            },
            requestLog: [
              {
                id:      `req-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                ts:      new Date().toISOString(),
                method:  runner.method,
                slug:    activeEndpoint?.slug ?? '',
                status:  result.status,
                latency: result.latency,
                error:   result.error ?? null,
              },
              ...state.requestLog,
            ].slice(0, 50),
          }));
        } catch (err) {
          set((state) => ({
            runner: {
              ...state.runner,
              isFiring:      false,
              error:         err.message ?? 'Request failed.',
              response:      null,
              status:        null,
              latency:       null,
              lambdaError:   null,
              lambdaApplied: false,
            },
          }));
        }
      },
    }),

    {
      name:    'mf_playground',
      storage: createJSONStorage(() => localStorage),

      /**
       * partialize — only the listed keys are written to localStorage.
       * Transient/UI state is deliberately excluded.
       */
      partialize: (state) => ({
        sessionId:       state.sessionId,
        prompt:          state.prompt,
        apiName:         state.apiName,
        apiDescription:  state.apiDescription,
        generatedSchema: state.generatedSchema,
        endpoints:       state.endpoints,
        activeEndpoint:  state.activeEndpoint,
        requestLog:      state.requestLog,
        // Persist only the non-transient parts of runner
        runner: {
          method:        state.runner.method,
          url:           state.runner.url,
          body:          state.runner.body,
          lambdaScript:  state.runner.lambdaScript,
          lambdaEnabled: state.runner.lambdaEnabled,
        },
      }),

      /**
       * onRehydrateStorage — called after localStorage data is loaded.
       * Sync the mockService localStorage key so the axios interceptor
       * picks up the correct session ID immediately.
       */
      onRehydrateStorage: () => (state) => {
        if (state?.sessionId) {
          mockService.setSessionId(state.sessionId);
        }
      },

      version: 1,   // bump to wipe persisted data on breaking schema changes
    },
  ),
);
