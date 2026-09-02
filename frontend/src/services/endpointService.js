import axios from 'axios';

const api = axios.create({ baseURL: '/api/endpoints' });

const authHeader = (token) => ({ Authorization: `Bearer ${token}` });

export const endpointService = {
  /**
   * GET /api/endpoints
   */
  async listEndpoints(token) {
    const { data } = await api.get('/', { headers: authHeader(token) });
    return data; // SavedEndpoint[]
  },

  /**
   * POST /api/endpoints
   */
  async saveEndpoint(endpoint, token) {
    const { data } = await api.post('/', endpoint, { headers: authHeader(token) });
    return data; // SavedEndpoint
  },

  /**
   * DELETE /api/endpoints/:id
   */
  async deleteEndpoint(id, token) {
    await api.delete(`/${id}`, { headers: authHeader(token) });
  },
};
