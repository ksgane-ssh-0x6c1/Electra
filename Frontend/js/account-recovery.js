document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(location.search);
  const token = params.get('token') || '';
  const queryEmail = params.get('email') || '';

  const forgotForm = document.getElementById('forgot-password-form');
  if (forgotForm) {
    const emailInput = document.getElementById('recovery-email');
    const message = document.getElementById('recovery-message');
    if (queryEmail) emailInput.value = queryEmail;
    forgotForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!forgotForm.reportValidity()) return;
      const button = forgotForm.querySelector('[type="submit"]');
      button.disabled = true;
      try {
        const result = await window.EMS_API.post('/auth/forgot-password', { email: emailInput.value.trim() });
        message.textContent = result.message;
      } catch (err) { message.textContent = err.message; }
      finally { button.disabled = false; }
    });
  }

  const verifyForm = document.getElementById('verify-email-form');
  const resendForm = document.getElementById('resend-verification-form');
  if (resendForm) {
    const message = document.getElementById('verification-message');
    const emailInput = document.getElementById('verification-email');
    if (queryEmail) emailInput.value = queryEmail;
    if (token && verifyForm) {
      message.textContent = 'Click below to confirm that you own this email address.';
      verifyForm.hidden = false;
      verifyForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const button = verifyForm.querySelector('[type="submit"]');
        button.disabled = true;
        try {
          const result = await window.EMS_API.post('/auth/verify-email', { token });
          message.textContent = result.message;
          message.insertAdjacentHTML('beforeend', ' <a href="login.html">Go to login</a>.');
          verifyForm.hidden = true;
        } catch (err) {
          message.textContent = err.message;
          verifyForm.hidden = true;
          resendForm.hidden = false;
        } finally { button.disabled = false; }
      });
    } else {
      message.textContent = 'Did not receive the verification email? Request a new link below.';
      resendForm.hidden = false;
    }
    resendForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!resendForm.reportValidity()) return;
      const button = resendForm.querySelector('[type="submit"]');
      button.disabled = true;
      try {
        const result = await window.EMS_API.post('/auth/resend-verification', { email: emailInput.value.trim() });
        message.textContent = result.message;
      } catch (err) { message.textContent = err.message; }
      finally { button.disabled = false; }
    });
  }

  const resetForm = document.getElementById('reset-password-form');
  if (resetForm) {
    const message = document.getElementById('reset-message');
    const password = document.getElementById('new-password');
    const confirm = document.getElementById('confirm-new-password');
    if (!token) {
      message.textContent = 'This reset link is missing its token. Request a new password reset email.';
      return;
    }
    resetForm.hidden = false;
    const checkPasswords = () => confirm.setCustomValidity(password.value === confirm.value ? '' : 'Passwords do not match.');
    password.addEventListener('input', checkPasswords);
    confirm.addEventListener('input', checkPasswords);
    resetForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      checkPasswords();
      if (!resetForm.reportValidity()) return;
      const button = resetForm.querySelector('[type="submit"]');
      button.disabled = true;
      try {
        const result = await window.EMS_API.post('/auth/reset-password', { token, password: password.value });
        message.textContent = result.message;
        resetForm.hidden = true;
        message.insertAdjacentHTML('beforeend', ' <a href="login.html">Sign in</a>.');
      } catch (err) { message.textContent = err.message; }
      finally { button.disabled = false; }
    });
  }
});
