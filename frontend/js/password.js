/**
 * Self-Contained Password Enhancement Module (password.js)
 * 
 * Handles all Password Enhancement features without requiring edits to other files:
 * 1. Automatically injects CSS for the strength bar & visual states.
 * 2. Dynamically mounts the strength indicator UI under the password input.
 * 3. Handles show/hide password toggle.
 * 4. Dynamically calculates strength (Weak / Medium / Strong) as user types.
 * 5. Prevents registration if the password does not meet the minimum strength requirement.
 */

(function () {
  'use strict';

  // --------------------------------------------------------------------------
  // 1. Inject Required CSS Styles into document.head
  // --------------------------------------------------------------------------
  function injectStyles() {
    if (document.getElementById('password-enhancement-styles')) return;

    const style = document.createElement('style');
    style.id = 'password-enhancement-styles';
    style.textContent = `
      /* Password Strength Meter */
      .password-strength-wrap {
        margin-top: 0.5rem;
        display: flex;
        flex-direction: column;
        gap: 0.3rem;
      }
      .strength-bar-track {
        width: 100%;
        height: 6px;
        background-color: #e2e8f0;
        border-radius: 9999px;
        overflow: hidden;
      }
      .strength-bar-fill {
        height: 100%;
        width: 0%;
        border-radius: 9999px;
        transition: width 0.3s ease, background-color 0.3s ease;
      }
      .strength-info-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-size: 0.75rem;
        color: #64748b;
      }
      .strength-text-badge {
        font-weight: 700;
        text-transform: capitalize;
        transition: color 0.3s ease;
      }

      /* 3 Visual States */
      .password-strength-wrap.state-weak .strength-bar-fill {
        width: 33.33%;
        background-color: #ef4444; /* Red */
      }
      .password-strength-wrap.state-weak .strength-text-badge {
        color: #ef4444;
      }

      .password-strength-wrap.state-medium .strength-bar-fill {
        width: 66.66%;
        background-color: #f59e0b; /* Amber */
      }
      .password-strength-wrap.state-medium .strength-text-badge {
        color: #f59e0b;
      }

      .password-strength-wrap.state-strong .strength-bar-fill {
        width: 100%;
        background-color: #10b981; /* Green */
      }
      .password-strength-wrap.state-strong .strength-text-badge {
        color: #10b981;
      }
    `;
    document.head.appendChild(style);
  }

  // --------------------------------------------------------------------------
  // 2. Strength Calculation Helper
  // --------------------------------------------------------------------------
  function calculateStrength(password) {
    const p = password || '';
    const rules = {
      length: p.length >= 8,
      uppercase: /[A-Z]/.test(p),
      number: /[0-9]/.test(p),
      special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(p)
    };

    const passed = Object.values(rules).filter(Boolean).length;

    if (!p || passed < 2 || !rules.length) {
      return { level: 'weak', label: 'Weak', isAcceptable: false, rules };
    }
    if (passed < 4) {
      return { level: 'medium', label: 'Medium', isAcceptable: false, rules };
    }
    return { level: 'strong', label: 'Strong', isAcceptable: true, rules };
  }

  // --------------------------------------------------------------------------
  // 3. Initialize UI & Event Handlers
  // --------------------------------------------------------------------------
  function initPasswordEnhancement() {
    injectStyles();

    const passwordInput = document.getElementById('reg-password');
    const toggleBtn = document.getElementById('toggle-password');
    const registerForm = document.getElementById('form-register');
    const passwordErrorEl = document.getElementById('error-password');

    if (!passwordInput) return;

    // A. Dynamically mount Strength Meter if not already present
    let meterWrap = document.getElementById('password-strength-wrap');
    if (!meterWrap) {
      meterWrap = document.createElement('div');
      meterWrap.id = 'password-strength-wrap';
      meterWrap.className = 'password-strength-wrap state-weak';
      meterWrap.innerHTML = `
        <div class="strength-bar-track">
          <div class="strength-bar-fill" id="strength-bar-fill"></div>
        </div>
        <div class="strength-info-row">
          <span>Password Strength:</span>
          <strong class="strength-text-badge" id="strength-text-badge">Weak</strong>
        </div>
      `;

      const parentGroup = passwordInput.closest('.form-group');
      if (parentGroup) {
        if (passwordErrorEl) {
          parentGroup.insertBefore(meterWrap, passwordErrorEl);
        } else {
          parentGroup.appendChild(meterWrap);
        }
      }
    }

    const strengthFill = document.getElementById('strength-bar-fill');
    const strengthBadge = document.getElementById('strength-text-badge');

    // B. Show/Hide Password Toggle
    if (toggleBtn) {
      toggleBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const isCurrentlyPwd = passwordInput.type === 'password';
        passwordInput.type = isCurrentlyPwd ? 'text' : 'password';

        const eyeOpen = toggleBtn.querySelector('.eye-open');
        const eyeClosed = toggleBtn.querySelector('.eye-closed');
        if (eyeOpen && eyeClosed) {
          if (isCurrentlyPwd) {
            eyeOpen.classList.add('hidden');
            eyeClosed.classList.remove('hidden');
          } else {
            eyeOpen.classList.remove('hidden');
            eyeClosed.classList.add('hidden');
          }
        }
      });
    }

    // C. Dynamic Strength Calculation on Typing
    function updateStrengthUI() {
      const result = calculateStrength(passwordInput.value);

      if (meterWrap) {
        meterWrap.className = `password-strength-wrap state-${result.level}`;
      }
      if (strengthBadge) {
        strengthBadge.textContent = result.label;
      }

      // Update right-column rule checkboxes if they exist
      const ruleLength = document.getElementById('rule-length');
      const ruleUpper = document.getElementById('rule-uppercase');
      const ruleNum = document.getElementById('rule-number');
      const ruleSpec = document.getElementById('rule-special');

      const setRuleClass = (el, valid) => {
        if (!el) return;
        if (valid) el.classList.add('valid');
        else el.classList.remove('valid');
      };

      setRuleClass(ruleLength, result.rules.length);
      setRuleClass(ruleUpper, result.rules.uppercase);
      setRuleClass(ruleNum, result.rules.number);
      setRuleClass(ruleSpec, result.rules.special);
    }

    passwordInput.addEventListener('input', updateStrengthUI);

    // D. Intercept Form Submission (Capture Phase) to Block Weak Passwords
    if (registerForm) {
      registerForm.addEventListener('submit', (e) => {
        const result = calculateStrength(passwordInput.value);
        if (!result.isAcceptable) {
          e.preventDefault();
          e.stopImmediatePropagation();

          if (passwordErrorEl) {
            passwordErrorEl.textContent = 'Password must meet all complexity requirements (Strong).';
          }
          passwordInput.focus();
        }
      }, true); // Use capture phase so it guards before other handlers
    }
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPasswordEnhancement);
  } else {
    initPasswordEnhancement();
  }

  // Export to global scope if needed
  window.passwordEnhancement = {
    calculateStrength,
    init: initPasswordEnhancement
  };
})();
