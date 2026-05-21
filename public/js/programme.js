/* Engage Online — programme */
(function () {
  'use strict';

  const STORAGE_KEY = 'engage_online_viewer';
  const TZ_STORAGE_KEY = 'agenda_tz';
  const SESSION_MAX_AGE_MS = 15 * 24 * 60 * 60 * 1000;

  const TZ_PRESETS = [
    { label: 'Dubai', tz: 'Asia/Dubai' },
    { label: 'Bangkok', tz: 'Asia/Bangkok' },
    { label: 'Maldives', tz: 'Indian/Maldives' },
    { label: 'London', tz: 'Europe/London' },
    { label: 'Paris', tz: 'Europe/Paris' }
  ];

  let viewer = null;
  try { viewer = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch (_) {}
  const expired = viewer && typeof viewer.ts === 'number' &&
    (Date.now() - viewer.ts) >= SESSION_MAX_AGE_MS;
  if (!viewer || !viewer.email || !viewer.name || expired) {
    try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
    window.location.replace('/');
    return;
  }
  const firstName = viewer.name.split(/\s+/)[0];
  document.getElementById('viewerName').textContent = firstName;

  document.getElementById('signOut').addEventListener('click', function () {
    try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
    window.location.replace('/');
  });

  let selectedTz = getInitialTz();
  let allMeetings = [];
  let activeDay = 'all';

  const grid = document.getElementById('meetingsGrid');
  const emptyState = document.getElementById('emptyState');
  const tzSelector = document.getElementById('tzSelector');

  renderTzSelector();

  fetch('/data/meetings.json', { cache: 'no-store' })
    .then(function (r) { return r.ok ? r.json() : []; })
    .then(function (data) {
      allMeetings = Array.isArray(data) ? data : (data.meetings || []);
      allMeetings.sort(function (a, b) {
        return new Date(a.startsAt) - new Date(b.startsAt);
      });
      render();
      setInterval(render, 30000);
    })
    .catch(function () { allMeetings = []; render(); });

  document.querySelectorAll('.day-tab').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.day-tab').forEach(function (b) { b.classList.remove('is-active'); });
      btn.classList.add('is-active');
      activeDay = btn.dataset.day;
      render();
    });
  });

  grid.addEventListener('click', function (e) {
    const btn = e.target.closest('[data-ics-id]');
    if (!btn) return;
    e.preventDefault();
    const id = btn.dataset.icsId;
    const meeting = allMeetings.find(function (m) { return m.id === id; });
    if (meeting) downloadIcs(meeting);
  });

  function getInitialTz() {
    const saved = localStorage.getItem(TZ_STORAGE_KEY);
    if (saved) return saved;
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Dubai';
    } catch (_) { return 'Asia/Dubai'; }
  }

  function renderTzSelector() {
    if (!tzSelector) return;
    const browserTz = (function () {
      try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch (_) { return null; }
    })();
    const isBrowserPreset = TZ_PRESETS.some(function (p) { return p.tz === browserTz; });

    let html = '<span class="tz-label">Viewing times in:</span>';
    TZ_PRESETS.forEach(function (p) {
      html += '<button class="tz-pill' + (selectedTz === p.tz ? ' active' : '') +
        '" data-tz="' + escapeAttr(p.tz) + '">' + escapeHtml(p.label) + '</button>';
    });
    if (browserTz && !isBrowserPreset) {
      const cityName = browserTz.split('/').pop().replace(/_/g, ' ');
      html += '<button class="tz-pill' + (selectedTz === browserTz ? ' active' : '') +
        '" data-tz="' + escapeAttr(browserTz) + '">My timezone (' + escapeHtml(cityName) + ')</button>';
    }
    tzSelector.innerHTML = html;

    tzSelector.querySelectorAll('.tz-pill').forEach(function (btn) {
      btn.addEventListener('click', function () {
        selectedTz = btn.dataset.tz;
        try { localStorage.setItem(TZ_STORAGE_KEY, selectedTz); } catch (_) {}
        renderTzSelector();
        render();
      });
    });
  }

  function render() {
    const now = Date.now();
    const filtered = allMeetings.filter(function (m) {
      if (activeDay === 'all') return true;
      const dayStr = new Date(m.startsAt).toLocaleDateString('en-CA', { timeZone: 'Asia/Dubai' });
      return dayStr === activeDay;
    });

    if (filtered.length === 0) {
      grid.innerHTML = '';
      emptyState.hidden = false;
      return;
    }
    emptyState.hidden = true;

    grid.innerHTML = filtered.map(function (m) { return cardHtml(m, now); }).join('');
  }

  function cardHtml(m, now) {
    const start = new Date(m.startsAt).getTime();
    const end = new Date(m.endsAt || (start + 60 * 60 * 1000)).getTime();
    const earlyMs = 10 * 60 * 1000;

    let status, statusLabel, joinable;
    if (now >= end) { status = 'ended'; statusLabel = 'Ended'; joinable = false; }
    else if (now >= start - earlyMs) {
      status = 'live'; statusLabel = now >= start ? 'Live now' : 'Opens soon'; joinable = true;
    }
    else { status = 'upcoming'; statusLabel = 'Upcoming'; joinable = false; }

    const dayLabel = formatDay(m.startsAt);
    const hourLabel = formatTime(m.startsAt) + (m.endsAt ? ' — ' + formatTime(m.endsAt) : '');
    const tzAbbr = tzShort(selectedTz);

    const speakers = (m.speakers || []).map(function (s) {
      return '<span class="meeting-speaker">' + escapeHtml(s) + '</span>';
    }).join('');

    const safeTitle = escapeHtml(m.title || 'Session');
    const safeDesc = m.description ? '<p class="meeting-desc">' + escapeHtml(m.description) + '</p>' : '';

    const joinBtn = joinable && m.joinUrl && !/REPLACE_ME/.test(m.joinUrl)
      ? '<a class="btn-join" href="' + escapeAttr(m.joinUrl) + '" target="_blank" rel="noopener">' +
        '<span>Join via Teams</span>' +
        '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 10h12M11 5l5 5-5 5"/></svg>' +
        '</a>'
      : '<span class="btn-join disabled">' + (status === 'ended' ? 'Session ended' : 'Opens 10 min before') + '</span>';

    const calBlock = status === 'ended' ? '' : (
      '<div class="meeting-cal">' +
        '<span class="meeting-cal-label">Save to calendar</span>' +
        '<a class="meeting-cal-btn" href="' + escapeAttr(googleCalUrl(m)) + '" target="_blank" rel="noopener" title="Google Calendar" aria-label="Add to Google Calendar">' +
          gcalSvg() +
        '</a>' +
        '<a class="meeting-cal-btn" href="' + escapeAttr(outlookCalUrl(m)) + '" target="_blank" rel="noopener" title="Outlook" aria-label="Add to Outlook">' +
          outlookSvg() +
        '</a>' +
        '<a class="meeting-cal-btn" href="#" data-ics-id="' + escapeAttr(m.id) + '" title="Download .ics" aria-label="Download .ics">' +
          icsSvg() +
        '</a>' +
      '</div>'
    );

    return (
      '<article class="meeting-card ' + (status === 'live' ? 'is-live' : '') + '">' +
        '<div class="meeting-time">' +
          '<span class="meeting-day">' + dayLabel + '</span>' +
          '<span class="meeting-hour">' + hourLabel + '</span>' +
          '<span class="meeting-tz">' + escapeHtml(tzAbbr) + '</span>' +
          '<span class="meeting-status ' + status + '">' + statusLabel + '</span>' +
        '</div>' +
        '<h3 class="meeting-title">' + safeTitle + '</h3>' +
        safeDesc +
        (speakers ? '<div class="meeting-speakers">' + speakers + '</div>' : '') +
        '<div class="meeting-actions">' + joinBtn + '</div>' +
        calBlock +
      '</article>'
    );
  }

  function formatDay(iso) {
    return new Date(iso).toLocaleDateString('en-GB', {
      timeZone: selectedTz, weekday: 'short', day: '2-digit', month: 'short'
    });
  }

  function formatTime(iso) {
    return new Date(iso).toLocaleTimeString('en-GB', {
      timeZone: selectedTz, hour: '2-digit', minute: '2-digit'
    });
  }

  function tzShort(tz) {
    try {
      const parts = new Intl.DateTimeFormat('en', {
        timeZone: tz, timeZoneName: 'short'
      }).formatToParts(new Date());
      const tzn = parts.find(function (p) { return p.type === 'timeZoneName'; });
      if (tzn && tzn.value) return tzn.value;
    } catch (_) {}
    return tz.split('/').pop().replace(/_/g, ' ');
  }

  function googleCalUrl(m) {
    const start = toCompactUtc(m.startsAt);
    const end = toCompactUtc(m.endsAt || addHour(m.startsAt));
    const text = encodeURIComponent(m.title + ' — Engage by Elevate');
    const details = encodeURIComponent(
      (m.description ? m.description + '\n\n' : '') +
      (m.joinUrl && !/REPLACE_ME/.test(m.joinUrl) ? 'Join: ' + m.joinUrl : '') +
      '\n\nProgramme: https://online.engagebyelevate.com/programme'
    );
    const location = encodeURIComponent(
      m.joinUrl && !/REPLACE_ME/.test(m.joinUrl) ? m.joinUrl : 'Elevate Tourism Hub, Dubai'
    );
    return 'https://calendar.google.com/calendar/render?action=TEMPLATE' +
      '&text=' + text + '&dates=' + start + '/' + end +
      '&details=' + details + '&location=' + location;
  }

  function outlookCalUrl(m) {
    const startIso = new Date(m.startsAt).toISOString();
    const endIso = new Date(m.endsAt || addHour(m.startsAt)).toISOString();
    const subject = encodeURIComponent(m.title + ' — Engage by Elevate');
    const body = encodeURIComponent(
      (m.description ? m.description + '\n\n' : '') +
      (m.joinUrl && !/REPLACE_ME/.test(m.joinUrl) ? 'Join: ' + m.joinUrl : '')
    );
    const location = encodeURIComponent(
      m.joinUrl && !/REPLACE_ME/.test(m.joinUrl) ? m.joinUrl : 'Elevate Tourism Hub, Dubai'
    );
    return 'https://outlook.office.com/calendar/0/action/compose?subject=' + subject +
      '&startdt=' + encodeURIComponent(startIso) + '&enddt=' + encodeURIComponent(endIso) +
      '&body=' + body + '&location=' + location;
  }

  function downloadIcs(m) {
    const uid = (m.id || 'session') + '@online.engagebyelevate.com';
    const start = toCompactUtc(m.startsAt);
    const end = toCompactUtc(m.endsAt || addHour(m.startsAt));
    const now = toCompactUtc(new Date().toISOString());
    const escapeIcs = function (s) {
      return String(s || '').replace(/[\\;,]/g, function (c) { return '\\' + c; }).replace(/\n/g, '\\n');
    };
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Engage by Elevate//Online Programme//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      'UID:' + uid,
      'DTSTAMP:' + now,
      'DTSTART:' + start,
      'DTEND:' + end,
      'SUMMARY:' + escapeIcs(m.title + ' — Engage by Elevate'),
      'DESCRIPTION:' + escapeIcs(
        (m.description || '') +
        (m.joinUrl && !/REPLACE_ME/.test(m.joinUrl) ? '\nJoin: ' + m.joinUrl : '')
      ),
      'LOCATION:' + escapeIcs(
        m.joinUrl && !/REPLACE_ME/.test(m.joinUrl) ? m.joinUrl : 'Elevate Tourism Hub, Dubai'
      ),
      'URL:https://online.engagebyelevate.com/programme',
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');

    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (m.id || 'session') + '.ics';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function toCompactUtc(iso) {
    return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  }
  function addHour(iso) {
    return new Date(new Date(iso).getTime() + 60 * 60 * 1000).toISOString();
  }

  function gcalSvg() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></svg>';
  }
  function outlookSvg() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="14" height="12" rx="1.5"/><circle cx="10" cy="12" r="2.5"/><path d="M17 10l4-1v6l-4-1"/></svg>';
  }
  function icsSvg() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v12M7 11l5 5 5-5"/><path d="M5 19h14"/></svg>';
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function escapeAttr(s) { return escapeHtml(s); }
})();
