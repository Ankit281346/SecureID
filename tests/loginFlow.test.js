/**
 * Automated Test Suite for IAM Login, MFA, Session, JWT & Password Reset Flow (Part 2)
 */

const assert = require('assert');
const http = require('http');
const app = require('../backend/server');
const prisma = require('../backend/services/prisma');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

let server;
let port;
let baseUrl;

async function request(endpoint, options = {}) {
  const url = `${baseUrl}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  const fetchOptions = {
    method: options.method || 'GET',
    headers
  };

  if (options.body) {
    fetchOptions.body = JSON.stringify(options.body);
  }

  const res = await fetch(url, fetchOptions);
  let data = null;
  const contentType = res.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    data = await res.json();
  }

  // Extract set-cookie
  const setCookie = res.headers.get('set-cookie');

  return { status: res.status, data, headers: res.headers, setCookie };
}

async function runTests() {
  console.log('🧪 Starting IAM Login, MFA, Session, JWT & Password Reset Automated Tests...\n');

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
    await prisma.session.deleteMany({});
    await prisma.otpChallenge.deleteMany({});
    await prisma.user.deleteMany({});

    // Baseline: Create a test user with MFA enabled (simulating Part 1 completed registration)
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('SecurePassword123!', salt);

    const testUser = await prisma.user.create({
      data: {
        name: 'Priya Sharma',
        email: 'priya.sharma@example.com',
        phone: '+919876543210',
        passwordHash,
        emailVerified: true,
        phoneVerified: true,
        mfaEnabled: true
      }
    });

    console.log('Setup: Baseline test user created with mfaEnabled=true');

    // Test 1: Invalid credentials - Non-existent user (Generic error, no enumeration)
    console.log('Test 1: Invalid email returns generic 401 INVALID_CREDENTIALS');
    {
      const { status, data } = await request('/api/login', {
        method: 'POST',
        body: { email: 'nonexistent@example.com', password: 'AnyPassword123!' }
      });
      assert.strictEqual(status, 401);
      assert.strictEqual(data.error, 'INVALID_CREDENTIALS');
      assert.strictEqual(data.message, 'Invalid email or password.');
      console.log('  ✓ Correctly returned generic 401 error without user enumeration');
    }

    // Test 2: Invalid password increments failedLoginAttempts
    console.log('Test 2: Invalid password increments failed attempts and returns generic 401');
    {
      const { status, data } = await request('/api/login', {
        method: 'POST',
        body: { email: 'priya.sharma@example.com', password: 'WrongPassword123!' }
      });
      assert.strictEqual(status, 401);
      assert.strictEqual(data.error, 'INVALID_CREDENTIALS');

      const userInDb = await prisma.user.findUnique({ where: { id: testUser.id } });
      assert.strictEqual(userInDb.failedLoginAttempts, 1);
      console.log('  ✓ failedLoginAttempts incremented to 1');
    }

    // Test 3: Account Lockout after 5 failed login attempts
    console.log('Test 3: 5 failed login attempts triggers account lockout for 15 minutes');
    {
      // Attempt 2, 3, 4
      await request('/api/login', { method: 'POST', body: { email: 'priya.sharma@example.com', password: 'WrongPassword123!' } });
      await request('/api/login', { method: 'POST', body: { email: 'priya.sharma@example.com', password: 'WrongPassword123!' } });
      await request('/api/login', { method: 'POST', body: { email: 'priya.sharma@example.com', password: 'WrongPassword123!' } });

      // Attempt 5 -> triggers lockout
      const { status, data } = await request('/api/login', {
        method: 'POST',
        body: { email: 'priya.sharma@example.com', password: 'WrongPassword123!' }
      });
      assert.strictEqual(status, 423);
      assert.strictEqual(data.error, 'ACCOUNT_LOCKED');
      assert.ok(data.lockedUntil);

      const userInDb = await prisma.user.findUnique({ where: { id: testUser.id } });
      assert.strictEqual(userInDb.failedLoginAttempts, 5);
      assert.ok(userInDb.lockedUntil);
      assert.ok(new Date(userInDb.lockedUntil) > new Date());
      console.log('  ✓ Account successfully locked until:', data.lockedUntil);
    }

    // Test 4: Blocked login while account is locked
    console.log('Test 4: Subsequent login attempts while locked are rejected');
    {
      const { status, data } = await request('/api/login', {
        method: 'POST',
        body: { email: 'priya.sharma@example.com', password: 'SecurePassword123!' }
      });
      assert.strictEqual(status, 423);
      assert.strictEqual(data.error, 'ACCOUNT_LOCKED');
      console.log('  ✓ Valid credentials rejected during active lockout');
    }

    // Unlock user for further tests
    await prisma.user.update({
      where: { id: testUser.id },
      data: { failedLoginAttempts: 0, lockedUntil: null }
    });

    // Test 5: Successful Credentials initiates MFA Login OTP Challenge
    console.log('Test 5: Valid credentials for MFA user issues Login OTP Challenge');
    let loginChallengeId;
    {
      const { status, data } = await request('/api/login', {
        method: 'POST',
        body: { email: 'priya.sharma@example.com', password: 'SecurePassword123!', rememberMe: true }
      });
      assert.strictEqual(status, 200);
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.mfaRequired, true);
      assert.strictEqual(data.method, 'email');
      assert.ok(data.challengeId);
      loginChallengeId = data.challengeId;

      // Ensure failed attempts were reset
      const userInDb = await prisma.user.findUnique({ where: { id: testUser.id } });
      assert.strictEqual(userInDb.failedLoginAttempts, 0);
      console.log('  ✓ Returned challengeId and mfaRequired=true');
    }

    // Test 6: Dev Test OTP retrieval for login challenge
    console.log('Test 6: Retrieve Login OTP via Dev endpoint');
    let loginOtp;
    {
      const { status, data } = await request(`/api/test/otp/${loginChallengeId}`);
      assert.strictEqual(status, 200);
      assert.strictEqual(data.challengeId, loginChallengeId);
      assert.match(data.otp, /^\d{6}$/);
      loginOtp = data.otp;
      console.log('  ✓ Retrieved dev login OTP:', loginOtp);
    }

    // Test 7: Incorrect Login OTP decrements attempts
    console.log('Test 7: Incorrect Login OTP decrements attempts');
    {
      const { status, data } = await request('/api/verify-login-otp', {
        method: 'POST',
        body: { challengeId: loginChallengeId, otp: '000000' }
      });
      assert.strictEqual(status, 400);
      assert.strictEqual(data.error, 'INVALID_OTP');
      assert.strictEqual(data.attemptsRemaining, 4);
      console.log('  ✓ Incorrect OTP returned 400 with attemptsRemaining: 4');
    }

    // Test 8: Resend Login OTP
    console.log('Test 8: Resend Login OTP issues new challenge');
    {
      const { status, data } = await request('/api/send-login-otp', {
        method: 'POST',
        body: { challengeId: loginChallengeId }
      });
      assert.strictEqual(status, 200);
      assert.strictEqual(data.success, true);
      assert.ok(data.challengeId);
      assert.notStrictEqual(data.challengeId, loginChallengeId);

      loginChallengeId = data.challengeId;
      const { data: testData } = await request(`/api/test/otp/${loginChallengeId}`);
      loginOtp = testData.otp;
      console.log('  ✓ New login OTP challenge issued:', loginOtp);
    }

    // Test 9: Successful Login OTP Verification creates session & sets HttpOnly cookie
    console.log('Test 9: Verify Login OTP creates session and sets cookie');
    let authCookie;
    let sessionId;
    {
      const { status, data, setCookie } = await request('/api/verify-login-otp', {
        method: 'POST',
        body: { challengeId: loginChallengeId, otp: loginOtp, rememberMe: true }
      });
      assert.strictEqual(status, 200);
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.authenticated, true);
      assert.ok(data.sessionId);
      sessionId = data.sessionId;

      assert.ok(setCookie, 'Expected Set-Cookie header');
      assert.ok(setCookie.includes('HttpOnly'), 'Cookie must be HttpOnly');
      assert.ok(setCookie.includes('SameSite=Lax') || setCookie.includes('SameSite=lax'));
      authCookie = setCookie.split(';')[0]; // sessionId=...

      // Verify Session in DB
      const sessionInDb = await prisma.session.findUnique({ where: { id: sessionId } });
      assert.ok(sessionInDb);
      assert.strictEqual(sessionInDb.userId, testUser.id);
      console.log('  ✓ Session created in DB and HttpOnly cookie set');
    }

    // Test 10: GET /api/me with session cookie
    console.log('Test 10: GET /api/me returns authenticated user details');
    {
      const { status, data } = await request('/api/me', {
        headers: { Cookie: authCookie }
      });
      assert.strictEqual(status, 200);
      assert.strictEqual(data.authenticated, true);
      assert.strictEqual(data.user.email, 'priya.sharma@example.com');
      assert.strictEqual(data.user.mfaEnabled, true);
      assert.strictEqual(data.user.passwordHash, undefined, 'passwordHash must never be exposed');
      console.log('  ✓ /api/me returned authenticated user successfully');
    }

    // Test 11: GET /api/me without cookie returns 401
    console.log('Test 11: GET /api/me without cookie returns 401 AUTHENTICATION_REQUIRED');
    {
      const { status, data } = await request('/api/me');
      assert.strictEqual(status, 401);
      assert.strictEqual(data.authenticated, false);
      assert.strictEqual(data.error, 'AUTHENTICATION_REQUIRED');
      console.log('  ✓ /api/me correctly rejected unauthenticated request');
    }

    // Test 12: POST /api/token issues short-lived JWT
    console.log('Test 12: POST /api/token issues valid short-lived JWT');
    let accessToken;
    {
      const { status, data } = await request('/api/token', {
        method: 'POST',
        headers: { Cookie: authCookie }
      });
      assert.strictEqual(status, 200);
      assert.strictEqual(data.tokenType, 'Bearer');
      assert.strictEqual(data.expiresIn, 900);
      assert.ok(data.accessToken);
      accessToken = data.accessToken;
      console.log('  ✓ JWT issued successfully with 15-min expiration');
    }

    // Test 13: GET /api/protected with Bearer JWT
    console.log('Test 13: GET /api/protected succeeds with Bearer JWT');
    {
      const { status, data } = await request('/api/protected', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      assert.strictEqual(status, 200);
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.user.email, 'priya.sharma@example.com');
      console.log('  ✓ /api/protected authorized with Bearer token');
    }

    // Test 14: GET /api/protected rejects invalid / missing JWT
    console.log('Test 14: GET /api/protected rejects invalid / missing JWT');
    {
      // Missing
      const { status: missingStatus } = await request('/api/protected');
      assert.strictEqual(missingStatus, 401);

      // Invalid token
      const { status: invalidStatus, data: invalidData } = await request('/api/protected', {
        headers: { Authorization: 'Bearer invalid.token.signature' }
      });
      assert.strictEqual(invalidStatus, 401);
      assert.strictEqual(invalidData.error, 'INVALID_TOKEN');

      // Expired token simulation
      const expiredToken = jwt.sign({ sub: testUser.id, email: testUser.email }, process.env.JWT_SECRET, { expiresIn: '-10s' });
      const { status: expiredStatus, data: expiredData } = await request('/api/protected', {
        headers: { Authorization: `Bearer ${expiredToken}` }
      });
      assert.strictEqual(expiredStatus, 401);
      assert.strictEqual(expiredData.error, 'TOKEN_EXPIRED');

      console.log('  ✓ Missing, invalid, and expired tokens all correctly rejected');
    }

    // Test 15: POST /api/logout invalidates session and clears cookie
    console.log('Test 15: POST /api/logout invalidates session and clears cookie');
    {
      const { status, data } = await request('/api/logout', {
        method: 'POST',
        headers: { Cookie: authCookie }
      });
      assert.strictEqual(status, 200);
      assert.strictEqual(data.success, true);

      // Session deleted in DB
      const sessionInDb = await prisma.session.findUnique({ where: { id: sessionId } });
      assert.strictEqual(sessionInDb, null);

      // /api/me with previous cookie now returns 401
      const { status: meStatus } = await request('/api/me', {
        headers: { Cookie: authCookie }
      });
      assert.strictEqual(meStatus, 401);
      console.log('  ✓ Logout invalidated session and revoked /api/me access');
    }

    // Test 16: POST /api/forgot-password generates password reset challenge
    console.log('Test 16: POST /api/forgot-password generates password reset OTP');
    let resetChallengeId;
    {
      const { status, data } = await request('/api/forgot-password', {
        method: 'POST',
        body: { email: 'priya.sharma@example.com' }
      });
      assert.strictEqual(status, 200);
      assert.strictEqual(data.success, true);
      assert.ok(data.challengeId);
      resetChallengeId = data.challengeId;
      console.log('  ✓ Password reset challenge generated:', resetChallengeId);
    }

    // Test 17: POST /api/reset-password updates user password hash
    console.log('Test 17: POST /api/reset-password updates password');
    {
      const { data: testOtpData } = await request(`/api/test/otp/${resetChallengeId}`);
      const resetOtp = testOtpData.otp;

      const { status, data } = await request('/api/reset-password', {
        method: 'POST',
        body: {
          challengeId: resetChallengeId,
          otp: resetOtp,
          newPassword: 'BrandNewPassword999!',
          confirmPassword: 'BrandNewPassword999!'
        }
      });
      assert.strictEqual(status, 200);
      assert.strictEqual(data.success, true);

      // Verify user can now log in with the new password
      const { status: loginStatus, data: loginData } = await request('/api/login', {
        method: 'POST',
        body: {
          email: 'priya.sharma@example.com',
          password: 'BrandNewPassword999!'
        }
      });
      assert.strictEqual(loginStatus, 200);
      assert.strictEqual(loginData.success, true);
      console.log('  ✓ Password updated and successfully verified with new login');
    }

    console.log('\n🎉 ALL 17 TEST SUITES PASSED PERFECTLY!\n');
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
