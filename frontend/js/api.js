/**
 * API Client for SecureID IAM (Part 1 + Part 2)
 */

const API_BASE = '/api';

const api = {
  /**
   * Register a new user
   */
  async register(payload) {
    const response = await fetch(`${API_BASE}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok) {
      const err = new Error(data.message || 'Registration failed.');
      err.data = data;
      err.status = response.status;
      throw err;
    }
    return data;
  },

  /**
   * Resend Registration Email OTP
   */
  async sendEmailOtp(payload) {
    const response = await fetch(`${API_BASE}/send-email-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok) {
      const err = new Error(data.message || 'Failed to resend email OTP.');
      err.data = data;
      err.status = response.status;
      throw err;
    }
    return data;
  },

  /**
   * Verify Registration Email OTP
   */
  async verifyEmailOtp(payload) {
    const response = await fetch(`${API_BASE}/verify-email-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok) {
      const err = new Error(data.message || 'Email OTP verification failed.');
      err.data = data;
      err.status = response.status;
      throw err;
    }
    return data;
  },

  /**
   * Resend Registration SMS OTP
   */
  async sendSmsOtp(payload) {
    const response = await fetch(`${API_BASE}/send-sms-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok) {
      const err = new Error(data.message || 'Failed to resend SMS OTP.');
      err.data = data;
      err.status = response.status;
      throw err;
    }
    return data;
  },

  /**
   * Verify Registration SMS OTP
   */
  async verifySmsOtp(payload) {
    const response = await fetch(`${API_BASE}/verify-sms-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok) {
      const err = new Error(data.message || 'SMS OTP verification failed.');
      err.data = data;
      err.status = response.status;
      throw err;
    }
    return data;
  },

  /**
   * Login with email and password (Part 2)
   */
  async login(payload) {
    const response = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok) {
      const err = new Error(data.message || 'Login failed.');
      err.data = data;
      err.status = response.status;
      throw err;
    }
    return data;
  },

  /**
   * Verify Login MFA OTP (Part 2)
   */
  async verifyLoginOtp(payload) {
    const response = await fetch(`${API_BASE}/verify-login-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok) {
      const err = new Error(data.message || 'OTP verification failed.');
      err.data = data;
      err.status = response.status;
      throw err;
    }
    return data;
  },

  /**
   * Resend Login OTP (Part 2)
   */
  async sendLoginOtp(payload) {
    const response = await fetch(`${API_BASE}/send-login-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok) {
      const err = new Error(data.message || 'Failed to resend login OTP.');
      err.data = data;
      err.status = response.status;
      throw err;
    }
    return data;
  },

  /**
   * Get currently authenticated user profile (/api/me)
   */
  async getMe() {
    const response = await fetch(`${API_BASE}/me`, {
      method: 'GET',
      credentials: 'include'
    });
    if (!response.ok) return null;
    return await response.json();
  },

  /**
   * Logout (/api/logout)
   */
  async logout() {
    const response = await fetch(`${API_BASE}/logout`, {
      method: 'POST',
      credentials: 'include'
    });
    return await response.json();
  },

  /**
   * Issue short-lived JWT token (/api/token)
   */
  async getToken() {
    const response = await fetch(`${API_BASE}/token`, {
      method: 'POST',
      credentials: 'include'
    });
    const data = await response.json();
    if (!response.ok) {
      const err = new Error(data.message || 'Failed to issue token.');
      err.data = data;
      throw err;
    }
    return data;
  },

  /**
   * Request protected API with Bearer token (/api/protected)
   */
  async getProtected(token) {
    const response = await fetch(`${API_BASE}/protected`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    const data = await response.json();
    if (!response.ok) {
      const err = new Error(data.message || 'Protected access denied.');
      err.data = data;
      err.status = response.status;
      throw err;
    }
    return data;
  },

  /**
   * Dev Simulated OTP Retrieval (Dev-only)
   */
  async getDevOtp(challengeId) {
    try {
      const response = await fetch(`${API_BASE}/test/otp/${challengeId}`);
      if (!response.ok) return null;
      return await response.json();
    } catch (e) {
      return null;
    }
  }
};

window.api = api;
