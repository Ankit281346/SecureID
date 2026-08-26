const prisma = require('./prisma');

const SESSION_DURATION_DEFAULT = 24 * 60 * 60 * 1000; // 24 hours
const SESSION_DURATION_REMEMBER = 30 * 24 * 60 * 60 * 1000; // 30 days

/**
 * Create a new server-side session
 * @param {string} userId
 * @param {boolean} rememberMe
 * @returns {Promise<{session: Object, cookieOptions: Object}>}
 */
async function createSession(userId, rememberMe = false) {
  const duration = rememberMe ? SESSION_DURATION_REMEMBER : SESSION_DURATION_DEFAULT;
  const expiresAt = new Date(Date.now() + duration);

  const session = await prisma.session.create({
    data: {
      userId,
      expiresAt
    },
    include: {
      user: true
    }
  });

  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: duration,
    path: '/'
  };

  return {
    session,
    cookieOptions
  };
}

/**
 * Find and validate active session
 * @param {string} sessionId
 * @returns {Promise<Object|null>} Session with user or null if invalid/expired
 */
async function getSession(sessionId) {
  if (!sessionId || typeof sessionId !== 'string') {
    return null;
  }

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { user: true }
  });

  if (!session) {
    return null;
  }

  // Check expiration
  if (new Date() > session.expiresAt) {
    await deleteSession(session.id);
    return null;
  }

  return session;
}

/**
 * Invalidate/delete a session
 * @param {string} sessionId
 * @returns {Promise<void>}
 */
async function deleteSession(sessionId) {
  if (!sessionId) return;
  try {
    await prisma.session.delete({
      where: { id: sessionId }
    });
  } catch (err) {
    // Session might already have been deleted
  }
}

module.exports = {
  createSession,
  getSession,
  deleteSession
};
