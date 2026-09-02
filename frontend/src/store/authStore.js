import { create } from 'zustand';

const MOCK_API_KEY = 'MF-9823-KIRO';
const MOCK_USER    = { id: 'mock-user-001', email: 'developer@mockflow.ai', displayName: 'Developer' };
const MOCK_TOKEN   = 'mf_sandbox_token_demo';

export const useAuthStore = create((set, get) => ({
  user:            null,
  accessToken:     null,
  isAuthenticated: false,
  isAuthModalOpen: false,
  authTrigger:     null,
  isSaveSuccess:   false,
  sandboxApiKey:   null,

  // ── Saved collections — populated on simulateSave ─────────────────────────
  // Shape: [{ id, savedAt, apiName, apiDescription, sessionId, endpoints, schema }]
  savedCollections: [],

  // ── Modal controls ────────────────────────────────────────────────────────
  openAuthModal: (trigger = 'manual') =>
    set({ isAuthModalOpen: true, authTrigger: trigger, isSaveSuccess: false }),

  closeAuthModal: () =>
    set({ isAuthModalOpen: false, authTrigger: null }),

  // ── Real auth — Phase 5 placeholder ──────────────────────────────────────
  setAuth: (user, accessToken) =>
    set({ user, accessToken, isAuthenticated: true, isAuthModalOpen: false }),

  clearAuth: () =>
    set({
      user: null, accessToken: null, isAuthenticated: false,
      sandboxApiKey: null, isSaveSuccess: false, savedCollections: [],
    }),

  // ── Mock sandbox save ─────────────────────────────────────────────────────
  // Accepts a snapshot of playground state at save time.
  simulateSave: ({ apiName = '', apiDescription = '', sessionId = '', endpoints = [], schema = {} } = {}) => {
    const existing = get().savedCollections;
    const newCollection = {
      id:             `col-${Date.now()}`,
      savedAt:        new Date().toISOString(),
      apiName:        apiName  || 'Untitled API',
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
      savedCollections: [...existing, newCollection],
    });
  },

  dismissSaveSuccess: () =>
    set({ isSaveSuccess: false, isAuthModalOpen: false, authTrigger: null }),
}));
