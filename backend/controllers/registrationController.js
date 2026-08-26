const prisma = require('../services/prisma');
const { hashPassword } = require('../utils/hashing');
const otpService = require('../services/otpService');

/**
 * POST /api/register
 */
async function register(req, res, next) {
  try {
    const { name, email, phone, password } = req.body;

    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = phone.trim();

    // Check unique email
    const existingEmail = await prisma.user.findUnique({
      where: { email: cleanEmail }
    });

    if (existingEmail) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email already exists.',
        code: 'EMAIL_ALREADY_EXISTS'
      });
    }

    // Check unique phone
    const existingPhone = await prisma.user.findUnique({
      where: { phone: cleanPhone }
    });

    if (existingPhone) {
      return res.status(409).json({
        success: false,
        message: 'An account with this mobile number already exists.',
        code: 'PHONE_ALREADY_EXISTS'
      });
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user in database with unverified status
    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: cleanEmail,
        phone: cleanPhone,
        passwordHash,
        emailVerified: false,
        phoneVerified: false,
        mfaEnabled: false
      }
    });

    // Generate simulated Email OTP Challenge
    const challenge = await otpService.createOtpChallenge({
      userId: user.id,
      channel: 'email',
      recipient: cleanEmail
    });

    return res.status(201).json({
      success: true,
      message: 'Registration initiated. Verification OTP sent to email.',
      nextStep: 'email-otp',
      userId: user.id,
      email: user.email,
      phone: user.phone,
      challengeId: challenge.challengeId,
      expiresAt: challenge.expiresAt.toISOString()
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
    const { challengeId, userId } = req.body;

    let targetUserId = userId;
    let targetEmail = null;

    if (challengeId) {
      const prevChallenge = await prisma.otpChallenge.findUnique({
        where: { id: challengeId },
        include: { user: true }
      });
      if (prevChallenge && prevChallenge.user) {
        targetUserId = prevChallenge.user.id;
        targetEmail = prevChallenge.user.email;
      }
    }

    if (!targetUserId) {
      return res.status(400).json({
        success: false,
        message: 'User ID or valid Challenge ID is required.',
        code: 'INVALID_REQUEST'
      });
    }

    if (!targetEmail) {
      const user = await prisma.user.findUnique({ where: { id: targetUserId } });
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found.',
          code: 'USER_NOT_FOUND'
        });
      }
      targetEmail = user.email;
    }

    const challenge = await otpService.createOtpChallenge({
      userId: targetUserId,
      channel: 'email',
      recipient: targetEmail
    });

    return res.status(200).json({
      success: true,
      message: 'New Email OTP sent successfully.',
      challengeId: challenge.challengeId,
      expiresAt: challenge.expiresAt.toISOString()
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

    // Mark email verified
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true }
    });

    // Automatically issue the SMS OTP Challenge for step 3
    const smsChallenge = await otpService.createOtpChallenge({
      userId: updatedUser.id,
      channel: 'sms',
      recipient: updatedUser.phone
    });

    return res.status(200).json({
      success: true,
      message: 'Email verified successfully. SMS verification OTP sent.',
      nextStep: 'sms-otp',
      emailVerified: true,
      userId: updatedUser.id,
      phone: updatedUser.phone,
      maskedPhone: updatedUser.phone,
      challengeId: smsChallenge.challengeId,
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
    const { challengeId, userId } = req.body;

    let targetUserId = userId;
    let targetPhone = null;

    if (challengeId) {
      const prevChallenge = await prisma.otpChallenge.findUnique({
        where: { id: challengeId },
        include: { user: true }
      });
      if (prevChallenge && prevChallenge.user) {
        targetUserId = prevChallenge.user.id;
        targetPhone = prevChallenge.user.phone;
      }
    }

    if (!targetUserId) {
      return res.status(400).json({
        success: false,
        message: 'User ID or valid Challenge ID is required.',
        code: 'INVALID_REQUEST'
      });
    }

    if (!targetPhone) {
      const user = await prisma.user.findUnique({ where: { id: targetUserId } });
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found.',
          code: 'USER_NOT_FOUND'
        });
      }
      targetPhone = user.phone;
    }

    const challenge = await otpService.createOtpChallenge({
      userId: targetUserId,
      channel: 'sms',
      recipient: targetPhone
    });

    return res.status(200).json({
      success: true,
      message: 'New SMS OTP sent successfully.',
      challengeId: challenge.challengeId,
      expiresAt: challenge.expiresAt.toISOString()
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
 * Test/Demo endpoint to retrieve simulated OTP
 */
function getTestOtp(req, res) {
  if (process.env.NODE_ENV === 'production' && process.env.ENABLE_DEV_OTP !== 'true') {
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
