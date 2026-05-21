/* Engage Online — gate */
(function () {
  'use strict';

  const STORAGE_KEY = 'engage_online_viewer';
  const SESSION_MAX_AGE_MS = 15 * 24 * 60 * 60 * 1000;
  const SIGNUP_ENDPOINT = 'https://script.google.com/macros/s/AKfycbwFUogA2VL7P6EFtyBsI8arT2Qx64sVAXuSB4FQhE9Ao2KltF3yBv5FqQoBEucrZTVc/exec';

  try {
    const existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (existing && existing.email && existing.name && existing.company && typeof existing.ts === 'number' &&
        (Date.now() - existing.ts) < SESSION_MAX_AGE_MS) {
      window.location.replace('/programme');
      return;
    }
    if (existing) localStorage.removeItem(STORAGE_KEY);
  } catch (_) { /* ignore */ }

  const form = document.getElementById('gateForm');
  if (!form) return;

  function setInvalid(fieldId, invalid) {
    const f = document.getElementById(fieldId);
    if (!f) return;
    f.classList.toggle('is-invalid', !!invalid);
  }

  ['name', 'email', 'company'].forEach(function (id) {
    const input = document.getElementById(id);
    if (!input) return;
    input.addEventListener('input', function () {
      setInvalid('field-' + id, false);
    });
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    const name = form.name.value.trim();
    const email = form.email.value.trim().toLowerCase();
    const company = form.company.value.trim();

    const nameOk = name.length >= 2;
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    const companyOk = company.length >= 1;

    setInvalid('field-name', !nameOk);
    setInvalid('field-email', !emailOk);
    setInvalid('field-company', !companyOk);

    if (!nameOk) { form.name.focus(); return; }
    if (!emailOk) { form.email.focus(); return; }
    if (!companyOk) { form.company.focus(); return; }

    const viewer = { name: name, email: email, company: company, ts: Date.now() };

    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(viewer)); } catch (_) {}

    sendSignup(viewer);

    if (typeof gtag === 'function') {
      gtag('event', 'online_signup', { method: 'gate_form' });
    }

    window.location.assign('/programme');
  });

  function sendSignup(viewer) {
    try {
      const params = new URLSearchParams({
        ts: new Date(viewer.ts).toISOString(),
        name: viewer.name,
        email: viewer.email,
        company: viewer.company,
        ua: navigator.userAgent || '',
        ref: document.referrer || ''
      });
      const body = params.toString();
      const blob = new Blob([body], { type: 'application/x-www-form-urlencoded;charset=UTF-8' });
      if (navigator.sendBeacon && navigator.sendBeacon(SIGNUP_ENDPOINT, blob)) return;
      fetch(SIGNUP_ENDPOINT, {
        method: 'POST',
        mode: 'no-cors',
        keepalive: true,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        body: body
      }).catch(function () { /* ignore */ });
    } catch (_) { /* ignore */ }
  }
})();
