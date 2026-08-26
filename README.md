# SecureID — Enterprise IAM Authentication System (Part 1 & Part 2)

A robust, enterprise-grade Identity & Access Management (IAM) authentication system built with **Node.js, Express, Prisma ORM (SQLite), and Vanilla HTML5/CSS3/JavaScript**.

---

## 🌟 Capabilities & Features

### Part 1: Registration & MFA Enrollment
* **User Registration**: Multi-field input validation (Name, Email, Mobile, Password with live requirements checklist, Confirm Password).
* **Cryptographic Security**: Passwords hashed with `bcryptjs` (salt rounds: 10). 6-digit OTPs generated with `crypto.randomInt`.
* **Database Hashing**: OTPs stored as HMAC-SHA256 hashes with server salt. Plaintext is never stored in the database.
* **Email & SMS OTP**: 5-minute expiry, single-use invalidation, attempt tracking with 5-attempt lockout, simulated console delivery.
* **MFA Enrollment**: Activates multi-factor authentication upon mobile SMS verification.

### Part 2: Login, Sessions, Lockout & JWT Authentication
* **Credential Validation**: Validates user credentials with protection against timing/enumeration attacks.
* **Account Lockout Policy**: Automatically locks accounts for 15 minutes after 5 consecutive failed login attempts (`ACCOUNT_LOCKED`).
* **Login MFA Flow**: Detects `mfaEnabled`, issues single-use login OTP challenge, verifies OTP, and logs simulated login delivery.
* **Server-Side Session Management**: Creates session in database with `HttpOnly`, `SameSite=lax`, and `Secure` (production) cookie. Supports "Remember Me" (extended 30-day session lifetime vs 24-hour default).
* **Session Profile API (`GET /api/me`)**: Returns authenticated user profile or `401 Unauthorized` if unauthenticated.
* **Secure Logout (`POST /api/logout`)**: Invalidates server-side session and clears the cookie.
* **Stateless JWT Token Issuance (`POST /api/token`)**: Issues signed, short-lived (15-minute) JWT tokens for authenticated users.
* **JWT-Protected API (`GET /api/protected`)**: Requires `Authorization: Bearer <token>`, validating signature and expiration.
* **Interactive Frontend Dashboard**: Live user profile viewer and interactive JWT generation & API tester widget.

---

## 📁 Project Structure

```
Truly IAS/
├── backend/
│   ├── server.js                      # Express server with cookie-parser and static hosting
│   ├── routes/
│   │   ├── registrationRoutes.js      # Part 1 Registration routes
│   │   └── authRoutes.js              # Part 2 Login, MFA, Session & JWT routes
│   ├── controllers/
│   │   ├── registrationController.js  # Registration controller
│   │   └── authController.js          # Login, MFA, Session, Me, Logout & JWT controller
│   ├── services/
│   │   ├── prisma.js                  # Shared Prisma client (/tmp SQLite serverless support)
│   │   ├── otpService.js              # Crypto OTP generation & hash verification
│   │   ├── sessionService.js          # Server session DB management & cookie options
│   │   └── jwtService.js              # JWT signing & Bearer verification
│   ├── middleware/
│   │   ├── authMiddleware.js          # requireAuth session validator
│   │   ├── jwtMiddleware.js           # requireJWT Bearer token validator
│   │   ├── validation.js              # Payload validation middleware
│   │   └── errorHandler.js            # Standardized error response handler
│   └── utils/
│       ├── otp.js                     # Secure random digit generator
│       └── hashing.js                 # Bcrypt & SHA-256 HMAC hashing
│
├── frontend/
│   ├── index.html                     # Responsive UI matching SecureID design
│   ├── css/
│   │   └── styles.css                 # Modern CSS design system
│   └── js/
│       ├── api.js                     # Fetch API client
│       ├── validation.js              # Password & input validation helpers
│       ├── registration.js            # Registration multi-step state machine
│       ├── auth.js                    # Login, MFA, Dashboard & JWT tester
│       └── app.js                     # App initialization & navigation
│
├── prisma/
│   ├── schema.prisma                  # User, Session, and OtpChallenge models
│   └── dev.db                         # SQLite database
│
├── tests/
│   ├── registrationFlow.test.js       # 13 Registration test suites
│   └── loginFlow.test.js              # 15 Login, MFA, Session & JWT test suites
├── vercel.json                        # Vercel deployment configuration
├── .env
├── .gitignore
└── package.json
```

---

## 📡 API Endpoints

### Registration (Part 1)
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/register` | Register user and issue email OTP challenge |
| `POST` | `/api/send-email-otp` | Resend email OTP (resets attempts & 5-min timer) |
| `POST` | `/api/verify-email-otp` | Verify email OTP & transition to SMS OTP |
| `POST` | `/api/send-sms-otp` | Resend SMS OTP (resets attempts & 5-min timer) |
| `POST` | `/api/verify-sms-otp` | Verify SMS OTP & enable MFA |
| `GET`  | `/api/test/otp/:challengeId` | Dev-only test OTP retrieval (`NODE_ENV !== 'production'`) |

### Login, MFA, Session & JWT (Part 2)
| Method | Endpoint | Auth Required | Description |
|---|---|---|---|
| `POST` | `/api/login` | None | Validate credentials, check lockout, issue MFA or session |
| `POST` | `/api/verify-login-otp` | None | Verify login OTP & create session with cookie |
| `POST` | `/api/send-login-otp` | None | Resend login OTP |
| `GET`  | `/api/me` | Session Cookie | Return authenticated user details |
| `POST` | `/api/logout` | Session Cookie | Invalidate session & clear cookie |
| `POST` | `/api/token` | Session Cookie | Issue 15-minute JWT access token |
| `GET`  | `/api/protected` | Bearer JWT | Access JWT-protected resource |

---

## 🧪 Running Automated Tests

Run all 28 automated integration & security test suites:

```bash
npm test
# Or run individually:
node tests/loginFlow.test.js
node tests/registrationFlow.test.js
```

---

## 🚀 Running Locally

```bash
npm start
```
Navigate to **[http://localhost:5000](http://localhost:5000)** in your browser.
