// Local PC setup: keep the API on the same computer as the backend.
// For online hosting, replace this with the actual public HTTPS API URL.
// Do not use localhost here for a GitHub Pages site: visitors' localhost is their own PC.
window.EMS_CONFIG = Object.freeze({ API_BASE_URL: 'http://localhost:3000/api' });
