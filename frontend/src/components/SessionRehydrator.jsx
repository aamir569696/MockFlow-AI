import { useEffect, useRef } from 'react';
import { usePlaygroundStore } from '../store/playgroundStore.js';

/**
 * SessionRehydrator — mounts once in <App /> above all routes.
 *
 * Problem it solves
 * ─────────────────
 * The Zustand persist middleware restores all frontend state (endpoints,
 * schema, prompt, sessionId) from localStorage on every page load.
 * However, the Express backend SessionStore is in-memory — it is wiped
 * whenever the server process restarts (Render free-tier spins down after
 * 15 min of inactivity, or on any redeploy).
 *
 * If the user refreshes the browser while the backend session is gone,
 * every "Fire Live Fetch Hit" returns 404 ENDPOINT_NOT_FOUND even though
 * the frontend shows the full endpoint list.
 *
 * This component detects that situation and silently re-fires the stored
 * prompt against POST /api/generate to re-register all endpoints on the
 * backend — completely transparent to the user.
 *
 * Behaviour
 * ─────────
 * 1. On first render after hydration: checks if endpoints exist but the
 *    backend needs re-seeding (detected by probing the first endpoint).
 * 2. Calls rehydrateBackend() which re-runs generation and updates the
 *    store with any new sessionId the server returns.
 * 3. Runs only once per page load (guarded by a ref flag).
 * 4. Does nothing if: no stored prompt, no stored endpoints, or generation
 *    is already in progress.
 */

const PROBE_TIMEOUT_MS = 4000; // give up probing after 4 s

export default function SessionRehydrator() {
  const {
    sessionId,
    endpoints,
    prompt,
    isGenerating,
    rehydrateBackend,
  } = usePlaygroundStore();

  const hasRun = useRef(false);

  useEffect(() => {
    // Guard: only run once, only when there is something to restore
    if (hasRun.current)          return;
    if (!prompt || !endpoints.length) return;
    if (isGenerating)            return;

    hasRun.current = true;

    // Probe the first stored endpoint to see if the backend still knows it.
    // We use a short AbortController timeout so the probe doesn't block the UI.
    const firstSlug = endpoints[0]?.slug;
    if (!firstSlug || !sessionId) {
      rehydrateBackend();
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);

    fetch(`/api/mock/${sessionId}/${firstSlug}`, {
      method:  'GET',
      headers: { 'x-mockflow-session': sessionId },
      signal:  controller.signal,
    })
      .then((res) => {
        clearTimeout(timer);
        if (res.status === 404) {
          // Backend session is gone — re-register everything silently
          console.info('[SessionRehydrator] Backend session stale — rehydrating…');
          rehydrateBackend();
        }
        // 200/201/5xx etc. → backend is alive, no action needed
      })
      .catch((err) => {
        clearTimeout(timer);
        if (err.name === 'AbortError') {
          // Probe timed out — assume backend is down and rehydrate anyway
          console.warn('[SessionRehydrator] Probe timed out — attempting rehydration.');
          rehydrateBackend();
        }
        // Network error on the probe itself: backend may be starting up.
        // Rehydrate to be safe.
        else {
          console.warn('[SessionRehydrator] Probe failed — attempting rehydration.');
          rehydrateBackend();
        }
      });

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally empty — runs exactly once on mount

  // Renders nothing — purely a side-effect component
  return null;
}
