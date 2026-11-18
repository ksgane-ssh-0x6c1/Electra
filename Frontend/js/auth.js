(() => {
  const destinations = {
    Voter: 'voter.html', Party: 'party.html', Candidate: 'candidate.html',
    BLO: 'blo.html', 'Election Officer': 'election-officer.html', DBA: 'account.html'
  };
  const pageRoles = {
    'voter.html': 'Voter', 'party.html': 'Party', 'candidate.html': 'Candidate',
    'blo.html': 'BLO', 'election-officer.html': 'Election Officer', 'account.html': 'DBA'
  };
  const page = location.pathname.split('/').pop();
  const expectedRole = pageRoles[page];

  window.EMS_AUTH_READY = (async () => {
    if (!expectedRole) return null;
    if (!localStorage.getItem('ems_token')) {
      location.replace(expectedRole ? `login.html?role=${encodeURIComponent(expectedRole)}` : 'login.html');
      return null;
    }
    try {
      const user = await window.EMS_API.get('/auth/me');
      if (user.role !== expectedRole) {
        window.EMS_API.clearToken();
        location.replace(`login.html?role=${encodeURIComponent(expectedRole)}`);
        return null;
      }
      localStorage.setItem('ems_user', JSON.stringify(user));
      return user;
    } catch (err) {
      window.EMS_API.clearToken();
      if (location.pathname.split('/').pop() !== 'login.html') location.replace(`login.html?role=${encodeURIComponent(expectedRole)}`);
      return null;
    }
  })();

  document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
      const requestedRole = new URLSearchParams(location.search).get('role');
      const roleSelect = document.getElementById('login-role');
      if (requestedRole && roleSelect && Array.from(roleSelect.options).some((option) => option.value === requestedRole || option.textContent.trim() === requestedRole)) {
        roleSelect.value = requestedRole;
      }
      loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (!loginForm.reportValidity()) return;
        const button = loginForm.querySelector('[type="submit"]');
        button.disabled = true;
        try {
          const payload = {
            role: document.getElementById('login-role').value,
            username: document.getElementById('username').value.trim(),
            password: document.getElementById('password').value
          };
          const result = await window.EMS_API.post('/auth/login', payload);
          window.EMS_API.saveToken(result.token);
          localStorage.setItem('ems_user', JSON.stringify(result.user));
          location.href = destinations[result.user.role] || 'index.html';
        } catch (err) {
          if (err.code === 'EMAIL_NOT_VERIFIED') {
            const email = encodeURIComponent(document.getElementById('username').value.trim().includes('@') ? document.getElementById('username').value.trim() : '');
            location.href = email ? `verify-email.html?email=${email}` : 'verify-email.html';
          } else window.showToast(err.message);
        }
        finally { button.disabled = false; }
      });
    }

    document.querySelectorAll('[data-logout]').forEach((button) => button.addEventListener('click', () => {
      window.EMS_API.clearToken();
      location.href = 'login.html';
    }));

    if (expectedRole) {
      window.EMS_AUTH_READY.then((user) => {
        if (!user) return;
        const nav = document.querySelector('.nav-links');
        if (nav && !nav.querySelector('[data-logout]')) {
          nav.querySelectorAll('a[href="login.html"]').forEach((link) => link.remove());
          const welcome = document.createElement('span');
          welcome.className = 'help'; welcome.textContent = user.full_name || user.fullName || user.username;
          const logout = document.createElement('button');
          logout.type = 'button'; logout.className = 'btn btn-small btn-secondary'; logout.textContent = 'Log out'; logout.setAttribute('data-logout', '');
          logout.addEventListener('click', () => { window.EMS_API.clearToken(); location.href = 'login.html'; });
          nav.append(welcome, logout);
        }
      }).catch(() => {});
    }
  });
})();
