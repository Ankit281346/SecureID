/**
 * Client-side Validation Helper for Registration Form
 */

const validation = {
  EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PHONE_REGEX: /^[0-9]{10}$/,

  /**
   * Check password rules
   * @param {string} password
   */
  checkPasswordRules(password) {
    const p = password || '';
    return {
      length: p.length >= 8,
      uppercase: /[A-Z]/.test(p),
      number: /[0-9]/.test(p),
      special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(p)
    };
  },

  /**
   * Validate entire registration form
   * @param {Object} data
   * @returns {{isValid: boolean, errors: Object}}
   */
  validateRegistrationForm(data) {
    const errors = {};
    const { name, email, phone, password, confirmPassword } = data;

    if (!name || name.trim().length < 2) {
      errors.name = 'Please enter your full name (at least 2 characters).';
    }

    if (!email || !this.EMAIL_REGEX.test(email.trim())) {
      errors.email = 'Please enter a valid email address.';
    }

    const cleanPhone = (phone || '').replace(/\D/g, '');
    if (!cleanPhone || cleanPhone.length < 10) {
      errors.phone = 'Please enter a valid 10-digit mobile number.';
    }

    const passRules = this.checkPasswordRules(password);
    if (!passRules.length || !passRules.uppercase || !passRules.number || !passRules.special) {
      errors.password = 'Password does not meet all complexity requirements.';
    }

    if (password !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match.';
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  }
};

window.validation = validation;
