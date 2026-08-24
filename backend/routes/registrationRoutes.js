const express = require('express');
const router = express.Router();

const registrationController = require('../controllers/registrationController');
const { validateRegistration, validateOtpPayload } = require('../middleware/validation');

// 1. Initial User Registration
router.post('/register', validateRegistration, registrationController.register);

// 2. Email OTP Operations
router.post('/send-email-otp', registrationController.sendEmailOtp);
router.post('/verify-email-otp', validateOtpPayload, registrationController.verifyEmailOtp);

// 3. SMS OTP Operations
router.post('/send-sms-otp', registrationController.sendSmsOtp);
router.post('/verify-sms-otp', validateOtpPayload, registrationController.verifySmsOtp);

// 4. Test-only OTP Retrieval (non-production only)
router.get('/test/otp/:challengeId', registrationController.getTestOtp);

module.exports = router;
