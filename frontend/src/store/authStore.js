import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

const MOCK_API_KEY = 'MF-9823-KIRO';
const MOCK_USER    = { id: 'mock-user-001', email: 'developer@mockflow.ai', displayName: 'Developer' };
const MOCK_TOKEN   = 'mf_sandbox_token_demo';

/**
 * authStore — authentication + saved collections state.
 *
 * Persisted keys (survive reload):
 *   user, accessToken, isAuthenticated, sandboxApiKey, savedCollections
 *
 * Transient keys (reset each load — UI-only):
 *   isAuthModalOpen, authTrigger, isSaveSuccess
 */
export const useAuthStore = create(
  persist(
    (set, get) => ({
      // ── Persisted ─────────────────────────────────────────────────────
      user:             null,
      accessToken:      null,
      isAuthenticated:  false,
      sandboxApiKey:    null,
      savedCollections: [],   // [{ id, savedAt, apiName, apiDescription, sessionId, endpoints, schema, apiKey }]

      // ── Transient (not persisted) ──────────────────────────────────────
      isAuthModalOpen: false,
      authTrigger:     null,  // 'save' | 'share' | 'manual' | null
      isSaveSuccess:   false,

      // ── Modal controls ─────────────────────────────────────────────────
      openAuthModal: (trigger = 'manual') =>
        set({ isAuthModalOpen: true, authTrigger: trigger, isSaveSuccess: false }),

      closeAuthModal: () =>
        set({ isAuthModalOpen: false, authTrigger: null }),

      // ── Real auth — Phase 5 placeholder ───────────────────────────────
      setAuth: (user, accessToken) =>
        set({ user, accessToken, isAuthenticated: true, isAuthModalOpen: false }),

      clearAuth: () =>
        set({
          user:             null,
          accessToken:      null,
          isAuthenticated:  false,
          sandboxApiKey:    null,
          isSaveSuccess:    false,
          savedCollections: [],
        }),

      // ── Mock sandbox save — no network ─────────────────────────────────
      simulateSave: ({ apiName = '', apiDescription = '', sessionId = '', endpoints = [], schema = {} } = {}) => {
        const existing = get().savedCollections;
        const newCol = {
          id:             `col-${Date.now()}`,
          savedAt:        new Date().toISOString(),
          apiName:        apiName      || 'Untitled API',
          apiDescription: apiDescription || '',
          sessionId,
          endpoints,
          schema,
          apiKey:         MOCK_API_KEY,
        };
        set({
          user:             MOCK_USER,
          accessToken:      MOCK_TOKEN,
          isAuthenticated:  true,
          isSaveSuccess:    true,
          sandboxApiKey:    MOCK_API_KEY,
          savedCollections: [...existing, newCol],
        });
      },

      dismissSaveSuccess: () =>
        set({ isSaveSuccess: false, isAuthModalOpen: false, authTrigger: null }),
    }),

    {
      name:    'mf_auth',
      storage: createJSONStorage(() => localStorage),

      // Persist only the durable auth state — never UI-only flags
      partialize: (state) => ({
        user:             state.user,
        accessToken:      state.accessToken,
        isAuthenticated:  state.isAuthenticated,
        sandboxApiKey:    state.sandboxApiKey,
        savedCollections: state.savedCollections,
      }),

      version: 1,
    },
  ),
);
