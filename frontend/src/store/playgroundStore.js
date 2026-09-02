import { create } from 'zustand';
import { mockService } from '../services/mockService.js';

/**
 * playgroundStore — single source of truth for the Playground workspace.
 */
export const usePlaygroundStore = create((set, get) => ({
  // ── Session ──────────────────────────────────────────────────────────────
  sessionId: mockService.getSessionId(),

  // ── Generation state ─────────────────────────────────────────────────────
  prompt: '',
  apiName: '',
  apiDescription: '',
  generatedSchema: null,
  endpoints: [],
  isGenerating: false,
  generateError: null,

  // ── Request log — every fireFetch appends an entry ───────────────────────
  // Shape: [{ id, ts, method, slug, status, latency, error }]
  requestLog: [],

  // ── Active endpoint & runner ─────────────────────────────────────────────
  activeEndpoint: null,
  runner: {
    method: 'GET',
    url: '',
    body: '',
    isFiring: false,
    response: null,
    status: null,
    latency: null,
    error: null,
    responseHeaders: null,
  },

  // ── Actions ───────────────────────────────────────────────────────────────

  setPrompt: (prompt) => set({ prompt }),

  setGeneratedSchema: (generatedSchema) => set({ generatedSchema }),

  setActiveEndpoint: (endpoint) =>
    set((state) => ({
      activeEndpoint: endpoint,
      runner: {
        ...state.runner,
        method: endpoint?.method ?? 'GET',
        // Strip the /api prefix — axios baseURL already provides it,
        // so the stored URL must be relative to /api (i.e. /mock/...)
        url: endpoint ? `/mock/${state.sessionId}/${endpoint.slug}` : '',
        body: '',
        response: null,
        status: null,
        latency: null,
        error: null,
        responseHeaders: null,
      },
    })),

  setRunnerMethod: (method) =>
    set((state) => ({ runner: { ...state.runner, method } })),

  setRunnerBody: (body) =>
    set((state) => ({ runner: { ...state.runner, body } })),

  clearRunner: () =>
    set((state) => ({
      runner: {
        ...state.runner,
        response: null,
        status: null,
        latency: null,
        error: null,
        responseHeaders: null,
      },
    })),

  /**
   * POST /api/generate → Gemini AI → populate endpoints + schema.
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
        apiName: data.apiName ?? '',
        apiDescription: data.description ?? '',
        generatedSchema: data.schema ?? null,
        endpoints: data.endpoints ?? [],
        activeEndpoint: null,
      });
    } catch (err) {
      const msg = err.response?.data?.error?.message ?? err.message ?? 'Generation failed.';
      set({ generateError: msg });
    } finally {
      set({ isGenerating: false });
    }
  },

  /**
   * Fire a live HTTP request to the mock endpoint via the Vite proxy.
   */
  fireFetch: async () => {
    const { runner, activeEndpoint } = get();
    if (!activeEndpoint || runner.isFiring) return;

    set((state) => ({ runner: { ...state.runner, isFiring: true, error: null } }));

    try {
      let parsedBody;
      if (runner.body?.trim()) {
        try { parsedBody = JSON.parse(runner.body); }
        catch { parsedBody = runner.body; }
      }

      const result = await mockService.runRequest(
        { method: runner.method, url: runner.url },
        { body: parsedBody }
      );

      set((state) => ({
        runner: {
          ...state.runner,
          isFiring: false,
          response: result.response,
          status: result.status,
          latency: result.latency,
          responseHeaders: result.responseHeaders ?? null,
          error: result.error ?? null,
        },
        // Append to request log
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
        ].slice(0, 50), // keep last 50
      }));
    } catch (err) {
      set((state) => ({
        runner: {
          ...state.runner,
          isFiring: false,
          error: err.message ?? 'Request failed.',
          response: null,
          status: null,
          latency: null,
        },
      }));
    }
  },
}));
