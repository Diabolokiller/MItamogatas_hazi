// public/js/api.js - Client API wrapper

const TOKEN_KEY = 'factory_forge_token';

export const api = {
  getToken() {
    return localStorage.getItem(TOKEN_KEY);
  },

  setToken(token) {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  },

  async request(endpoint, options = {}) {
    const token = this.getToken();
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    };

    const response = await fetch(endpoint, {
      ...options,
      headers
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || `Kiszolgáló hiba: ${response.status}`);
    }
    return data;
  },

  async register(username, password) {
    const res = await this.request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
    if (res.token) {
      this.setToken(res.token);
    }
    return res;
  },

  async login(username, password) {
    const res = await this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
    if (res.token) {
      this.setToken(res.token);
    }
    return res;
  },

  async logout() {
    try {
      await this.request('/api/auth/logout', { method: 'POST' });
    } catch {
      // Ignore
    }
    this.setToken(null);
  },

  async getFactory() {
    return await this.request('/api/factory');
  },

  async saveFactory(balance, profitRate, grid) {
    return await this.request('/api/factory/save', {
      method: 'POST',
      body: JSON.stringify({ balance, profitRate, grid })
    });
  },

  async claimOffline() {
    return await this.request('/api/factory/claim-offline', {
      method: 'POST'
    });
  },

  async upgradeBuilding(buildingType, currentLevel) {
    return await this.request('/api/factory/upgrade', {
      method: 'POST',
      body: JSON.stringify({ buildingType, currentLevel })
    });
  }
};
