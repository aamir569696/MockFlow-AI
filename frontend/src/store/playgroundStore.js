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
            method: endpoint?.method ?? 'GET',
            url:    endpoint ? `/mock/${state.sessionId}/${endpoint.slug}` : '',
            body:   '',
          },
        })),

      setRunnerMethod: (method) =>
        set((state) => ({ runner: { ...state.runner, method } })),

      setRunnerBody: (body) =>
        set((state) => ({ runner: { ...state.runner, body } })),

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
        set({ isGenerating: true, generateError: null, endpoints: [], generatedSchema: null, apiName: '', apiDescription: '' });
        try {
          const data = await mockService.generateMock(prompt);

          if (data.sessionId) {
            mockService.setSessionId(data.sessionId);
            set({ sessionId: data.sessionId });
          }

          set({
            apiName:         data.apiName    ?? '',
            apiDescription:  data.description ?? '',
            generatedSchema: data.schema      ?? null,
            endpoints:       data.endpoints   ?? [],
            activeEndpoint:  null,
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
            { body: parsedBody },
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
