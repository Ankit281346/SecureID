/**
 * Authentication & Login Flow Manager (Part 2)
 */

class AuthFlow {
  constructor() {
    this.state = {
      challengeId: null,
      email: '',
      method: 'email',
      rememberMe: true,
      jwtToken: null,
      currentUser: null
    };

    this.expiryInterval = null;
    this.resendInterval = null;
    this.resendCooldownSeconds = 25;

    this.initLoginOtpGrid();
  }

  initLoginOtpGrid() {
    const container = document.getElementById('login-mfa-otp-grid');
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
  }

  getLoginOtpValue() {
    const container = document.getElementById('login-mfa-otp-grid');
    if (!container) return '';
    return Array.from(container.querySelectorAll('.box-digit')).map(i => i.value).join('');
  }

  clearLoginOtpInputs() {
    const container = document.getElementById('login-mfa-otp-grid');
    if (!container) return;
    const inputs = container.querySelectorAll('.box-digit');
    inputs.forEach(i => {
      i.value = '';
      i.classList.remove('error');
    });
    if (inputs[0]) inputs[0].focus();
  }

  setLoginOtpError() {
    const container = document.getElementById('login-mfa-otp-grid');
    if (!container) return;
    container.querySelectorAll('.box-digit').forEach(i => i.classList.add('error'));
  }

  showLoginError(message) {
    const banner = document.getElementById('login-error-banner');
    const textEl = document.getElementById('login-error-text');
    const emailInput = document.getElementById('login-email');
    const pwdInput = document.getElementById('login-password');
    const badge = document.getElementById('login-icon-badge');

    if (banner && textEl) {
      textEl.textContent = message || 'Invalid email or password. Please try again.';
      banner.classList.remove('hidden');
    }

    if (emailInput) emailInput.classList.add('input-error');
    if (pwdInput) pwdInput.classList.add('input-error');

    if (badge) {
      badge.className = 'round-badge red-badge';
    }
  }

  hideLoginError() {
    const banner = document.getElementById('login-error-banner');
    const emailInput = document.getElementById('login-email');
    const pwdInput = document.getElementById('login-password');
    const badge = document.getElementById('login-icon-badge');

    if (banner) banner.classList.add('hidden');
    if (emailInput) emailInput.classList.remove('input-error');
    if (pwdInput) pwdInput.classList.remove('input-error');

    if (badge) {
      badge.className = 'round-badge blue-badge';
    }
  }

  goToView(viewId) {
    document.querySelectorAll('.screen-view').forEach(v => v.classList.remove('active'));
    const target = document.getElementById(viewId);
    if (target) target.classList.add('active');

    const card = document.getElementById('auth-main-card');
    const regTopBar = document.getElementById('reg-top-bar');

    // Switch card modes cleanly
    if (viewId === 'view-login' || viewId === 'view-login-mfa-choose' || viewId === 'view-login-mfa-otp') {
      if (card) card.className = 'auth-main-card login-mode';
      if (regTopBar) regTopBar.classList.add('hidden');
    } else if (viewId === 'view-dashboard') {
      if (card) card.className = 'auth-main-card dashboard-mode';
      if (regTopBar) regTopBar.classList.add('hidden');
    } else {
      // Registration screens
      if (card) card.className = 'auth-main-card full-mode';
      if (regTopBar) regTopBar.classList.remove('hidden');
    }

    if (viewId === 'view-login-mfa-otp') {
      document.getElementById('login-mfa-target-text').textContent = this.state.email;
      this.clearLoginOtpInputs();
      this.hideMfaError();
      this.startExpiryTimer();
      this.startResendCooldown();
      this.updateDevPanel();
    } else if (viewId === 'view-dashboard') {
      this.stopTimers();
      this.clearDevPanel();
    }
  }

  startExpiryTimer() {
    if (this.expiryInterval) clearInterval(this.expiryInterval);
    const countdownEl = document.getElementById('login-mfa-countdown');
    if (!countdownEl) return;

    let targetTime = Date.now() + 5 * 60 * 1000;

    const update = () => {
      const diff = targetTime - Date.now();
      if (diff <= 0) {
        clearInterval(this.expiryInterval);
        countdownEl.textContent = '00:00';
        this.showMfaExpired();
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

  startResendCooldown() {
    if (this.resendInterval) clearInterval(this.resendInterval);
    const btn = document.getElementById('btn-resend-login-otp');
    const textEl = document.getElementById('login-mfa-cooldown-text');
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

  showMfaError({ main, sub }) {
    const errorBox = document.getElementById('login-mfa-error-box');
    const mainEl = document.getElementById('login-mfa-err-main');
    const subEl = document.getElementById('login-mfa-err-sub');
    const badge = document.getElementById('login-mfa-badge-icon');

    if (errorBox && mainEl) {
      mainEl.textContent = main || 'Incorrect code. Please try again.';
      if (subEl) subEl.textContent = sub || '';
      errorBox.classList.remove('hidden');
    }

    if (badge) {
      badge.className = 'round-badge red-badge';
    }

    this.setLoginOtpError();
  }

  hideMfaError() {
    const errorBox = document.getElementById('login-mfa-error-box');
    if (errorBox) errorBox.classList.add('hidden');

    const badge = document.getElementById('login-mfa-badge-icon');
    if (badge) {
      badge.className = 'round-badge blue-badge';
    }

    const verifyBtn = document.getElementById('btn-verify-login-otp');
    const resendExpBtn = document.getElementById('btn-resend-expired-login-otp');
    if (verifyBtn) verifyBtn.classList.remove('hidden');
    if (resendExpBtn) resendExpBtn.classList.add('hidden');
  }

  showMfaExpired() {
    this.showMfaError({
      main: 'Code expired.',
      sub: 'Please request a new code.'
    });

    const verifyBtn = document.getElementById('btn-verify-login-otp');
    const resendExpBtn = document.getElementById('btn-resend-expired-login-otp');
    if (verifyBtn) verifyBtn.classList.add('hidden');
    if (resendExpBtn) resendExpBtn.classList.remove('hidden');
  }

  showMfaMaxAttempts() {
    this.showMfaError({
      main: 'Maximum attempts reached.',
      sub: 'Please request a new code.'
    });

    const verifyBtn = document.getElementById('btn-verify-login-otp');
    const resendExpBtn = document.getElementById('btn-resend-expired-login-otp');
    if (verifyBtn) verifyBtn.classList.add('hidden');
    if (resendExpBtn) resendExpBtn.classList.remove('hidden');
  }

  async loadDashboard() {
    try {
      const meData = await window.api.getMe();
      if (meData && meData.authenticated && meData.user) {
        this.state.currentUser = meData.user;
        document.getElementById('dash-user-name').textContent = meData.user.name || 'User';
        document.getElementById('dash-user-email').textContent = meData.user.email || '—';
        document.getElementById('dash-user-mfa').textContent = meData.user.mfaEnabled ? 'Enabled' : 'Disabled';

        // Reset JWT tester display
        this.state.jwtToken = null;
        document.getElementById('btn-test-protected').disabled = true;
        document.getElementById('jwt-terminal').classList.add('hidden');

        this.goToView('view-dashboard');
      } else {
        this.goToView('view-login');
      }
    } catch (err) {
      this.goToView('view-login');
    }
  }

  async updateDevPanel() {
    const codeEl = document.getElementById('dev-otp-code');
    const loginChipVal = document.getElementById('login-sim-val');
    if (!this.state.challengeId) return;

    const data = await window.api.getDevOtp(this.state.challengeId);
    if (data && data.otp) {
      if (codeEl) codeEl.textContent = data.otp;
      if (loginChipVal) loginChipVal.textContent = data.otp;
    } else {
      if (codeEl) codeEl.textContent = '— — — — — —';
      if (loginChipVal) loginChipVal.textContent = 'Check Terminal Logs';
    }
  }

  clearDevPanel() {
    const codeEl = document.getElementById('dev-otp-code');
    if (codeEl) codeEl.textContent = 'Logged In ✓';
  }
}

window.authFlow = new AuthFlow();
