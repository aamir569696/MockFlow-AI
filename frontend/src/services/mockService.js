import axios from 'axios';

const SESSION_KEY = 'mf_session_id';

const api = axios.create({ baseURL: '/api' });

// ── Request interceptor: attach guest session header ──────────────────────────
api.interceptors.request.use((config) => {
  const sessionId = localStorage.getItem(SESSION_KEY);
  if (sessionId) config.headers['x-mockflow-session'] = sessionId;
  return config;
});

// ── Response interceptor: capture session ID echoed back ──────────────────────
api.interceptors.response.use(
  (response) => {
    const sid = response.headers['x-mockflow-session'];
    if (sid) localStorage.setItem(SESSION_KEY, sid);
    return response;
  },
  (error) => Promise.reject(error) // pass through for callers to handle
);

export const mockService = {
  getSessionId() { return localStorage.getItem(SESSION_KEY); },
  setSessionId(id) { localStorage.setItem(SESSION_KEY, id); },

  /**
   * POST /api/generate
   */
  async generateMock(prompt) {
    const { data } = await api.post('/generate', { prompt });
    return data;
  },

  /**
   * Fire a live request to a mock endpoint.
   * Never throws — returns { status, response, latency, responseHeaders, error }.
   */
  async runRequest({ method = 'GET', url }, { body } = {}) {
    const start = Date.now();
    try {
      const res = await api.request({
        method,
        url,
        data: body,
        // Include response headers
        validateStatus: () => true, // treat all status codes as resolved
      });
      return {
        status: res.status,
        response: res.data,
        latency: Date.now() - start,
        responseHeaders: res.headers ?? null,
        error: null,
      };
    } catch (err) {
      // Network-level failure (no response)
      return {
        status: null,
        response: null,
        latency: Date.now() - start,
        responseHeaders: null,
        error: err.message ?? 'Network error',
      };
    }
  },
};
