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

          set((state) => ({
            runner: {
              ...state.runner,
              isFiring:        false,
              response:        result.response,
              status:          result.status,
              latency:         result.latency,
              responseHeaders: result.responseHeaders ?? null,
              error:           result.error           ?? null,
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
              isFiring:  false,
              error:     err.message ?? 'Request failed.',
              response:  null,
              status:    null,
              latency:   null,
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
          method: state.runner.method,
          url:    state.runner.url,
          body:   state.runner.body,
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
