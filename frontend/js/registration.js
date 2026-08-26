/**
 * Registration & Multi-step OTP Flow Controller
 */

class RegistrationFlow {
  constructor() {
    this.state = {
      userId: null,
      challengeId: null,
      currentStep: 'view-register',
      email: 'priya.sharma@email.com',
      phone: '+91 98765 43210',
      expiresAt: null,
      selectedMfaMethod: 'authenticator'
    };

    this.expiryInterval = null;
    this.resendInterval = null;
    this.resendCooldownSeconds = 25;

    this.initOtpGrids();
  }

  initOtpGrids() {
    ['email-otp-grid', 'sms-otp-grid'].forEach(gridId => {
      const container = document.getElementById(gridId);
      if (!container) return;

      const inputs = container.querySelectorAll('.box-digit');

      inputs.forEach((input, index) => {
        input.addEventListener('input', (e) => {
          const val = e.target.value.replace(/[^0-9]/g, '');
          e.target.value = val ? val.slice(-1) : '';

          inputs.forEach(i => i.classList.remove('error'));

          if (val && index < inputs.length - 1) {
            inputs[index + 1].focus();
          }
        });

        input.addEventListener('keydown', (e) => {
          if (e.key === 'Backspace') {
            if (!input.value && index > 0) {
              inputs[index - 1].focus();
              inputs[index - 1].value = '';
            } else {
              input.value = '';
            }
          } else if (e.key === 'ArrowLeft' && index > 0) {
            inputs[index - 1].focus();
          } else if (e.key === 'ArrowRight' && index < inputs.length - 1) {
            inputs[index + 1].focus();
          }
        });

        input.addEventListener('paste', (e) => {
          e.preventDefault();
          const pasteData = (e.clipboardData || window.clipboardData).getData('text');
          const digits = pasteData.replace(/\D/g, '').slice(0, 6).split('');

          if (digits.length > 0) {
            inputs.forEach(i => i.classList.remove('error'));
            digits.forEach((d, i) => {
              if (inputs[i]) inputs[i].value = d;
            });
            const nextFocus = Math.min(digits.length, inputs.length - 1);
            inputs[nextFocus].focus();
          }
        });
      });
    });
  }

  getOtpValue(gridId) {
    const container = document.getElementById(gridId);
    if (!container) return '';
    return Array.from(container.querySelectorAll('.box-digit')).map(i => i.value).join('');
  }

  clearOtpInputs(gridId) {
    const container = document.getElementById(gridId);
    if (!container) return;
    const inputs = container.querySelectorAll('.box-digit');
    inputs.forEach(i => {
      i.value = '';
      i.classList.remove('error');
    });
    if (inputs[0]) inputs[0].focus();
  }

  setOtpError(gridId) {
    const container = document.getElementById(gridId);
    if (!container) return;
    container.querySelectorAll('.box-digit').forEach(i => i.classList.add('error'));
  }

  /**
   * Transition to screen
   */
  goToScreen(screenId) {
    if (screenId === 'screen-register') {
      screenId = 'view-register';
    }

    this.state.currentStep = screenId;
    document.querySelectorAll('.screen-view').forEach(s => s.classList.remove('active'));

    const activeEl = document.getElementById(screenId);
    if (activeEl) activeEl.classList.add('active');

    const card = document.getElementById('auth-main-card');
    const regTopBar = document.getElementById('reg-top-bar');

    // Registration screens always use full-mode layout
    if (card) card.className = 'auth-main-card full-mode';
    if (regTopBar) regTopBar.classList.remove('hidden');

    // Update 5-Step Stepper
    let stepNum = 1;
    if (screenId === 'view-register' || screenId === 'screen-register') stepNum = 1;
    else if (screenId === 'screen-email-otp') stepNum = 2;
    else if (screenId === 'screen-sms-otp') stepNum = 3;
    else if (screenId.startsWith('screen-mfa')) stepNum = 4;
    else if (screenId === 'screen-success') stepNum = 5;

    document.querySelectorAll('.step-node').forEach(node => {
      const num = parseInt(node.getAttribute('data-step'), 10);
      node.classList.remove('active', 'completed');
      if (num === stepNum) node.classList.add('active');
      else if (num < stepNum) node.classList.add('completed');
    });

    document.querySelectorAll('.step-connector').forEach(conn => {
      const num = parseInt(conn.getAttribute('data-connector'), 10);
      conn.classList.remove('completed');
      if (num < stepNum) conn.classList.add('completed');
    });

    // Screen specific setups
    if (screenId === 'screen-email-otp') {
      document.getElementById('email-target-text').textContent = this.state.email;
      this.clearOtpInputs('email-otp-grid');
      this.hideError('email');
      this.startExpiryTimer('email');
      this.startResendCooldown('email');
      this.updateDevPanel();
    } else if (screenId === 'screen-sms-otp') {
      document.getElementById('sms-target-text').textContent = this.state.phone;
      this.clearOtpInputs('sms-otp-grid');
      this.hideError('sms');
      this.startExpiryTimer('sms');
      this.startResendCooldown('sms');
      this.updateDevPanel();
    } else if (screenId === 'screen-success') {
      this.stopTimers();
      this.clearDevPanel();
    }
  }

  startExpiryTimer(channel) {
    if (this.expiryInterval) clearInterval(this.expiryInterval);
    const countdownEl = document.getElementById(`${channel}-countdown`);
    if (!countdownEl) return;

    let targetTime = this.state.expiresAt ? new Date(this.state.expiresAt).getTime() : Date.now() + 5 * 60 * 1000;

    const update = () => {
      const diff = targetTime - Date.now();
      if (diff <= 0) {
        clearInterval(this.expiryInterval);
        countdownEl.textContent = '00:00';
        this.showExpiredState(channel);
        return;
      }
      const totalSec = Math.floor(diff / 1000);
      const mins = Math.floor(totalSec / 60).toString().padStart(2, '0');
      const secs = (totalSec % 60).toString().padStart(2, '0');
      countdownEl.textContent = `${mins}:${secs}`;
    };

    update();
    this.expiryInterval = setInterval(update, 1000);
  }

  startResendCooldown(channel) {
    if (this.resendInterval) clearInterval(this.resendInterval);
    const btn = document.getElementById(`btn-resend-${channel}`);
    const textEl = document.getElementById(`${channel}-cooldown-text`);
    if (!btn || !textEl) return;

    let remaining = this.resendCooldownSeconds;
    btn.disabled = true;
    textEl.textContent = `(00:${remaining.toString().padStart(2, '0')})`;
    textEl.classList.remove('hidden');

    this.resendInterval = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(this.resendInterval);
        btn.disabled = false;
        textEl.classList.add('hidden');
      } else {
        textEl.textContent = `(00:${remaining.toString().padStart(2, '0')})`;
      }
    }, 1000);
  }

  stopTimers() {
    if (this.expiryInterval) clearInterval(this.expiryInterval);
    if (this.resendInterval) clearInterval(this.resendInterval);
  }

  showError(channel, { main, sub }) {
    const errorBox = document.getElementById(`${channel}-error-box`);
    const mainEl = document.getElementById(`${channel}-err-main`);
    const subEl = document.getElementById(`${channel}-err-sub`);
    const badge = document.getElementById(`${channel}-badge-icon`);

    if (errorBox && mainEl) {
      mainEl.textContent = main;
      if (subEl) subEl.textContent = sub || '';
      errorBox.classList.remove('hidden');
    }

    if (badge) {
      badge.className = 'round-icon-badge red-badge';
    }

    this.setOtpError(`${channel}-otp-grid`);
  }

  hideError(channel) {
    const errorBox = document.getElementById(`${channel}-error-box`);
    if (errorBox) errorBox.classList.add('hidden');

    const badge = document.getElementById(`${channel}-badge-icon`);
    if (badge) {
      badge.className = channel === 'sms' ? 'round-icon-badge green-badge' : 'round-icon-badge blue-badge';
    }

    const verifyBtn = document.getElementById(`btn-verify-${channel}`);
    const resendExpBtn = document.getElementById(`btn-resend-expired-${channel}`);
    if (verifyBtn) verifyBtn.classList.remove('hidden');
    if (resendExpBtn) resendExpBtn.classList.add('hidden');
  }

  showExpiredState(channel) {
    this.showError(channel, {
      main: 'This code has expired.',
      sub: 'Please request a new code.'
    });

    const verifyBtn = document.getElementById(`btn-verify-${channel}`);
    const resendExpBtn = document.getElementById(`btn-resend-expired-${channel}`);
    if (verifyBtn) verifyBtn.classList.add('hidden');
    if (resendExpBtn) resendExpBtn.classList.remove('hidden');
  }

  showMaxAttemptsState(channel) {
    this.showError(channel, {
      main: 'Maximum attempts reached.',
      sub: 'Please request a new code.'
    });

    const verifyBtn = document.getElementById(`btn-verify-${channel}`);
    const resendExpBtn = document.getElementById(`btn-resend-expired-${channel}`);
    if (verifyBtn) verifyBtn.classList.add('hidden');
    if (resendExpBtn) resendExpBtn.classList.remove('hidden');
  }

  async updateDevPanel(explicitOtp) {
    const codeEl = document.getElementById('dev-otp-code');
    const emailChipVal = document.getElementById('reg-email-sim-val');
    const smsChipVal = document.getElementById('reg-sms-sim-val');

    let otp = explicitOtp || this.state.devOtp;
    if (!otp && this.state.challengeId) {
      try {
        const data = await window.api.getDevOtp(this.state.challengeId);
        if (data && data.otp) otp = data.otp;
      } catch (e) {}
    }

    if (otp) {
      this.state.devOtp = otp;
      if (codeEl) codeEl.textContent = otp;
      if (emailChipVal) emailChipVal.textContent = otp;
      if (smsChipVal) smsChipVal.textContent = otp;
    } else {
      if (codeEl) codeEl.textContent = '— — — — — —';
      if (emailChipVal) emailChipVal.textContent = 'Check Terminal Logs';
      if (smsChipVal) smsChipVal.textContent = 'Check Terminal Logs';
    }
  }

  clearDevPanel() {
    const codeEl = document.getElementById('dev-otp-code');
    if (codeEl) codeEl.textContent = 'MFA Active ✓';
  }
}

window.registrationFlow = new RegistrationFlow();
