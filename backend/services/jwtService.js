const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'iam_jwt_super_secret_signing_key_2026_truly_ias';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m'; // 15 minutes

/**
 * Generate a short-lived JWT for an authenticated user
 * @param {Object} user
 * @returns {{accessToken: string, tokenType: string, expiresIn: number}}
 */
function generateToken(user) {
  const payload = {
    sub: user.id,
    id: user.id,
    email: user.email,
    name: user.name
  };

  const accessToken = jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN
  });

  return {
    accessToken,
    tokenType: 'Bearer',
    expiresIn: 900 // 15 minutes in seconds
  };
}

/**
 * Verify JWT signature and expiration
 * @param {string} token
 * @returns {Object} Decoded payload
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      const error = new Error('Token has expired.');
      error.statusCode = 401;
      error.code = 'TOKEN_EXPIRED';
      throw error;
    }
    const error = new Error('Invalid token.');
    error.statusCode = 401;
    error.code = 'INVALID_TOKEN';
    throw error;
  }
}

module.exports = {
  generateToken,
  verifyToken
};
