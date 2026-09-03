/**
 * useHistoryStore — persists the last 5 generated API schemas.
 *
 * Migrated from manual localStorage helpers to the Zustand persist
 * middleware so the serialisation strategy is consistent across all stores.
 *
 * Shape of a history entry:
 * {
 *   id:             string   (timestamp-based, e.g. "hist-1725302400000")
 *   savedAt:        string   (ISO-8601)
 *   prompt:         string
 *   apiName:        string
 *   apiDescription: string
 *   sessionId:      string
 *   endpoints:      Endpoint[]
 *   schema:         object
 * }
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

const MAX_ENTRIES = 5;

export const useHistoryStore = create(
  persist(
    (set, get) => ({
      entries: [],

      /**
       * Prepend a new generation snapshot.
       * Deduplicates by prompt (case-insensitive trim).
       * Caps list at MAX_ENTRIES.
       */
      push(snapshot) {
        const { prompt, apiName, apiDescription, sessionId, endpoints, schema } = snapshot;
        const now = Date.now();

        const newEntry = {
          id:             `hist-${now}`,
          savedAt:        new Date(now).toISOString(),
          prompt:         prompt         || '',
          apiName:        apiName        || 'Untitled API',
          apiDescription: apiDescription || '',
          sessionId:      sessionId      || '',
          endpoints:      endpoints      || [],
          schema:         schema         || {},
        };

        const normalised = (s) => (s || '').trim().toLowerCase();
        const deduped = get().entries.filter(
          (e) => normalised(e.prompt) !== normalised(prompt),
        );

        set({ entries: [newEntry, ...deduped].slice(0, MAX_ENTRIES) });
      },

      /** Remove a single entry by id. */
      remove(id) {
        set((state) => ({ entries: state.entries.filter((e) => e.id !== id) }));
      },

      /** Wipe all history. */
      clear() {
        set({ entries: [] });
      },
    }),

    {
      name:    'mf_mock_history',
      storage: createJSONStorage(() => localStorage),
      version: 1,
    },
  ),
);
