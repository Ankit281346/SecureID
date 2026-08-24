/**
 * Automated Verification Test Suite for IAM Registration & OTP Flow (Part 1)
 */

const assert = require('assert');
const http = require('http');
const app = require('../backend/server');
const prisma = require('../backend/services/prisma');
const bcrypt = require('bcryptjs');

let server;
let port;
let baseUrl;

async function request(endpoint, options = {}) {
  const url = `${baseUrl}${endpoint}`;
  const fetchOptions = {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  };

  if (options.body) {
    fetchOptions.body = JSON.stringify(options.body);
  }

  const res = await fetch(url, fetchOptions);
  const data = await res.json();
  return { status: res.status, data };
}

async function runTests() {
  console.log('🧪 Starting IAM Registration & OTP Flow Automated Tests...\n');

  // Start temporary test server
  server = http.createServer(app);
  await new Promise((resolve) => {
    server.listen(0, () => {
      port = server.address().port;
      baseUrl = `http://localhost:${port}`;
      resolve();
    });
  });

  try {
    // Clear test database tables
    await prisma.otpChallenge.deleteMany({});
    await prisma.user.deleteMany({});

    // Test 1: Validation - Missing fields
    console.log('Test 1: Validation rejects missing fields');
    {
      const { status, data } = await request('/api/register', {
        method: 'POST',
        body: { name: 'Test' }
      });
      assert.strictEqual(status, 400);
      assert.strictEqual(data.code, 'MISSING_FIELDS');
      console.log('  ✓ Correctly returned 400 MISSING_FIELDS');
    }

    // Test 2: Validation - Weak password
    console.log('Test 2: Validation rejects weak password');
    {
      const { status, data } = await request('/api/register', {
        method: 'POST',
        body: {
          name: 'Test User',
          email: 'test@example.com',
          phone: '+919876543210',
          password: 'password',
          confirmPassword: 'password'
        }
      });
      assert.strictEqual(status, 400);
      assert.strictEqual(data.code, 'WEAK_PASSWORD');
      console.log('  ✓ Correctly returned 400 WEAK_PASSWORD');
    }

    // Test 3: Validation - Password mismatch
    console.log('Test 3: Validation rejects password mismatch');
    {
      const { status, data } = await request('/api/register', {
        method: 'POST',
        body: {
          name: 'Test User',
          email: 'test@example.com',
          phone: '+919876543210',
          password: 'SecurePassword123!',
          confirmPassword: 'DifferentPassword123!'
        }
      });
      assert.strictEqual(status, 400);
      assert.strictEqual(data.code, 'PASSWORD_MISMATCH');
      console.log('  ✓ Correctly returned 400 PASSWORD_MISMATCH');
    }

    // Test 4: Successful User Registration
    console.log('Test 4: Successful Registration creates user & email OTP challenge');
    let userId;
    let emailChallengeId;
    {
      const { status, data } = await request('/api/register', {
        method: 'POST',
        body: {
          name: 'Priya Sharma',
          email: 'priya.sharma@example.com',
          phone: '+919876543210',
          password: 'SecurePassword123!',
          confirmPassword: 'SecurePassword123!'
        }
      });
      assert.strictEqual(status, 201);
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.nextStep, 'email-otp');
      assert.ok(data.challengeId);
      assert.ok(data.userId);

      userId = data.userId;
      emailChallengeId = data.challengeId;

      // Verify user in DB
      const userInDb = await prisma.user.findUnique({ where: { id: userId } });
      assert.ok(userInDb);
      assert.strictEqual(userInDb.emailVerified, false);
      assert.strictEqual(userInDb.phoneVerified, false);
      assert.strictEqual(userInDb.mfaEnabled, false);

      // Verify password was hashed with bcrypt
      assert.notStrictEqual(userInDb.passwordHash, 'SecurePassword123!');
      const isMatch = await bcrypt.compare('SecurePassword123!', userInDb.passwordHash);
      assert.strictEqual(isMatch, true);

      // Verify OTP is hashed in DB (not plaintext)
      const challengeInDb = await prisma.otpChallenge.findUnique({ where: { id: emailChallengeId } });
      assert.ok(challengeInDb);
      assert.strictEqual(challengeInDb.verified, false);
      assert.strictEqual(challengeInDb.otpHash.length, 64); // SHA-256 length

      console.log('  ✓ User created with hashed password and emailVerified=false');
      console.log('  ✓ OTP challenge created with SHA-256 hash');
    }

    // Test 5: Duplicate Email & Duplicate Phone rejection
    console.log('Test 5: Duplicate registration is rejected with 409');
    {
      const { status: statusEmail, data: dataEmail } = await request('/api/register', {
        method: 'POST',
        body: {
          name: 'Another User',
          email: 'priya.sharma@example.com',
          phone: '+919999999999',
          password: 'SecurePassword123!',
          confirmPassword: 'SecurePassword123!'
        }
      });
      assert.strictEqual(statusEmail, 409);
      assert.strictEqual(dataEmail.code, 'EMAIL_ALREADY_EXISTS');

      const { status: statusPhone, data: dataPhone } = await request('/api/register', {
        method: 'POST',
        body: {
          name: 'Another User',
          email: 'another@example.com',
          phone: '+919876543210',
          password: 'SecurePassword123!',
          confirmPassword: 'SecurePassword123!'
        }
      });
      assert.strictEqual(statusPhone, 409);
      assert.strictEqual(dataPhone.code, 'PHONE_ALREADY_EXISTS');
      console.log('  ✓ Duplicate email returned 409 EMAIL_ALREADY_EXISTS');
      console.log('  ✓ Duplicate phone returned 409 PHONE_ALREADY_EXISTS');
    }

    // Test 6: Dev Test OTP retrieval
    console.log('Test 6: Dev Test OTP retrieval endpoint');
    let emailOtp;
    {
      const { status, data } = await request(`/api/test/otp/${emailChallengeId}`);
      assert.strictEqual(status, 200);
      assert.strictEqual(data.challengeId, emailChallengeId);
      assert.strictEqual(data.channel, 'email');
      assert.match(data.otp, /^\d{6}$/);
      emailOtp = data.otp;
      console.log(`  ✓ Successfully retrieved dev test OTP: ${emailOtp}`);
    }

    // Test 7: Incorrect Email OTP decrements attempts
    console.log('Test 7: Incorrect Email OTP handling and attempt decrementing');
    {
      const { status, data } = await request('/api/verify-email-otp', {
        method: 'POST',
        body: {
          challengeId: emailChallengeId,
          otp: '000000'
        }
      });
      assert.strictEqual(status, 400);
      assert.strictEqual(data.code, 'INVALID_OTP');
      assert.strictEqual(data.attemptsRemaining, 4);
      console.log('  ✓ Incorrect OTP returned 400 with attemptsRemaining: 4');
    }

    // Test 8: Max Attempts Lockout
    console.log('Test 8: Exceeding 5 attempts locks the challenge');
    {
      // Attempt 2, 3, 4
      await request('/api/verify-email-otp', { method: 'POST', body: { challengeId: emailChallengeId, otp: '000001' } });
      await request('/api/verify-email-otp', { method: 'POST', body: { challengeId: emailChallengeId, otp: '000002' } });
      await request('/api/verify-email-otp', { method: 'POST', body: { challengeId: emailChallengeId, otp: '000003' } });
      
      // Attempt 5 -> should lock with 429
      const { status, data } = await request('/api/verify-email-otp', {
        method: 'POST',
        body: { challengeId: emailChallengeId, otp: '000004' }
      });
      assert.strictEqual(status, 429);
      assert.strictEqual(data.code, 'MAX_ATTEMPTS_EXCEEDED');
      assert.strictEqual(data.attemptsRemaining, 0);
      console.log('  ✓ 5th incorrect attempt locked challenge with 429 MAX_ATTEMPTS_EXCEEDED');
    }

    // Test 9: Resend Email OTP creates fresh challenge
    console.log('Test 9: Resend Email OTP');
    {
      const { status, data } = await request('/api/send-email-otp', {
        method: 'POST',
        body: { challengeId: emailChallengeId, userId }
      });
      assert.strictEqual(status, 200);
      assert.strictEqual(data.success, true);
      assert.ok(data.challengeId);
      assert.notStrictEqual(data.challengeId, emailChallengeId);

      emailChallengeId = data.challengeId;

      // Fetch new OTP
      const { data: testData } = await request(`/api/test/otp/${emailChallengeId}`);
      emailOtp = testData.otp;
      console.log(`  ✓ Resend succeeded with new challengeId and OTP: ${emailOtp}`);
    }

    // Test 10: Successful Email Verification transitions to SMS OTP
    console.log('Test 10: Verify Email OTP and automatically initiate SMS OTP');
    let smsChallengeId;
    {
      const { status, data } = await request('/api/verify-email-otp', {
        method: 'POST',
        body: {
          challengeId: emailChallengeId,
          otp: emailOtp
        }
      });
      assert.strictEqual(status, 200);
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.nextStep, 'sms-otp');
      assert.ok(data.challengeId);
      assert.ok(data.maskedPhone);

      smsChallengeId = data.challengeId;

      // Verify User in DB has emailVerified = true
      const user = await prisma.user.findUnique({ where: { id: userId } });
      assert.strictEqual(user.emailVerified, true);
      assert.strictEqual(user.phoneVerified, false);
      assert.strictEqual(user.mfaEnabled, false);

      console.log('  ✓ Email verified, user updated in DB, SMS challenge issued');
    }

    // Test 11: Single-use OTP check (cannot reuse verified OTP challenge)
    console.log('Test 11: Verified OTP cannot be reused');
    {
      const { status, data } = await request('/api/verify-email-otp', {
        method: 'POST',
        body: {
          challengeId: emailChallengeId,
          otp: emailOtp
        }
      });
      assert.strictEqual(status, 400);
      assert.strictEqual(data.code, 'OTP_ALREADY_VERIFIED');
      console.log('  ✓ Reusing verified OTP returned 400 OTP_ALREADY_VERIFIED');
    }

    // Test 12: Verify SMS OTP with Incorrect and Correct Codes
    console.log('Test 12: SMS OTP Verification & MFA Enablement');
    let smsOtp;
    {
      // Get SMS OTP
      const { data: testData } = await request(`/api/test/otp/${smsChallengeId}`);
      smsOtp = testData.otp;
      assert.match(smsOtp, /^\d{6}$/);

      // Wrong SMS OTP
      const { status: wrongStatus, data: wrongData } = await request('/api/verify-sms-otp', {
        method: 'POST',
        body: {
          challengeId: smsChallengeId,
          otp: '111111'
        }
      });
      assert.strictEqual(wrongStatus, 400);
      assert.strictEqual(wrongData.attemptsRemaining, 4);

      // Correct SMS OTP
      const { status: okStatus, data: okData } = await request('/api/verify-sms-otp', {
        method: 'POST',
        body: {
          challengeId: smsChallengeId,
          otp: smsOtp
        }
      });
      assert.strictEqual(okStatus, 200);
      assert.strictEqual(okData.success, true);
      assert.strictEqual(okData.nextStep, 'registration-success');
      assert.strictEqual(okData.user.phoneVerified, true);
      assert.strictEqual(okData.user.mfaEnabled, true);

      // Verify User in DB
      const user = await prisma.user.findUnique({ where: { id: userId } });
      assert.strictEqual(user.emailVerified, true);
      assert.strictEqual(user.phoneVerified, true);
      assert.strictEqual(user.mfaEnabled, true);

      console.log('  ✓ SMS verified successfully, phoneVerified=true, mfaEnabled=true');
      console.log('  ✓ Returned nextStep: registration-success');
    }

    // Test 13: Production Guard Check on Test Endpoint
    console.log('Test 13: Test OTP endpoint is disabled in production');
    {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const { status, data } = await request(`/api/test/otp/${smsChallengeId}`);
      assert.strictEqual(status, 403);
      assert.strictEqual(data.code, 'TEST_ENDPOINT_DISABLED');

      process.env.NODE_ENV = originalEnv;
      console.log('  ✓ Production mode correctly blocks test OTP endpoint with 403');
    }

    console.log('\n🎉 ALL 13 TEST SUITES PASSED PERFECTLY!\n');
  } catch (error) {
    console.error('\n❌ Test Suite Failed:', error);
    process.exitCode = 1;
  } finally {
    if (server) {
      server.close();
    }
    await prisma.$disconnect();
    process.exit(process.exitCode ? 1 : 0);
  }
}

runTests();
