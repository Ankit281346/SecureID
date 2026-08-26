const express = require('express');
const router = express.Router();

const authController = require('../controllers/authController');
const { requireAuth } = require('../middleware/authMiddleware');
const { requireJWT } = require('../middleware/jwtMiddleware');

// Public Login Endpoints
router.post('/login', authController.login);
router.post('/verify-login-otp', authController.verifyLoginOtp);
router.post('/send-login-otp', authController.sendLoginOtp);

// Session-Protected Endpoints
router.get('/me', requireAuth, authController.getMe);
router.post('/logout', authController.logout);
router.post('/token', requireAuth, authController.issueToken);

// JWT-Protected Endpoints
router.get('/protected', requireJWT, authController.getProtected);

module.exports = router;
