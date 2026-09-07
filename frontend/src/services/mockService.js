import axios from 'axios';

const SESSION_KEY = 'mf_session_id';

// Request timeout (ms). Prevents a hung backend from leaving the UI stuck on a
// spinner indefinitely — axios aborts and surfaces a timeout error instead.
const REQUEST_TIMEOUT_MS = 20000;

const api = axios.create({ baseURL: '/api', timeout: REQUEST_TIMEOUT_MS });

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
   *
   * @param {{ method: string, url: string }} endpoint
   * @param {{ body?: any, headers?: Record<string,string> }} options
   */
  async runRequest({ method = 'GET', url }, { body, headers: extraHeaders } = {}) {
    const start = Date.now();
    try {
      const res = await api.request({
        method,
        url,
        data: body,
        headers: extraHeaders ?? {},
        validateStatus: () => true,
      });
      return {
        status: res.status,
        response: res.data,
        latency: Date.now() - start,
        responseHeaders: res.headers ?? null,
        error: null,
      };
    } catch (err) {
      // Give the caller a clear, human-readable reason — especially for the
      // timeout case, which otherwise surfaces as a cryptic axios message.
      const isTimeout = err.code === 'ECONNABORTED' || /timeout/i.test(err.message ?? '');
      return {
        status: null,
        response: null,
        latency: Date.now() - start,
        responseHeaders: null,
        error: isTimeout
          ? `Request timed out after ${REQUEST_TIMEOUT_MS / 1000}s — the server may be slow or unreachable.`
          : (err.message ?? 'Network error'),
      };
    }
  },
};
