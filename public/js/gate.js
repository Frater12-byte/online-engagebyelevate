/* Engage Online — gate */
(function () {
  'use strict';

  const STORAGE_KEY = 'engage_online_viewer';
  const SESSION_MAX_AGE_MS = 15 * 24 * 60 * 60 * 1000;

  try {
    const existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (existing && existing.email && existing.name && typeof existing.ts === 'number' &&
        (Date.now() - existing.ts) < SESSION_MAX_AGE_MS) {
      window.location.replace('/programme');
      return;
    }
    if (existing) localStorage.removeItem(STORAGE_KEY);
  } catch (_) { /* ignore */ }

  const form = document.getElementById('gateForm');
  if (!form) return;

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    const name = form.name.value.trim();
    const email = form.email.value.trim().toLowerCase();
    const company = form.company.value.trim();

    if (!name || name.length < 2) {
      form.name.focus();
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      form.email.focus();
      return;
    }

    const viewer = {
      name,
      email,
      company: company || null,
      ts: Date.now()
    };

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(viewer));
    } catch (_) { /* ignore */ }

    window.location.assign('/programme');
  });
})();
