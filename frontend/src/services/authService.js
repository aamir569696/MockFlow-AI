import axios from 'axios';

const api = axios.create({ baseURL: '/api/auth' });

export const authService = {
  /**
   * POST /api/auth/login
   */
  async login({ email, password }) {
    const { data } = await api.post('/login', { email, password });
    return data; // { accessToken, refreshToken, user }
  },

  /**
   * POST /api/auth/register
   */
  async register({ email, password, displayName }) {
    const { data } = await api.post('/register', { email, password, displayName });
    return data;
  },

  /**
   * POST /api/auth/refresh
   */
  async refreshToken() {
    const { data } = await api.post('/refresh');
    return data.accessToken;
  },

  /**
   * POST /api/auth/logout
   */
  async logout(accessToken) {
    await api.post('/logout', null, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  },
};
