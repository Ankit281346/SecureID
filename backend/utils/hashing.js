const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const OTP_SALT = process.env.OTP_SALT || 'default_secure_iam_salt_2026';

/**
 * Hash a password using bcrypt
 * @param {string} password
 * @returns {Promise<string>}
 */
async function hashPassword(password) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

/**
 * Compare plain password with stored hash
 * @param {string} password
 * @param {string} hash
 * @returns {Promise<boolean>}
 */
async function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}

/**
 * Hash an OTP using SHA-256 with server salt
 * @param {string} otp
 * @returns {string} Hex hash string
 */
function hashOtp(otp) {
  return crypto
    .createHmac('sha256', OTP_SALT)
    .update(String(otp))
    .digest('hex');
}

/**
 * Timing-safe comparison of provided OTP against stored hash
 * @param {string} plainOtp
 * @param {string} storedHash
 * @returns {boolean}
 */
function verifyOtpHash(plainOtp, storedHash) {
  const computedHash = hashOtp(plainOtp);
  const computedBuffer = Buffer.from(computedHash, 'hex');
  const storedBuffer = Buffer.from(storedHash, 'hex');

  if (computedBuffer.length !== storedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(computedBuffer, storedBuffer);
}

module.exports = {
  hashPassword,
  comparePassword,
  hashOtp,
  verifyOtpHash
};
