# IAM Authentication & Registration — Part 1

A clean, robust, and production-grade implementation of the **Registration + Email OTP + SMS OTP + MFA Verification** flow for an Identity and Access Management (IAM) system.

---

## 🚀 Features

* **Strict Part 1 Scope**: Implements only Registration, Email OTP verification, SMS OTP verification, and MFA enablement. No Login, JWT, sessions, or password reset functionality is present.
* **Modern Secure Frontend**: Built with responsive HTML5, modern CSS3 (matching SecureID design specification), and modular Vanilla JavaScript using the Fetch API.
* **Security & Cryptography**:
  * Passwords hashed with `bcryptjs` (salt rounds: 10).
  * 6-digit OTPs generated using Node.js `crypto.randomInt` (cryptographically secure, never `Math.random`).
  * OTPs stored in database as SHA-256 HMAC hashes with server salt. Plaintext OTP is never stored in the database.
  * OTPs expire in **5 minutes**.
  * Maximum **5 verification attempts** with lockout.
  * Single-use OTP: invalidates immediately upon successful verification.
* **Simulated Multi-Channel Delivery**:
  * Email & SMS deliveries are simulated with clean server console output.
  * Non-production endpoint `GET /api/test/otp/:challengeId` allows dev test retrieval from an in-memory store (automatically blocked with `403 Forbidden` in production).
* **Persistent SQLite Database**: Managed via **Prisma ORM**.

---

## 📁 Project Architecture

```
Truly IAS/
├── backend/
│   ├── server.js                      # Express server & static asset host
│   ├── routes/
│   │   └── registrationRoutes.js      # REST API route definitions
│   ├── controllers/
│   │   └── registrationController.js  # Controller actions
│   ├── services/
│   │   ├── prisma.js                  # Shared Prisma client instance
│   │   └── otpService.js              # Secure OTP generation, hashing & attempts
│   ├── middleware/
│   │   ├── validation.js              # Payload & password complexity validation
│   │   └── errorHandler.js            # Standardized JSON error handler
│   └── utils/
│       ├── otp.js                     # Crypto-based OTP generator
│       └── hashing.js                 # Bcrypt & SHA-256 HMAC hashing
│
├── frontend/
│   ├── index.html                     # Multi-step UI matching SecureID specs
│   ├── css/
│   │   └── styles.css                 # Responsive styles & animations
│   └── js/
│       ├── app.js                     # UI controller & event listeners
│       ├── api.js                     # Fetch API client
│       ├── validation.js              # Live password validation helper
│       └── registration.js            # Stepper & OTP timer state machine
│
├── prisma/
│   ├── schema.prisma                  # User and OtpChallenge models
│   └── dev.db                         # SQLite database
│
├── tests/
│   └── registrationFlow.test.js       # 13 comprehensive end-to-end test suites
├── .env
├── .gitignore
└── package.json
```

---

## 🛠️ Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Push Database Schema
```bash
npx prisma db push
```

### 3. Run Automated Tests
```bash
npm test
```

### 4. Start the Application
```bash
npm start
```
Open your browser and navigate to:
```
http://localhost:5000
```

---

## 🔄 Exact Registration Journey

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Registration Details Form (Name, Email, Phone, Password) │
└──────────────────────────────┬──────────────────────────────┘
                               │ POST /api/register
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Email OTP Challenge Generated (Expires: 5 mins)          │
│    - Console logs [SIMULATED EMAIL]                         │
│    - User enters 6-digit Email OTP                          │
└──────────────────────────────┬──────────────────────────────┘
                               │ POST /api/verify-email-otp
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Email Verified (emailVerified = true)                    │
│    - SMS OTP Challenge Generated (Expires: 5 mins)          │
│    - Console logs [SIMULATED SMS]                           │
│    - User enters 6-digit SMS OTP                            │
└──────────────────────────────┬──────────────────────────────┘
                               │ POST /api/verify-sms-otp
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Phone Verified & MFA Enabled                             │
│    - phoneVerified = true                                   │
│    - mfaEnabled = true                                      │
│    - Displays Registration Success Screen                   │
│    - "Continue to Login" Button (Login slated for Part 2)   │
└─────────────────────────────────────────────────────────────┘
```

---

## 📡 API Endpoints Summary

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/register` | Register user and issue email OTP challenge |
| `POST` | `/api/send-email-otp` | Resend email OTP (resets attempts & 5-min timer) |
| `POST` | `/api/verify-email-otp` | Verify email OTP & transition to SMS OTP |
| `POST` | `/api/send-sms-otp` | Resend SMS OTP (resets attempts & 5-min timer) |
| `POST` | `/api/verify-sms-otp` | Verify SMS OTP & enable MFA |
| `GET`  | `/api/test/otp/:challengeId` | Dev-only test OTP inspection (`NODE_ENV !== 'production'`) |
