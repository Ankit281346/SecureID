/**
 * Main Application Event Handlers & Orchestration
 */

document.addEventListener('DOMContentLoaded', () => {
  const flow = window.registrationFlow;
  const api = window.api;
  const validation = window.validation;

  // Screen 1: Register Form Elements
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

  // Screen 2: Email OTP Elements
  const btnVerifyEmail = document.getElementById('btn-verify-email');
  const btnResendEmail = document.getElementById('btn-resend-email');
  const btnResendExpiredEmail = document.getElementById('btn-resend-expired-email');

  // Screen 3: SMS OTP Elements
  const btnVerifySms = document.getElementById('btn-verify-sms');
  const btnResendSms = document.getElementById('btn-resend-sms');
  const btnResendExpiredSms = document.getElementById('btn-resend-expired-sms');
  const linkChangeNumber = document.getElementById('link-change-number');

  // Screen 4 & 5: MFA Flow Elements
  const btnMfaContinue = document.getElementById('btn-mfa-continue');
  const btnQrBack = document.getElementById('btn-qr-back');
  const btnQrContinue = document.getElementById('btn-qr-continue');
  const btnVerifyMfaCode = document.getElementById('btn-verify-mfa-code');

  // Screen 7 & Modal Elements
  const btnContinueLogin = document.getElementById('btn-continue-login');
  const linkLogin = document.getElementById('link-login');
  const modalLoginNotice = document.getElementById('modal-login-notice');
  const btnModalClose = document.getElementById('btn-modal-close');

  // Dev Toolbar
  const devToolbar = document.getElementById('dev-toolbar');
  const devToolbarToggle = document.getElementById('dev-toolbar-toggle');
  const btnAutofillOtp = document.getElementById('btn-autofill-otp');

  // ------------------------------------------------------------------------
  // 1. Password Strength Live Checklist
  // ------------------------------------------------------------------------
  inputPassword.addEventListener('input', (e) => {
    const rules = validation.checkPasswordRules(e.target.value);
    
    const setRule = (el, isValid) => {
      if (isValid) el.classList.add('valid');
      else el.classList.remove('valid');
    };

    setRule(ruleLength, rules.length);
    setRule(ruleUppercase, rules.uppercase);
    setRule(ruleNumber, rules.number);
    setRule(ruleSpecial, rules.special);
  });

  // Password visibility toggle
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

  // ------------------------------------------------------------------------
  // 2. Submit Registration Form
  // ------------------------------------------------------------------------
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

  // ------------------------------------------------------------------------
  // 3. Verify Email OTP
  // ------------------------------------------------------------------------
  async function handleVerifyEmail() {
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
  }

  btnVerifyEmail.addEventListener('click', handleVerifyEmail);

  // Resend Email OTP
  async function handleResendEmail() {
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
  }

  btnResendEmail.addEventListener('click', handleResendEmail);
  btnResendExpiredEmail.addEventListener('click', handleResendEmail);

  // ------------------------------------------------------------------------
  // 4. Verify SMS OTP
  // ------------------------------------------------------------------------
  async function handleVerifySms() {
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

      // Advance to MFA Setup Options
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
  }

  btnVerifySms.addEventListener('click', handleVerifySms);

  // Resend SMS OTP
  async function handleResendSms() {
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
  }

  btnResendSms.addEventListener('click', handleResendSms);
  btnResendExpiredSms.addEventListener('click', handleResendSms);

  linkChangeNumber.addEventListener('click', (e) => {
    e.preventDefault();
    flow.goToScreen('screen-register');
  });

  // ------------------------------------------------------------------------
  // 5. MFA Setup Options & QR Code Flow
  // ------------------------------------------------------------------------
  document.querySelectorAll('.mfa-option-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.mfa-option-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      const radio = card.querySelector('input[type="radio"]');
      if (radio) {
        radio.checked = true;
        flow.state.selectedMfaMethod = radio.value;
      }
    });
  });

  btnMfaContinue.addEventListener('click', () => {
    if (flow.state.selectedMfaMethod === 'authenticator') {
      flow.goToScreen('screen-mfa-qr');
    } else {
      flow.goToScreen('screen-success');
    }
  });

  btnQrBack.addEventListener('click', () => {
    flow.goToScreen('screen-mfa-options');
  });

  btnQrContinue.addEventListener('click', () => {
    flow.goToScreen('screen-mfa-code');
  });

  // MFA 6-digit Code verify
  btnVerifyMfaCode.addEventListener('click', () => {
    const code = flow.getOtpValue('mfa-otp-grid');
    if (code.length !== 6) {
      flow.showError('mfa', { main: 'Invalid code. Please try again.' });
      return;
    }
    // Advance to Success
    flow.goToScreen('screen-success');
  });

  // ------------------------------------------------------------------------
  // 6. Success Screen & Login Notice Dialog
  // ------------------------------------------------------------------------
  const showLoginNotice = () => {
    if (modalLoginNotice) {
      if (typeof modalLoginNotice.showModal === 'function') {
        modalLoginNotice.showModal();
      } else {
        alert('Login will be implemented in Part 2.');
      }
    }
  };

  btnContinueLogin.addEventListener('click', showLoginNotice);
  linkLogin.addEventListener('click', (e) => {
    e.preventDefault();
    showLoginNotice();
  });

  if (btnModalClose) {
    btnModalClose.addEventListener('click', () => {
      modalLoginNotice.close();
    });
  }

  // ------------------------------------------------------------------------
  // 7. Dev Toolbar Autofill
  // ------------------------------------------------------------------------
  devToolbarToggle.addEventListener('click', () => {
    const body = document.getElementById('dev-toolbar-body');
    const toggleBtn = devToolbarToggle.querySelector('.dev-btn-toggle');
    const isHidden = body.classList.toggle('hidden');
    toggleBtn.textContent = isHidden ? '▼' : '▲';
  });

  btnAutofillOtp.addEventListener('click', async () => {
    if (!flow.state.challengeId) return;
    const data = await api.getDevOtp(flow.state.challengeId);
    if (data && data.otp) {
      let gridId = 'email-otp-grid';
      if (flow.state.currentStep === 'screen-sms-otp') gridId = 'sms-otp-grid';
      else if (flow.state.currentStep === 'screen-mfa-code') gridId = 'mfa-otp-grid';

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
});
