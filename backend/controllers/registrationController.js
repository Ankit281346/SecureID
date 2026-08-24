const prisma = require('../services/prisma');
const { hashPassword } = require('../utils/hashing');
const otpService = require('../services/otpService');

/**
 * Mask phone number for display (e.g. +91 98765 43210 -> +91 ****** 43210)
 */
function maskPhoneNumber(phone) {
  if (!phone || phone.length < 6) return phone;
  const last4 = phone.slice(-4);
  const start = phone.slice(0, 3);
  return `${start} ${'*'.repeat(Math.max(phone.length - 7, 4))} ${last4}`;
}

/**
 * Mask email for display (e.g. student@example.com -> s***t@example.com)
 */
function maskEmailAddress(email) {
  if (!email || !email.includes('@')) return email;
  const [local, domain] = email.split('@');
  if (local.length <= 2) return `${local[0]}*@${domain}`;
  const maskedLocal = `${local[0]}${'*'.repeat(local.length - 2)}${local[local.length - 1]}`;
  return `${maskedLocal}@${domain}`;
}

/**
 * POST /api/register
 */
async function register(req, res, next) {
  try {
    const { name, email, phone, password } = req.sanitized;

    // Check if email already exists
    const existingEmail = await prisma.user.findUnique({
      where: { email }
    });
    if (existingEmail) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email address already exists.',
        code: 'EMAIL_ALREADY_EXISTS'
      });
    }

    // Check if phone already exists
    const existingPhone = await prisma.user.findUnique({
      where: { phone }
    });
    if (existingPhone) {
      return res.status(409).json({
        success: false,
        message: 'An account with this phone number already exists.',
        code: 'PHONE_ALREADY_EXISTS'
      });
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user
    const user = await prisma.user.create({
      data: {
        name,
        email,
        phone,
        passwordHash,
        emailVerified: false,
        phoneVerified: false,
        mfaEnabled: false
      }
    });

    // Create Email OTP Challenge
    const { challengeId, expiresAt } = await otpService.createOtpChallenge({
      userId: user.id,
      channel: 'email',
      recipient: user.email
    });

    return res.status(201).json({
      success: true,
      message: 'Registration started. Verify your email.',
      challengeId,
      nextStep: 'email-otp',
      userId: user.id,
      email: user.email,
      maskedEmail: maskEmailAddress(user.email),
      expiresAt: expiresAt.toISOString()
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/send-email-otp (Resend Email OTP)
 */
async function sendEmailOtp(req, res, next) {
  try {
    const { challengeId, userId } = req.body || {};

    let user = null;

    if (challengeId) {
      const challenge = await prisma.otpChallenge.findUnique({
        where: { id: challengeId },
        include: { user: true }
      });
      if (challenge) user = challenge.user;
    }

    if (!user && userId) {
      user = await prisma.user.findUnique({ where: { id: userId } });
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User or Challenge not found.',
        code: 'USER_NOT_FOUND'
      });
    }

    const { challengeId: newChallengeId, expiresAt } = await otpService.createOtpChallenge({
      userId: user.id,
      channel: 'email',
      recipient: user.email
    });

    return res.status(200).json({
      success: true,
      message: 'A new email verification code has been sent.',
      challengeId: newChallengeId,
      nextStep: 'email-otp',
      expiresAt: expiresAt.toISOString()
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/verify-email-otp
 */
async function verifyEmailOtp(req, res, next) {
  try {
    const { challengeId, otp } = req.body;

    const { challenge, user } = await otpService.verifyOtpChallenge({
      challengeId,
      otp
    });

    if (challenge.channel !== 'email') {
      return res.status(400).json({
        success: false,
        message: 'Invalid challenge channel for email verification.',
        code: 'INVALID_CHANNEL'
      });
    }

    // Mark user email verified
    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true }
    });

    // Start SMS OTP flow
    const smsChallenge = await otpService.createOtpChallenge({
      userId: user.id,
      channel: 'sms',
      recipient: user.phone
    });

    return res.status(200).json({
      success: true,
      message: 'Email verified successfully.',
      nextStep: 'sms-otp',
      challengeId: smsChallenge.challengeId,
      userId: user.id,
      phone: user.phone,
      maskedPhone: maskPhoneNumber(user.phone),
      expiresAt: smsChallenge.expiresAt.toISOString()
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/send-sms-otp (Resend SMS OTP)
 */
async function sendSmsOtp(req, res, next) {
  try {
    const { challengeId, userId } = req.body || {};

    let user = null;

    if (challengeId) {
      const challenge = await prisma.otpChallenge.findUnique({
        where: { id: challengeId },
        include: { user: true }
      });
      if (challenge) user = challenge.user;
    }

    if (!user && userId) {
      user = await prisma.user.findUnique({ where: { id: userId } });
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User or Challenge not found.',
        code: 'USER_NOT_FOUND'
      });
    }

    if (!user.emailVerified) {
      return res.status(403).json({
        success: false,
        message: 'Email must be verified before requesting SMS OTP.',
        code: 'EMAIL_NOT_VERIFIED'
      });
    }

    const { challengeId: newChallengeId, expiresAt } = await otpService.createOtpChallenge({
      userId: user.id,
      channel: 'sms',
      recipient: user.phone
    });

    return res.status(200).json({
      success: true,
      message: 'A new SMS verification code has been sent.',
      challengeId: newChallengeId,
      nextStep: 'sms-otp',
      expiresAt: expiresAt.toISOString()
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/verify-sms-otp
 */
async function verifySmsOtp(req, res, next) {
  try {
    const { challengeId, otp } = req.body;

    const { challenge, user } = await otpService.verifyOtpChallenge({
      challengeId,
      otp
    });

    if (challenge.channel !== 'sms') {
      return res.status(400).json({
        success: false,
        message: 'Invalid challenge channel for SMS verification.',
        code: 'INVALID_CHANNEL'
      });
    }

    // Mark phone verified and enable MFA
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        phoneVerified: true,
        mfaEnabled: true
      }
    });

    return res.status(200).json({
      success: true,
      message: 'MFA enabled successfully.',
      nextStep: 'registration-success',
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        phone: updatedUser.phone,
        emailVerified: updatedUser.emailVerified,
        phoneVerified: updatedUser.phoneVerified,
        mfaEnabled: updatedUser.mfaEnabled,
        createdAt: updatedUser.createdAt
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/test/otp/:challengeId
 * Test-only endpoint available exclusively in non-production environments
 */
function getTestOtp(req, res) {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({
      success: false,
      message: 'Test OTP retrieval is disabled in production.',
      code: 'TEST_ENDPOINT_DISABLED'
    });
  }

  const { challengeId } = req.params;
  const otpData = otpService.getDevOtp(challengeId);

  if (!otpData) {
    return res.status(404).json({
      success: false,
      message: 'No active dev OTP found for this challenge. It may have expired or already been verified.',
      code: 'TEST_OTP_NOT_FOUND'
    });
  }

  return res.status(200).json(otpData);
}

module.exports = {
  register,
  sendEmailOtp,
  verifyEmailOtp,
  sendSmsOtp,
  verifySmsOtp,
  getTestOtp
};
