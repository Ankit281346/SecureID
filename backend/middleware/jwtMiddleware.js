const { verifyToken } = require('../services/jwtService');

/**
 * Middleware to require a valid Bearer JWT token
 */
function requireJWT(req, res, next) {
  const authHeader = req.headers.authorization || req.headers.Authorization;

  if (!authHeader || typeof authHeader !== 'string') {
    return res.status(401).json({
      success: false,
      error: 'AUTHENTICATION_REQUIRED',
      message: 'Authorization header with Bearer token is required.'
    });
  }

  const parts = authHeader.trim().split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    return res.status(401).json({
      success: false,
      error: 'INVALID_TOKEN',
      message: 'Authorization header must follow "Bearer <token>" format.'
    });
  }

  const token = parts[1];

  try {
    const decoded = verifyToken(token);
    req.jwtUser = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: error.code || 'INVALID_TOKEN',
      message: error.message || 'Token is invalid or expired.'
    });
  }
}

module.exports = {
  requireJWT
};
