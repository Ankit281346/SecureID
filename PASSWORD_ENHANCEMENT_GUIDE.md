# Registration: Password Enhancement Implementation Guide

Follow the steps below to copy and paste the code into each file.

---

## 1. File: `frontend/index.html`

### Where to add:
Inside `<div class="form-group">` for password, right after `<div class="input-password-wrapper">...</div>` (around **Line 312**).

### Code to paste:
```html
                  <!-- Password Strength Indicator -->
                  <div class="password-strength" id="password-strength">
                    <div class="strength-bar"><div id="strength-fill"></div></div>
                    <div class="strength-label">Strength: <strong id="strength-text">Weak</strong></div>
                  </div>
```

---

## 2. File: `frontend/css/styles.css`

### Where to add:
Under the button/input styling section (around **Line 421**).

### Code to paste:
```css
/* ==========================================================================
   Password Strength Indicator
   ========================================================================== */
.password-strength {
  margin-top: 0.5rem;
}

.strength-bar {
  height: 6px;
  background-color: #e2e8f0;
  border-radius: 4px;
  overflow: hidden;
}

#strength-fill {
  height: 100%;
  width: 0;
  transition: width 0.3s ease, background-color 0.3s ease;
}

.strength-label {
  font-size: 0.75rem;
  color: #64748b;
  margin-top: 0.3rem;
}

/* 3 Visual States: Weak (Red), Medium (Amber), Strong (Green) */
.password-strength.weak #strength-fill {
  width: 33.33%;
  background-color: #ef4444;
}
.password-strength.weak #strength-text {
  color: #ef4444;
}

.password-strength.medium #strength-fill {
  width: 66.66%;
  background-color: #f59e0b;
}
.password-strength.medium #strength-text {
  color: #f59e0b;
}

.password-strength.strong #strength-fill {
  width: 100%;
  background-color: #10b981;
}
.password-strength.strong #strength-text {
  color: #10b981;
}
```

---

## 3. File: `frontend/js/validation.js`

### Where to add:
Inside the `const validation = { ... }` object, right after `checkPasswordRules()` (around **Line 21**).

### Code to paste:
```javascript
  /**
   * Calculate dynamic password strength (Weak, Medium, Strong)
   * Reuses checkPasswordRules()
   * @param {string} password
   * @returns {{ level: 'weak'|'medium'|'strong', label: string, isAcceptable: boolean }}
   */
  calculatePasswordStrength(password) {
    const rules = this.checkPasswordRules(password);
    const passed = Object.values(rules).filter(Boolean).length;

    if (passed < 2 || !rules.length) {
      return { level: 'weak', label: 'Weak', isAcceptable: false };
    }
    if (passed < 4) {
      return { level: 'medium', label: 'Medium', isAcceptable: false };
    }
    return { level: 'strong', label: 'Strong', isAcceptable: true };
  },
```

---

## 4. File: `frontend/js/app.js`

### Location A: Update Strength as User Types
Inside `inputPassword.addEventListener('input', (e) => { ... })` (around **Line 352**).

### Code to paste:
```javascript
      // Update Password Strength UI Dynamically
      const strength = validation.calculatePasswordStrength(e.target.value);
      const container = document.getElementById('password-strength');
      const text = document.getElementById('strength-text');
      if (container && text) {
        container.className = `password-strength ${strength.level}`;
        text.textContent = strength.label;
      }
```

---

### Location B: Block Registration if Password is not Strong
Inside `formRegister.addEventListener('submit', async (e) => { ... })` right before `btnCreateAccount.disabled = true;` (around **Line 390**).

### Code to paste:
```javascript
      // Block registration if password does not meet minimum strength
      const strength = validation.calculatePasswordStrength(password);
      if (!strength.isAcceptable) {
        document.getElementById('error-password').textContent = 'Password must meet all complexity rules (Strong).';
        return;
      }
```

---

## 5. Verification Checklist

1. **Show/Hide Toggle**: Click the eye icon inside the password field to toggle between hidden (`••••••••`) and visible text.
2. **Weak State**: Type 1–3 characters $\rightarrow$ bar fills 33% in red and shows **Weak**.
3. **Medium State**: Type 8+ characters without special characters or numbers $\rightarrow$ bar fills 66% in amber and shows **Medium**.
4. **Strong State**: Type 8+ characters with uppercase, number, and special character (e.g. `Secure123!`) $\rightarrow$ bar fills 100% in green and shows **Strong**.
5. **Prevent Registration**: Submitting while **Weak** or **Medium** shows an error and blocks registration.
6. **Successful Registration**: Submitting while **Strong** proceeds to Email OTP verification.
