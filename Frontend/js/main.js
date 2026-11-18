(() => {
  const toast = (message) => {
    let el = document.querySelector('.toast');
    if (!el) {
      el = document.createElement('div');
      el.className = 'toast';
      el.setAttribute('role', 'status');
      el.setAttribute('aria-live', 'polite');
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.classList.add('show');
    window.clearTimeout(window.__toastTimer);
    window.__toastTimer = window.setTimeout(() => el.classList.remove('show'), 3200);
  };
  window.showToast = toast;

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-current-year]').forEach((el) => {
      el.textContent = new Date().getFullYear();
    });
    const currentPage = location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.nav-links a').forEach((link) => {
      const href = link.getAttribute('href') || '';
      if (href.endsWith(currentPage)) link.classList.add('active');
    });
  });
})();
