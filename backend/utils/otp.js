const crypto = require('crypto');

/**
 * Generate a cryptographically secure 6-digit OTP
 * @returns {string} 6-digit OTP string
 */
function generateSecureOtp() {
  const otp = crypto.randomInt(100000, 1000000).toString();
  return otp;
}

module.exports = {
  generateSecureOtp
};
