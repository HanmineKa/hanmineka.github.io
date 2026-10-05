import { getCurrentUser, getSafeNext, loginAccount, registerAccount } from './auth.js';

const form = document.getElementById('auth-form');
const message = document.getElementById('auth-message');
const nextPage = getSafeNext();

document.querySelectorAll('a[href="login.html"], a[href="register.html"]').forEach((link) => {
  link.href = `${link.getAttribute('href')}?next=${encodeURIComponent(nextPage)}`;
});

if (getCurrentUser()) location.replace(nextPage);

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  message.textContent = '';
  message.className = 'small mb-3 text-danger';

  if (!form.reportValidity()) return;
  const submitButton = form.querySelector('[type="submit"]');
  submitButton.disabled = true;

  try {
    let result;
    if (form.dataset.authMode === 'register') {
      const name = form.elements.name.value.trim();
      if (!name) {
        message.textContent = 'Enter your name.';
        return;
      }
      if (form.elements.password.value !== form.elements.confirmPassword.value) {
        message.textContent = 'Passwords do not match.';
        return;
      }
      result = await registerAccount(name, form.elements.email.value, form.elements.password.value);
    } else {
      result = await loginAccount(form.elements.email.value, form.elements.password.value);
    }

    if (result.error) {
      message.textContent = result.error;
      return;
    }
    location.replace(nextPage);
  } catch (error) {
    message.textContent = error.message || 'Unable to complete the request. Please try again.';
  } finally {
    submitButton.disabled = false;
  }
});