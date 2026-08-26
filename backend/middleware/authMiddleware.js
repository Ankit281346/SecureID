const sessionService = require('../services/sessionService');

/**
 * Middleware to require an active authenticated session
 */
async function requireAuth(req, res, next) {
  try {
    const sessionId = req.cookies?.sessionId || req.headers['x-session-id'];

    if (!sessionId) {
      return res.status(401).json({
        authenticated: false,
        error: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication required. Please log in.'
      });
    }

    const session = await sessionService.getSession(sessionId);

    if (!session || !session.user) {
      // Clear cookie if present but invalid
      res.clearCookie('sessionId', { path: '/' });
      return res.status(401).json({
        authenticated: false,
        error: 'SESSION_EXPIRED',
        message: 'Your session has expired. Please log in again.'
      });
    }

    req.user = session.user;
    req.session = session;
    next();
  } catch (error) {
    next(error);
  }
}

module.exports = {
  requireAuth
};
