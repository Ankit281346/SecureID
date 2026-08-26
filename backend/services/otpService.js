const prisma = require('./prisma');
const { generateSecureOtp } = require('../utils/otp');
const { hashOtp, verifyOtpHash } = require('../utils/hashing');

const OTP_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
const MAX_ATTEMPTS = 5;

// In-memory store for fast local retrieval
const devOtpStore = new Map();

/**
 * Log simulated delivery to server console
 * @param {string} channel 'email' | 'sms'
 * @param {string} recipient
 * @param {string} otp
 * @param {string} purpose 'registration' | 'login' | 'password-reset'
 */
function logSimulatedDelivery(channel, recipient, otp, purpose = 'registration') {
  let header;
  if (purpose === 'login') {
    header = channel === 'email' ? '[SIMULATED LOGIN EMAIL]' : '[SIMULATED LOGIN SMS]';
  } else if (purpose === 'password-reset') {
    header = '[SIMULATED PASSWORD RESET EMAIL]';
  } else {
    header = channel === 'email' ? '[SIMULATED EMAIL]' : '[SIMULATED SMS]';
  }

  console.log('=================================');
  console.log(header);
  console.log(`To: ${recipient}`);
  console.log(`OTP: ${otp}`);
  console.log('Expires: 5 minutes');
  console.log('=================================');
}

/**
 * Create a new OTP challenge for a user
 * @param {Object} params
 * @param {string} params.userId
 * @param {'email'|'sms'} params.channel
 * @param {string} params.recipient Email address or Phone number
 * @param {string} [params.purpose='registration'] 'registration' | 'login' | 'password-reset'
 * @returns {Promise<{challengeId: string, otp: string, expiresAt: Date}>}
 */
async function createOtpChallenge({ userId, channel, recipient, purpose = 'registration' }) {
  // Invalidate or supersede existing unverified challenges for this user, channel, and purpose
  await prisma.otpChallenge.updateMany({
    where: {
      userId,
      channel,
      purpose,
      verified: false
    },
    data: {
      expiresAt: new Date(0) // Expire previous challenges immediately
    }
  });

  const otp = generateSecureOtp();
  const otpHash = hashOtp(otp);
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS);

  const challenge = await prisma.otpChallenge.create({
    data: {
      userId,
      channel,
      purpose,
      otpHash,
      otpCode: otp, // Persisted for Vercel/serverless test & demo retrieval
      expiresAt,
      attempts: 0,
      verified: false
    }
  });

  // Store in memory for immediate access
  devOtpStore.set(challenge.id, {
    challengeId: challenge.id,
    channel,
    purpose,
    otp,
    expiresAt: expiresAt.toISOString()
  });

  // Print simulated delivery to server console
  logSimulatedDelivery(channel, recipient, otp, purpose);

  return {
    challengeId: challenge.id,
    otp,
    expiresAt
  };
}

/**
 * Verify an OTP submission against a challenge
 * @param {Object} params
 * @param {string} params.challengeId
 * @param {string} params.otp
 * @param {string} [params.expectedPurpose]
 * @returns {Promise<{challenge: Object, user: Object}>}
 */
async function verifyOtpChallenge({ challengeId, otp, expectedPurpose }) {
  if (!challengeId || !otp) {
    const error = new Error('Challenge ID and OTP are required.');
    error.statusCode = 400;
    error.code = 'INVALID_REQUEST';
    throw error;
  }

  const challenge = await prisma.otpChallenge.findUnique({
    where: { id: challengeId },
    include: { user: true }
  });

  if (!challenge) {
    const error = new Error('OTP challenge not found.');
    error.statusCode = 404;
    error.code = 'CHALLENGE_NOT_FOUND';
    throw error;
  }

  if (expectedPurpose && challenge.purpose !== expectedPurpose) {
    const error = new Error('Invalid challenge purpose.');
    error.statusCode = 400;
    error.code = 'INVALID_PURPOSE';
    throw error;
  }

  if (challenge.verified) {
    const error = new Error('This OTP has already been verified and cannot be reused.');
    error.statusCode = 400;
    error.code = 'OTP_ALREADY_VERIFIED';
    throw error;
  }

  const now = new Date();
  if (now > challenge.expiresAt) {
    const error = new Error('This OTP has expired. Please request a new OTP.');
    error.statusCode = 400;
    error.code = 'OTP_EXPIRED';
    throw error;
  }

  if (challenge.attempts >= MAX_ATTEMPTS) {
    const error = new Error('Maximum verification attempts reached. Please request a new OTP.');
    error.statusCode = 429;
    error.code = 'MAX_ATTEMPTS_EXCEEDED';
    error.attemptsRemaining = 0;
    throw error;
  }

  const isMatch = verifyOtpHash(otp.trim(), challenge.otpHash);

  if (!isMatch) {
    const newAttempts = challenge.attempts + 1;
    await prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: { attempts: newAttempts }
    });

    const attemptsRemaining = MAX_ATTEMPTS - newAttempts;

    if (attemptsRemaining <= 0) {
      const error = new Error('Maximum verification attempts reached. Please request a new OTP.');
      error.statusCode = 429;
      error.code = 'MAX_ATTEMPTS_EXCEEDED';
      error.attemptsRemaining = 0;
      throw error;
    }

    const error = new Error('Incorrect OTP.');
    error.statusCode = 400;
    error.code = 'INVALID_OTP';
    error.attemptsRemaining = attemptsRemaining;
    throw error;
  }

  // Mark challenge verified
  const updatedChallenge = await prisma.otpChallenge.update({
    where: { id: challenge.id },
    data: {
      verified: true
    },
    include: { user: true }
  });

  // Clean up in-memory store
  devOtpStore.delete(challenge.id);

  return {
    challenge: updatedChallenge,
    user: updatedChallenge.user
  };
}

/**
 * Retrieve test OTP in simulation mode (supports serverless persistence)
 * @param {string} challengeId
 * @returns {Promise<Object|null>}
 */
async function getDevOtp(challengeId) {
  // Check in-memory store first
  const memoryOtp = devOtpStore.get(challengeId);
  if (memoryOtp) return memoryOtp;

  // Fallback to database for serverless Vercel multi-instance support
  try {
    const challenge = await prisma.otpChallenge.findUnique({
      where: { id: challengeId }
    });

    if (challenge && !challenge.verified && challenge.otpCode) {
      return {
        challengeId: challenge.id,
        channel: challenge.channel,
        purpose: challenge.purpose,
        otp: challenge.otpCode,
        expiresAt: challenge.expiresAt.toISOString()
      };
    }
  } catch (err) {
    console.error('Error fetching OTP from DB:', err);
  }

  return null;
}

module.exports = {
  createOtpChallenge,
  verifyOtpChallenge,
  getDevOtp,
  MAX_ATTEMPTS
};
