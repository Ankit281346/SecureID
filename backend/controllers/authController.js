const prisma = require('../services/prisma');
const { comparePassword, hashPassword } = require('../utils/hashing');
const otpService = require('../services/otpService');
const sessionService = require('../services/sessionService');
const jwtService = require('../services/jwtService');

const MAX_FAILED_ATTEMPTS = parseInt(process.env.LOGIN_MAX_ATTEMPTS || '5', 10);
const LOCKOUT_MINUTES = parseInt(process.env.LOGIN_LOCKOUT_MINUTES || '15', 10);

// In-memory dummy hash for timing attack mitigation
const DUMMY_HASH = '$2a$10$wE0vJk.YjUoA7E7H55kFje3j0Oqm49r46y77E8W4dZ0j4x9aG2Z1m';

/**
 * POST /api/login
 */
async function login(req, res, next) {
  try {
    const { email, password, rememberMe } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Email and password are required.'
      });
    }

    const cleanEmail = String(email).trim().toLowerCase();

    // 1. Find user by email
    const user = await prisma.user.findUnique({
      where: { email: cleanEmail }
    });

    if (!user) {
      // Perform constant-time dummy comparison to prevent timing enumeration
      await comparePassword(password, DUMMY_HASH);
      return res.status(401).json({
        success: false,
        error: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password.'
      });
    }

    // 2. Check if account is locked
    const now = new Date();
    if (user.lockedUntil && user.lockedUntil > now) {
      return res.status(423).json({
        success: false,
        error: 'ACCOUNT_LOCKED',
        message: 'Account temporarily locked. Please try again later.',
        lockedUntil: user.lockedUntil.toISOString()
      });
    }

    // Reset lock if expired
    if (user.lockedUntil && user.lockedUntil <= now) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: 0,
          lockedUntil: null
        }
      });
      user.failedLoginAttempts = 0;
      user.lockedUntil = null;
    }

    // 3. Verify password
    const isPasswordValid = await comparePassword(password, user.passwordHash);

    if (!isPasswordValid) {
      const newFailedAttempts = user.failedLoginAttempts + 1;
      let newLockedUntil = null;

      if (newFailedAttempts >= MAX_FAILED_ATTEMPTS) {
        newLockedUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000);
      }

      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: newFailedAttempts,
          lockedUntil: newLockedUntil
        }
      });

      if (newFailedAttempts >= MAX_FAILED_ATTEMPTS) {
        return res.status(423).json({
          success: false,
          error: 'ACCOUNT_LOCKED',
          message: 'Account temporarily locked. Please try again later.',
          lockedUntil: newLockedUntil.toISOString()
        });
      }

      return res.status(401).json({
        success: false,
        error: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password.'
      });
    }

    // 4. Password valid -> Reset failed attempts
    if (user.failedLoginAttempts > 0 || user.lockedUntil) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: 0,
          lockedUntil: null
        }
      });
    }

    // 5. Check MFA requirement
    if (user.mfaEnabled) {
      // Create login OTP challenge (Email channel)
      const challenge = await otpService.createOtpChallenge({
        userId: user.id,
        channel: 'email',
        recipient: user.email,
        purpose: 'login'
      });

      return res.status(200).json({
        success: true,
        mfaRequired: true,
        method: 'email',
        challengeId: challenge.challengeId,
        devOtp: challenge.otp,
        email: user.email,
        rememberMe: !!rememberMe
      });
    }

    // 6. MFA not required -> Create authenticated session
    const { session, cookieOptions } = await sessionService.createSession(user.id, !!rememberMe);
    res.cookie('sessionId', session.id, cookieOptions);

    return res.status(200).json({
      success: true,
      mfaRequired: false,
      authenticated: true,
      sessionId: session.id // for optional header-based access in tests
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/verify-login-otp
 */
async function verifyLoginOtp(req, res, next) {
  try {
    const { challengeId, otp, rememberMe } = req.body || {};

    if (!challengeId || !otp) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Challenge ID and OTP code are required.'
      });
    }

    const { user } = await otpService.verifyOtpChallenge({
      challengeId,
      otp,
      expectedPurpose: 'login'
    });

    // Create session
    const { session, cookieOptions } = await sessionService.createSession(user.id, !!rememberMe);
    res.cookie('sessionId', session.id, cookieOptions);

    return res.status(200).json({
      success: true,
      authenticated: true,
      sessionId: session.id
    });
  } catch (error) {
    const statusCode = error.statusCode || 400;
    return res.status(statusCode).json({
      success: false,
      error: error.code || 'OTP_INVALID',
      message: error.message || 'OTP verification failed.',
      attemptsRemaining: error.attemptsRemaining
    });
  }
}

/**
 * POST /api/send-login-otp (Resend Login OTP)
 */
async function sendLoginOtp(req, res, next) {
  try {
    const { challengeId } = req.body || {};

    if (!challengeId) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Challenge ID is required.'
      });
    }

    const existingChallenge = await prisma.otpChallenge.findUnique({
      where: { id: challengeId },
      include: { user: true }
    });

    if (!existingChallenge || !existingChallenge.user) {
      return res.status(404).json({
        success: false,
        error: 'CHALLENGE_NOT_FOUND',
        message: 'Login challenge not found.'
      });
    }

    const newChallenge = await otpService.createOtpChallenge({
      userId: existingChallenge.user.id,
      channel: existingChallenge.channel || 'email',
      recipient: existingChallenge.user.email,
      purpose: 'login'
    });

    return res.status(200).json({
      success: true,
      message: 'A new verification code has been sent.',
      challengeId: newChallenge.challengeId,
      devOtp: newChallenge.otp,
      expiresAt: newChallenge.expiresAt.toISOString()
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/forgot-password
 */
async function forgotPassword(req, res, next) {
  try {
    const { email } = req.body || {};
    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Email address is required.'
      });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { email: cleanEmail } });

    let challengeId = null;
    let devOtp = null;
    if (user) {
      const challenge = await otpService.createOtpChallenge({
        userId: user.id,
        channel: 'email',
        recipient: user.email,
        purpose: 'password-reset'
      });
      challengeId = challenge.challengeId;
      devOtp = challenge.otp;
    }

    return res.status(200).json({
      success: true,
      message: 'If an account exists with this email, a password reset code has been sent.',
      challengeId,
      devOtp
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/reset-password
 */
async function resetPassword(req, res, next) {
  try {
    const { challengeId, otp, newPassword, confirmPassword } = req.body || {};

    if (!challengeId || !otp || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Challenge ID, OTP, and new password are required.'
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        error: 'PASSWORD_MISMATCH',
        message: 'Passwords do not match.'
      });
    }

    // Complexity validation
    const hasMinLength = newPassword.length >= 8;
    const hasUpper = /[A-Z]/.test(newPassword);
    const hasNum = /[0-9]/.test(newPassword);
    const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(newPassword);

    if (!hasMinLength || !hasUpper || !hasNum || !hasSpecial) {
      return res.status(400).json({
        success: false,
        error: 'WEAK_PASSWORD',
        message: 'Password does not meet complexity requirements.'
      });
    }

    const { user } = await otpService.verifyOtpChallenge({
      challengeId,
      otp,
      expectedPurpose: 'password-reset'
    });

    const newPasswordHash = await hashPassword(newPassword);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: newPasswordHash,
        failedLoginAttempts: 0,
        lockedUntil: null
      }
    });

    // Invalidate all active sessions for this user
    await prisma.session.deleteMany({
      where: { userId: user.id }
    });

    return res.status(200).json({
      success: true,
      message: 'Password has been reset successfully. Please log in with your new password.'
    });
  } catch (error) {
    const statusCode = error.statusCode || 400;
    return res.status(statusCode).json({
      success: false,
      error: error.code || 'RESET_FAILED',
      message: error.message || 'Password reset failed.',
      attemptsRemaining: error.attemptsRemaining
    });
  }
}

/**
 * GET /api/me
 */
async function getMe(req, res) {
  return res.status(200).json({
    authenticated: true,
    user: {
      id: req.user.id,
      name: req.user.name,
      email: req.user.email,
      phone: req.user.phone,
      mfaEnabled: req.user.mfaEnabled,
      emailVerified: req.user.emailVerified,
      phoneVerified: req.user.phoneVerified,
      createdAt: req.user.createdAt
    }
  });
}

/**
 * POST /api/logout
 */
async function logout(req, res, next) {
  try {
    const sessionId = req.cookies?.sessionId || req.headers['x-session-id'];
    if (sessionId) {
      await sessionService.deleteSession(sessionId);
    }
    res.clearCookie('sessionId', { path: '/' });

    return res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/token (Issue short-lived JWT)
 */
async function issueToken(req, res) {
  const tokenData = jwtService.generateToken(req.user);
  return res.status(200).json({
    accessToken: tokenData.accessToken,
    tokenType: tokenData.tokenType,
    expiresIn: tokenData.expiresIn
  });
}

/**
 * GET /api/protected (JWT-Protected route)
 */
async function getProtected(req, res) {
  return res.status(200).json({
    success: true,
    message: 'JWT authentication successful',
    user: {
      id: req.jwtUser.id,
      email: req.jwtUser.email,
      name: req.jwtUser.name
    }
  });
}

module.exports = {
  login,
  verifyLoginOtp,
  sendLoginOtp,
  forgotPassword,
  resetPassword,
  getMe,
  logout,
  issueToken,
  getProtected
};
