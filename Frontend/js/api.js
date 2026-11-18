// Shared API client for all Electra pages.
(() => {
  const configured = window.EMS_CONFIG && window.EMS_CONFIG.API_BASE_URL;
  if (!configured) throw new Error('EMS_CONFIG.API_BASE_URL is not configured.');
  const baseUrl = configured.replace(/\/$/, '');

  async function request(path, options = {}) {
    const token = localStorage.getItem('ems_token');
    const headers = { Accept: 'application/json', ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) };
    if (token) headers.Authorization = `Bearer ${token}`;
    let response;
    try {
      response = await fetch(`${baseUrl}${path.startsWith('/') ? path : `/${path}`}`, { ...options, headers });
    } catch {
      throw new Error('Cannot reach the Electra API. Start the backend and check Frontend/js/config.js.');
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 401) {
        localStorage.removeItem('ems_token');
        localStorage.removeItem('ems_user');
      }
      throw Object.assign(new Error(data.error || `Request failed (${response.status}).`), { code: data.code || null, status: response.status });
    }
    return data;
  }

  window.EMS_API = Object.freeze({
    request,
    get: (path) => request(path),
    post: (path, body) => request(path, { method: 'POST', body: JSON.stringify(body) }),
    patch: (path, body) => request(path, { method: 'PATCH', body: JSON.stringify(body) }),
    delete: (path) => request(path, { method: 'DELETE' }),
    saveToken: (token) => localStorage.setItem('ems_token', token),
    clearToken: () => { localStorage.removeItem('ems_token'); localStorage.removeItem('ems_user'); }
  });
})();
