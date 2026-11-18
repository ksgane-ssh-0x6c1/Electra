document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('register-form');
  if (!form) return;
  const password = document.getElementById('password');
  const confirmPassword = document.getElementById('confirmPassword');
  const checkPasswords = () => confirmPassword.setCustomValidity(password.value === confirmPassword.value ? '' : 'Passwords do not match.');
  password.addEventListener('input', checkPasswords);
  confirmPassword.addEventListener('input', checkPasswords);

  form.addEventListener('submit', async (event) => {
    event.preventDefault(); checkPasswords();
    if (!form.reportValidity()) return;
    const button = form.querySelector('[type="submit"]'); button.disabled = true;
    try {
      const result = await window.EMS_API.post('/auth/register', {
        role: document.getElementById('role').value,
        fullName: document.getElementById('fullName').value.trim(),
        username: document.getElementById('username').value.trim(),
        email: document.getElementById('email').value.trim(),
        password: password.value
      });
      window.showToast(result.message || 'Account created. Verify your email before signing in.');
      const email = document.getElementById('email').value.trim();
      form.reset();
      setTimeout(() => { location.href = `verify-email.html?email=${encodeURIComponent(email)}`; }, 900);
    } catch (err) { window.showToast(err.message); }
    finally { button.disabled = false; }
  });
});
