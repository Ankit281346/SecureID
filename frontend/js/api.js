/**
 * API Client for SecureID IAM Registration
 */

const API_BASE = '/api';

const api = {
  /**
   * Register a new user
   * @param {Object} payload { name, email, phone, password, confirmPassword }
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
   * Resend Email OTP
   * @param {Object} payload { challengeId, userId }
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
   * Verify Email OTP
   * @param {Object} payload { challengeId, otp }
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
   * Resend SMS OTP
   * @param {Object} payload { challengeId, userId }
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
   * Verify SMS OTP
   * @param {Object} payload { challengeId, otp }
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
   * Fetch Dev Simulated OTP (test-only)
   * @param {string} challengeId
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
