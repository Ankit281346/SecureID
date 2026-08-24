/**
 * Validation Middleware for IAM Registration
 */

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\+?[0-9]{7,15}$/;

/**
 * Validate password complexity:
 * - At least 8 characters
 * - At least 1 uppercase letter
 * - At least 1 lowercase letter
 * - At least 1 number
 * - At least 1 special character
 */
function validatePassword(password) {
  if (typeof password !== 'string') return false;
  if (password.length < 8) return false;
  if (!/[A-Z]/.test(password)) return false;
  if (!/[a-z]/.test(password)) return false;
  if (!/[0-9]/.test(password)) return false;
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(password)) return false;
  return true;
}

/**
 * Middleware to validate registration request body
 */
function validateRegistration(req, res, next) {
  const { name, email, phone, password, confirmPassword } = req.body || {};

  // Check required fields
  if (!name || !email || !phone || !password || !confirmPassword) {
    return res.status(400).json({
      success: false,
      message: 'All fields are required (name, email, phone, password, confirmPassword).',
      code: 'MISSING_FIELDS'
    });
  }

  const trimmedName = String(name).trim();
  const trimmedEmail = String(email).trim().toLowerCase();
  const trimmedPhone = String(phone).trim().replace(/\s+/g, '');

  if (trimmedName.length < 2) {
    return res.status(400).json({
      success: false,
      message: 'Full name must be at least 2 characters.',
      code: 'INVALID_NAME'
    });
  }

  if (!EMAIL_REGEX.test(trimmedEmail)) {
    return res.status(400).json({
      success: false,
      message: 'Please provide a valid email address.',
      code: 'INVALID_EMAIL'
    });
  }

  if (!PHONE_REGEX.test(trimmedPhone)) {
    return res.status(400).json({
      success: false,
      message: 'Please provide a valid phone number (e.g. +919876543210).',
      code: 'INVALID_PHONE'
    });
  }

  if (password !== confirmPassword) {
    return res.status(400).json({
      success: false,
      message: 'Passwords do not match.',
      code: 'PASSWORD_MISMATCH'
    });
  }

  if (!validatePassword(password)) {
    return res.status(400).json({
      success: false,
      message: 'Password must be at least 8 characters and contain at least 1 uppercase letter, 1 lowercase letter, 1 number, and 1 special character.',
      code: 'WEAK_PASSWORD'
    });
  }

  // Attach sanitized inputs
  req.sanitized = {
    name: trimmedName,
    email: trimmedEmail,
    phone: trimmedPhone,
    password
  };

  next();
}

/**
 * Middleware to validate 6-digit OTP format in verify requests
 */
function validateOtpPayload(req, res, next) {
  const { challengeId, otp } = req.body || {};

  if (!challengeId || typeof challengeId !== 'string') {
    return res.status(400).json({
      success: false,
      message: 'Challenge ID is required.',
      code: 'MISSING_CHALLENGE_ID'
    });
  }

  if (!otp || typeof otp !== 'string' || !/^\d{6}$/.test(otp.trim())) {
    return res.status(400).json({
      success: false,
      message: 'OTP must be a 6-digit numeric code.',
      code: 'INVALID_OTP_FORMAT'
    });
  }

  next();
}

module.exports = {
  validateRegistration,
  validateOtpPayload,
  validatePassword
};
