/* Engage Online — programme */
(function () {
  'use strict';

  const STORAGE_KEY = 'engage_online_viewer';
  const TZ_STORAGE_KEY = 'agenda_tz';
  const SESSION_MAX_AGE_MS = 15 * 24 * 60 * 60 * 1000;
  const EVENT_TZ = 'Asia/Dubai';

  const TZ_PRESETS = [
    { label: 'Dubai', tz: 'Asia/Dubai' },
    { label: 'Bangkok', tz: 'Asia/Bangkok' },
    { label: 'Maldives', tz: 'Indian/Maldives' },
    { label: 'London', tz: 'Europe/London' },
    { label: 'Paris', tz: 'Europe/Paris' }
  ];

  const DAY_THEMES = {
    '2026-06-02': 'United Arab Emirates',
    '2026-06-03': 'United Arab Emirates',
    '2026-06-04': 'Qatar, Maldives & Thailand'
  };

  let viewer = null;
  try { viewer = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch (_) {}
  const expired = viewer && typeof viewer.ts === 'number' &&
    (Date.now() - viewer.ts) >= SESSION_MAX_AGE_MS;
  if (!viewer || !viewer.email || !viewer.name || expired) {
    try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
    window.location.replace('/');
    return;
  }
  document.getElementById('viewerName').textContent = viewer.name.split(/\s+/)[0];

  document.getElementById('signOut').addEventListener('click', function () {
    try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
    window.location.replace('/');
  });

  let selectedTz = getInitialTz();
  let allMeetings = [];
  let activeDay = 'all';

  const list = document.getElementById('meetingsList');
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

  list.addEventListener('click', function (e) {
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
      return Intl.DateTimeFormat().resolvedOptions().timeZone || EVENT_TZ;
    } catch (_) { return EVENT_TZ; }
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
    const visibleMeetings = allMeetings.filter(function (m) {
      if (activeDay === 'all') return true;
      const dayStr = new Date(m.startsAt).toLocaleDateString('en-CA', { timeZone: EVENT_TZ });
      return dayStr === activeDay;
    });

    if (visibleMeetings.length === 0) {
      list.innerHTML = '';
      emptyState.hidden = false;
      return;
    }
    emptyState.hidden = true;

    const byDay = groupByEventDay(visibleMeetings);
    const days = Object.keys(byDay).sort();
    const tzAbbr = tzShort(selectedTz);

    list.innerHTML = days.map(function (day, idx) {
      const sessions = byDay[day];
      const dayNum = String(idx + 1).padStart(2, '0');
      const dayDate = new Date(sessions[0].startsAt).toLocaleDateString('en-GB', {
        timeZone: selectedTz, weekday: 'long', day: 'numeric', month: 'long'
      });
      const theme = DAY_THEMES[day] || '';

      return (
        '<div class="agenda-day">' +
          '<div class="agenda-day-head">' +
            '<div class="day-num">' + dayNum + '</div>' +
            '<div class="day-date">' + escapeHtml(dayDate) + '</div>' +
            (theme ? '<div class="day-theme">' + escapeHtml(theme) + '</div>' : '') +
          '</div>' +
          sessions.map(function (m) { return itemHtml(m, now, tzAbbr); }).join('') +
        '</div>'
      );
    }).join('');
  }

  function groupByEventDay(meetings) {
    const groups = {};
    meetings.forEach(function (m) {
      const day = new Date(m.startsAt).toLocaleDateString('en-CA', { timeZone: EVENT_TZ });
      (groups[day] = groups[day] || []).push(m);
    });
    return groups;
  }

  function itemHtml(m, now, tzAbbr) {
    const start = new Date(m.startsAt).getTime();
    const end = new Date(m.endsAt || (start + 60 * 60 * 1000)).getTime();
    const earlyMs = 10 * 60 * 1000;

    let status, statusLabel, badgeClass, joinable;
    if (now >= end) {
      status = 'ended'; statusLabel = 'Ended'; badgeClass = 'badge'; joinable = false;
    } else if (now >= start - earlyMs) {
      status = 'live'; statusLabel = now >= start ? 'Live now' : 'Opens soon';
      badgeClass = 'badge badge-live'; joinable = true;
    } else {
      status = 'upcoming'; statusLabel = 'Upcoming'; badgeClass = 'badge'; joinable = false;
    }

    const startStr = formatTime(m.startsAt);
    const endStr = m.endsAt ? formatTime(m.endsAt) : '';
    const orgs = (m.speakers || []).filter(Boolean);
    const orgLine = orgs.length ? '<div class="session-org">' + escapeHtml(orgs.join(' · ')) + '</div>' : '';
    const desc = m.description ? '<p class="session-desc">' + escapeHtml(m.description) + '</p>' : '';

    const joinBtn = joinable && m.joinUrl && !/REPLACE_ME/.test(m.joinUrl)
      ? '<a class="btn-join" href="' + escapeAttr(m.joinUrl) + '" target="_blank" rel="noopener">' +
        '<span>Join via Teams</span>' +
        '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 10h12M11 5l5 5-5 5"/></svg>' +
        '</a>'
      : '<span class="btn-join disabled">' + (status === 'ended' ? 'Session ended' : 'Opens 10 min before') + '</span>';

    const calBlock = status === 'ended' ? '' : (
      '<div class="meeting-cal">' +
        '<span class="meeting-cal-label">Save:</span>' +
        '<a class="meeting-cal-btn" href="' + escapeAttr(googleCalUrl(m)) + '" target="_blank" rel="noopener" title="Google Calendar" aria-label="Add to Google Calendar">' +
          '<img src="/img/icon-gcal.svg" alt="Google Calendar" width="18" height="18">' +
        '</a>' +
        '<a class="meeting-cal-btn" href="' + escapeAttr(outlookCalUrl(m)) + '" target="_blank" rel="noopener" title="Outlook" aria-label="Add to Outlook">' +
          '<img src="/img/icon-outlook.png" alt="Outlook" width="18" height="18">' +
        '</a>' +
        '<a class="meeting-cal-btn" href="#" data-ics-id="' + escapeAttr(m.id) + '" title="Download .ics" aria-label="Download .ics">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v12m0 0l-4-4m4 4l4-4"/><path d="M5 19h14"/></svg>' +
        '</a>' +
      '</div>'
    );

    return (
      '<div class="agenda-item">' +
        '<div class="time">' +
          startStr +
          (endStr ? ' <span class="time-end">' + endStr + '</span>' : '') +
          '<span class="time-tz">' + escapeHtml(tzAbbr) + '</span>' +
        '</div>' +
        '<div class="agenda-body">' +
          '<h4>' + escapeHtml(m.title || 'Session') + '</h4>' +
          orgLine + desc +
          '<div class="session-actions">' + joinBtn + calBlock + '</div>' +
        '</div>' +
        '<div class="agenda-item-side"><span class="' + badgeClass + '">' + escapeHtml(statusLabel) + '</span></div>' +
      '</div>'
    );
  }

  function formatTime(iso) {
    return new Date(iso).toLocaleTimeString('en-GB', {
      timeZone: selectedTz, hour: '2-digit', minute: '2-digit'
    });
  }

  function tzShort(tz) {
    try {
      const parts = new Intl.DateTimeFormat('en', { timeZone: tz, timeZoneName: 'short' }).formatToParts(new Date());
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
      m.joinUrl && !/REPLACE_ME/.test(m.joinUrl) ? m.joinUrl : 'Dubai'
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
      m.joinUrl && !/REPLACE_ME/.test(m.joinUrl) ? m.joinUrl : 'Dubai'
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
      'BEGIN:VCALENDAR', 'VERSION:2.0',
      'PRODID:-//Engage by Elevate//Online Programme//EN',
      'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
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
      'LOCATION:' + escapeIcs(m.joinUrl && !/REPLACE_ME/.test(m.joinUrl) ? m.joinUrl : 'Dubai'),
      'URL:https://online.engagebyelevate.com/programme',
      'END:VEVENT', 'END:VCALENDAR'
    ].join('\r\n');

    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = (m.id || 'session') + '.ics';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function toCompactUtc(iso) {
    return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  }
  function addHour(iso) {
    return new Date(new Date(iso).getTime() + 60 * 60 * 1000).toISOString();
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function escapeAttr(s) { return escapeHtml(s); }
})();
