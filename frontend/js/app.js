/**
 * Main Application Entry & UI Orchestration (Part 1 + Part 2)
 */

document.addEventListener('DOMContentLoaded', async () => {
  const flow = window.registrationFlow;
  const authFlow = window.authFlow;
  const api = window.api;
  const validation = window.validation;

  // ------------------------------------------------------------------------
  // 0. App Startup: Check Active Session
  // ------------------------------------------------------------------------
  try {
    const currentUserData = await api.getMe();
    if (currentUserData && currentUserData.authenticated) {
      await authFlow.loadDashboard();
    } else {
      authFlow.goToView('view-login');
    }
  } catch (e) {
    authFlow.goToView('view-login');
  }

  // ------------------------------------------------------------------------
  // 1. Navigation Between Login & Registration
  // ------------------------------------------------------------------------
  const linkGoToRegister = document.getElementById('link-go-to-register');
  const linkLoginFromReg = document.getElementById('link-login-from-reg');
  const linkBackToLogin = document.getElementById('link-back-to-login');
  const btnContinueLoginFromSuccess = document.getElementById('btn-continue-login-from-success');

  if (linkGoToRegister) {
    linkGoToRegister.addEventListener('click', (e) => {
      e.preventDefault();
      flow.goToScreen('view-register');
    });
  }

  if (linkLoginFromReg) {
    linkLoginFromReg.addEventListener('click', (e) => {
      e.preventDefault();
      authFlow.goToView('view-login');
    });
  }

  if (linkBackToLogin) {
    linkBackToLogin.addEventListener('click', (e) => {
      e.preventDefault();
      authFlow.goToView('view-login');
    });
  }

  if (btnContinueLoginFromSuccess) {
    btnContinueLoginFromSuccess.addEventListener('click', () => {
      authFlow.goToView('view-login');
    });
  }

  // ------------------------------------------------------------------------
  // 2. Login Flow (Part 2)
  // ------------------------------------------------------------------------
  const formLogin = document.getElementById('form-login');
  const loginEmailInput = document.getElementById('login-email');
  const loginPasswordInput = document.getElementById('login-password');
  const toggleLoginPassword = document.getElementById('toggle-login-password');
  const loginRememberMe = document.getElementById('login-remember-me');
  const btnSubmitLogin = document.getElementById('btn-submit-login');

  // Toggle login password visibility
  if (toggleLoginPassword) {
    toggleLoginPassword.addEventListener('click', () => {
      const isPwd = loginPasswordInput.type === 'password';
      loginPasswordInput.type = isPwd ? 'text' : 'password';

      const eyeOpen = toggleLoginPassword.querySelector('.eye-open');
      const eyeClosed = toggleLoginPassword.querySelector('.eye-closed');
      if (isPwd) {
        eyeOpen.classList.add('hidden');
        eyeClosed.classList.remove('hidden');
      } else {
        eyeOpen.classList.remove('hidden');
        eyeClosed.classList.add('hidden');
      }
    });
  }

  // Submit Login
  if (formLogin) {
    formLogin.addEventListener('submit', async (e) => {
      e.preventDefault();
      authFlow.hideLoginError();

      const email = loginEmailInput.value.trim();
      const password = loginPasswordInput.value;
      const rememberMe = loginRememberMe ? loginRememberMe.checked : true;

      if (!email || !password) {
        authFlow.showLoginError('Please enter both email and password.');
        return;
      }

      btnSubmitLogin.disabled = true;
      btnSubmitLogin.textContent = 'Logging in...';

      try {
        const res = await api.login({ email, password, rememberMe });

        if (res.mfaRequired) {
          authFlow.state.challengeId = res.challengeId;
          authFlow.state.email = res.email || email;
          authFlow.state.rememberMe = rememberMe;

          // Transition to Choose MFA Method Screen
          authFlow.goToView('view-login-mfa-choose');
        } else if (res.authenticated) {
          await authFlow.loadDashboard();
        }
      } catch (err) {
        const data = err.data || {};
        if (data.error === 'ACCOUNT_LOCKED' || err.status === 423) {
          authFlow.showLoginError('Account temporarily locked. Please try again later.');
        } else {
          authFlow.showLoginError(data.message || 'Invalid email or password.');
        }
      } finally {
        btnSubmitLogin.disabled = false;
        btnSubmitLogin.textContent = 'Login';
      }
    });
  }

  // MFA Method Choice
  const mfaOptionCards = document.querySelectorAll('#view-login-mfa-choose .mfa-option-card');
  const btnLoginMfaContinue = document.getElementById('btn-login-mfa-continue');

  mfaOptionCards.forEach(card => {
    card.addEventListener('click', () => {
      mfaOptionCards.forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      const radio = card.querySelector('input[type="radio"]');
      if (radio) {
        radio.checked = true;
        authFlow.state.method = radio.value;
      }
    });
  });

  if (btnLoginMfaContinue) {
    btnLoginMfaContinue.addEventListener('click', () => {
      authFlow.goToView('view-login-mfa-otp');
    });
  }

  // Verify Login MFA OTP
  const btnVerifyLoginOtp = document.getElementById('btn-verify-login-otp');
  const btnResendLoginOtp = document.getElementById('btn-resend-login-otp');
  const btnResendExpiredLoginOtp = document.getElementById('btn-resend-expired-login-otp');

  if (btnVerifyLoginOtp) {
    btnVerifyLoginOtp.addEventListener('click', async () => {
      authFlow.hideMfaError();
      const otp = authFlow.getLoginOtpValue();

      if (otp.length !== 6) {
        authFlow.showMfaError({ main: 'Please enter all 6 digits.' });
        return;
      }

      btnVerifyLoginOtp.disabled = true;
      btnVerifyLoginOtp.textContent = 'Verifying...';

      try {
        const res = await api.verifyLoginOtp({
          challengeId: authFlow.state.challengeId,
          otp,
          rememberMe: authFlow.state.rememberMe
        });

        if (res.authenticated) {
          await authFlow.loadDashboard();
        }
      } catch (err) {
        const data = err.data || {};
        if (data.error === 'MAX_ATTEMPTS_EXCEEDED' || err.status === 429) {
          authFlow.showMfaMaxAttempts();
        } else if (data.error === 'OTP_EXPIRED') {
          authFlow.showMfaExpired();
        } else if (data.attemptsRemaining !== undefined) {
          authFlow.showMfaError({
            main: 'Incorrect code. Please try again.',
            sub: `You have ${data.attemptsRemaining} attempt${data.attemptsRemaining === 1 ? '' : 's'} left.`
          });
        } else {
          authFlow.showMfaError({ main: err.message });
        }
      } finally {
        btnVerifyLoginOtp.disabled = false;
        btnVerifyLoginOtp.textContent = 'Verify';
      }
    });
  }

  // Resend Login OTP
  const handleResendLoginOtp = async () => {
    btnResendLoginOtp.disabled = true;
    try {
      const res = await api.sendLoginOtp({
        challengeId: authFlow.state.challengeId
      });
      authFlow.state.challengeId = res.challengeId;
      authFlow.clearLoginOtpInputs();
      authFlow.hideMfaError();
      authFlow.startExpiryTimer();
      authFlow.startResendCooldown();
      authFlow.updateDevPanel();
    } catch (err) {
      alert(err.message || 'Failed to resend code.');
      btnResendLoginOtp.disabled = false;
    }
  };

  if (btnResendLoginOtp) btnResendLoginOtp.addEventListener('click', handleResendLoginOtp);
  if (btnResendExpiredLoginOtp) btnResendExpiredLoginOtp.addEventListener('click', handleResendLoginOtp);

  // ------------------------------------------------------------------------
  // 3. Dashboard, JWT & Logout (Part 2)
  // ------------------------------------------------------------------------
  const btnLogout = document.getElementById('btn-logout');
  const btnGenerateJwt = document.getElementById('btn-generate-jwt');
  const btnTestProtected = document.getElementById('btn-test-protected');
  const jwtTerminal = document.getElementById('jwt-terminal');
  const jwtTerminalLabel = document.getElementById('jwt-terminal-label');
  const jwtCodeOutput = document.getElementById('jwt-code-output');

  if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
      await api.logout();
      authFlow.state.currentUser = null;
      authFlow.state.jwtToken = null;
      authFlow.goToView('view-login');
    });
  }

  if (btnGenerateJwt) {
    btnGenerateJwt.addEventListener('click', async () => {
      try {
        btnGenerateJwt.disabled = true;
        btnGenerateJwt.textContent = 'Issuing Token...';
        const res = await api.getToken();
        authFlow.state.jwtToken = res.accessToken;

        jwtTerminalLabel.textContent = `JWT Access Token (Type: ${res.tokenType}, Expires in: ${res.expiresIn}s):`;
        jwtCodeOutput.textContent = res.accessToken;
        jwtTerminal.classList.remove('hidden');

        btnTestProtected.disabled = false;
      } catch (err) {
        alert(err.message || 'Failed to issue JWT token.');
      } finally {
        btnGenerateJwt.disabled = false;
        btnGenerateJwt.textContent = 'Generate JWT Token';
      }
    });
  }

  if (btnTestProtected) {
    btnTestProtected.addEventListener('click', async () => {
      if (!authFlow.state.jwtToken) return;
      try {
        btnTestProtected.disabled = true;
        btnTestProtected.textContent = 'Requesting...';
        const res = await api.getProtected(authFlow.state.jwtToken);

        jwtTerminalLabel.textContent = 'GET /api/protected Response (200 OK):';
        jwtCodeOutput.textContent = JSON.stringify(res, null, 2);
      } catch (err) {
        jwtTerminalLabel.textContent = 'GET /api/protected Response (Error):';
        jwtCodeOutput.textContent = JSON.stringify(err.data || { error: err.message }, null, 2);
      } finally {
        btnTestProtected.disabled = false;
        btnTestProtected.textContent = 'Test Protected Route';
      }
    });
  }

  // ------------------------------------------------------------------------
  // 4. Registration Flow Events (Part 1 Preserved)
  // ------------------------------------------------------------------------
  const formRegister = document.getElementById('form-register');
  const inputName = document.getElementById('reg-name');
  const inputEmail = document.getElementById('reg-email');
  const inputPhone = document.getElementById('reg-phone');
  const inputPassword = document.getElementById('reg-password');
  const btnCreateAccount = document.getElementById('btn-create-account');
  const togglePasswordBtn = document.getElementById('toggle-password');

  // Password Requirement Rows
  const ruleLength = document.getElementById('rule-length');
  const ruleUppercase = document.getElementById('rule-uppercase');
  const ruleNumber = document.getElementById('rule-number');
  const ruleSpecial = document.getElementById('rule-special');

  // Registration Email OTP
  const btnVerifyEmail = document.getElementById('btn-verify-email');
  const btnResendEmail = document.getElementById('btn-resend-email');
  const btnResendExpiredEmail = document.getElementById('btn-resend-expired-email');

  // Registration SMS OTP
  const btnVerifySms = document.getElementById('btn-verify-sms');
  const btnResendSms = document.getElementById('btn-resend-sms');
  const btnResendExpiredSms = document.getElementById('btn-resend-expired-sms');
  const btnMfaContinue = document.getElementById('btn-mfa-continue');

  if (inputPassword) {
    inputPassword.addEventListener('input', (e) => {
      const rules = validation.checkPasswordRules(e.target.value);
      const setRule = (el, isValid) => {
        if (!el) return;
        if (isValid) el.classList.add('valid');
        else el.classList.remove('valid');
      };
      setRule(ruleLength, rules.length);
      setRule(ruleUppercase, rules.uppercase);
      setRule(ruleNumber, rules.number);
      setRule(ruleSpecial, rules.special);
    });
  }

  if (togglePasswordBtn && inputPassword) {
    togglePasswordBtn.addEventListener('click', () => {
      const isPwd = inputPassword.type === 'password';
      inputPassword.type = isPwd ? 'text' : 'password';
      const eyeOpen = togglePasswordBtn.querySelector('.eye-open');
      const eyeClosed = togglePasswordBtn.querySelector('.eye-closed');
      if (isPwd) {
        eyeOpen.classList.add('hidden');
        eyeClosed.classList.remove('hidden');
      } else {
        eyeOpen.classList.remove('hidden');
        eyeClosed.classList.add('hidden');
      }
    });
  }

  if (formRegister) {
    formRegister.addEventListener('submit', async (e) => {
      e.preventDefault();
      document.querySelectorAll('.field-error').forEach(el => el.textContent = '');

      const name = inputName.value.trim();
      const email = inputEmail.value.trim();
      const rawPhone = inputPhone.value.trim().replace(/\D/g, '');
      const phone = `+91${rawPhone}`;
      const password = inputPassword.value;

      const valResult = validation.validateRegistrationForm({
        name,
        email,
        phone: rawPhone,
        password,
        confirmPassword: password
      });

      if (!valResult.isValid) {
        for (const [f, msg] of Object.entries(valResult.errors)) {
          const errEl = document.getElementById(`error-${f}`);
          if (errEl) errEl.textContent = msg;
        }
        return;
      }

      btnCreateAccount.disabled = true;
      btnCreateAccount.textContent = 'Creating Account...';

      try {
        const res = await api.register({
          name,
          email,
          phone,
          password,
          confirmPassword: password
        });

        flow.state.userId = res.userId;
        flow.state.challengeId = res.challengeId;
        flow.state.email = res.email;
        flow.state.phone = `+91 ${rawPhone.slice(0, 5)} ${rawPhone.slice(5)}`;
        flow.state.expiresAt = res.expiresAt;

        flow.goToScreen('screen-email-otp');
      } catch (err) {
        alert(err.message || 'Registration failed.');
      } finally {
        btnCreateAccount.disabled = false;
        btnCreateAccount.textContent = 'Create Account';
      }
    });
  }

  if (btnVerifyEmail) {
    btnVerifyEmail.addEventListener('click', async () => {
      flow.hideError('email');
      const otp = flow.getOtpValue('email-otp-grid');
      if (otp.length !== 6) {
        flow.showError('email', { main: 'Please enter all 6 digits.' });
        return;
      }
      btnVerifyEmail.disabled = true;
      btnVerifyEmail.textContent = 'Verifying...';

      try {
        const res = await api.verifyEmailOtp({
          challengeId: flow.state.challengeId,
          otp
        });
        flow.state.challengeId = res.challengeId;
        flow.state.expiresAt = res.expiresAt;
        flow.goToScreen('screen-sms-otp');
      } catch (err) {
        const data = err.data || {};
        if (data.code === 'MAX_ATTEMPTS_EXCEEDED' || err.status === 429) {
          flow.showMaxAttemptsState('email');
        } else if (data.code === 'OTP_EXPIRED') {
          flow.showExpiredState('email');
        } else if (data.attemptsRemaining !== undefined) {
          flow.showError('email', {
            main: 'Incorrect code. Please try again.',
            sub: `You have ${data.attemptsRemaining} attempt${data.attemptsRemaining === 1 ? '' : 's'} left.`
          });
        } else {
          flow.showError('email', { main: err.message });
        }
      } finally {
        btnVerifyEmail.disabled = false;
        btnVerifyEmail.textContent = 'Verify Email';
      }
    });
  }

  const handleResendEmailReg = async () => {
    btnResendEmail.disabled = true;
    try {
      const res = await api.sendEmailOtp({
        challengeId: flow.state.challengeId,
        userId: flow.state.userId
      });
      flow.state.challengeId = res.challengeId;
      flow.state.expiresAt = res.expiresAt;
      flow.clearOtpInputs('email-otp-grid');
      flow.hideError('email');
      flow.startExpiryTimer('email');
      flow.startResendCooldown('email');
      flow.updateDevPanel();
    } catch (err) {
      alert(err.message || 'Failed to resend code.');
      btnResendEmail.disabled = false;
    }
  };

  if (btnResendEmail) btnResendEmail.addEventListener('click', handleResendEmailReg);
  if (btnResendExpiredEmail) btnResendExpiredEmail.addEventListener('click', handleResendEmailReg);

  if (btnVerifySms) {
    btnVerifySms.addEventListener('click', async () => {
      flow.hideError('sms');
      const otp = flow.getOtpValue('sms-otp-grid');
      if (otp.length !== 6) {
        flow.showError('sms', { main: 'Please enter all 6 digits.' });
        return;
      }
      btnVerifySms.disabled = true;
      btnVerifySms.textContent = 'Verifying...';

      try {
        const res = await api.verifySmsOtp({
          challengeId: flow.state.challengeId,
          otp
        });
        flow.goToScreen('screen-mfa-options');
      } catch (err) {
        const data = err.data || {};
        if (data.code === 'MAX_ATTEMPTS_EXCEEDED' || err.status === 429) {
          flow.showMaxAttemptsState('sms');
        } else if (data.code === 'OTP_EXPIRED') {
          flow.showExpiredState('sms');
        } else if (data.attemptsRemaining !== undefined) {
          flow.showError('sms', {
            main: 'Incorrect code. Please try again.',
            sub: `You have ${data.attemptsRemaining} attempt${data.attemptsRemaining === 1 ? '' : 's'} left.`
          });
        } else {
          flow.showError('sms', { main: err.message });
        }
      } finally {
        btnVerifySms.disabled = false;
        btnVerifySms.textContent = 'Verify Mobile';
      }
    });
  }

  const handleResendSmsReg = async () => {
    btnResendSms.disabled = true;
    try {
      const res = await api.sendSmsOtp({
        challengeId: flow.state.challengeId,
        userId: flow.state.userId
      });
      flow.state.challengeId = res.challengeId;
      flow.state.expiresAt = res.expiresAt;
      flow.clearOtpInputs('sms-otp-grid');
      flow.hideError('sms');
      flow.startExpiryTimer('sms');
      flow.startResendCooldown('sms');
      flow.updateDevPanel();
    } catch (err) {
      alert(err.message || 'Failed to resend code.');
      btnResendSms.disabled = false;
    }
  };

  if (btnResendSms) btnResendSms.addEventListener('click', handleResendSmsReg);
  if (btnResendExpiredSms) btnResendExpiredSms.addEventListener('click', handleResendSmsReg);

  if (btnMfaContinue) {
    btnMfaContinue.addEventListener('click', () => {
      flow.goToScreen('screen-success');
    });
  }

  // ------------------------------------------------------------------------
  // 5. Forgot Password Dialog
  // ------------------------------------------------------------------------
  const linkForgotPassword = document.getElementById('link-forgot-password');
  const modalForgotPassword = document.getElementById('modal-forgot-password');
  const btnCloseForgot = document.getElementById('btn-close-forgot');
  const btnSubmitForgot = document.getElementById('btn-submit-forgot');

  if (linkForgotPassword && modalForgotPassword) {
    linkForgotPassword.addEventListener('click', (e) => {
      e.preventDefault();
      modalForgotPassword.showModal();
    });
  }

  if (btnCloseForgot && modalForgotPassword) {
    btnCloseForgot.addEventListener('click', () => {
      modalForgotPassword.close();
    });
  }

  if (btnSubmitForgot && modalForgotPassword) {
    btnSubmitForgot.addEventListener('click', () => {
      alert('If an account exists for this email, password reset instructions will be provided.');
      modalForgotPassword.close();
    });
  }

  // ------------------------------------------------------------------------
  // 6. Dev Toolbar Autofill
  // ------------------------------------------------------------------------
  const devToolbarToggle = document.getElementById('dev-toolbar-toggle');
  const btnAutofillOtp = document.getElementById('btn-autofill-otp');

  if (devToolbarToggle) {
    devToolbarToggle.addEventListener('click', () => {
      const body = document.getElementById('dev-toolbar-body');
      const toggleBtn = devToolbarToggle.querySelector('.dev-btn-toggle');
      const isHidden = body.classList.toggle('hidden');
      toggleBtn.textContent = isHidden ? '▼' : '▲';
    });
  }

  if (btnAutofillOtp) {
    btnAutofillOtp.addEventListener('click', async () => {
      const challengeId = authFlow.state.challengeId || flow.state.challengeId;
      if (!challengeId) return;
      const data = await api.getDevOtp(challengeId);
      if (data && data.otp) {
        let gridId = 'login-mfa-otp-grid';
        if (flow.state.currentStep === 'screen-email-otp') gridId = 'email-otp-grid';
        else if (flow.state.currentStep === 'screen-sms-otp') gridId = 'sms-otp-grid';

        const container = document.getElementById(gridId);
        if (container) {
          const inputs = container.querySelectorAll('.box-digit');
          data.otp.split('').forEach((d, i) => {
            if (inputs[i]) inputs[i].value = d;
          });
          if (inputs[5]) inputs[5].focus();
        }
      }
    });
  }
});
