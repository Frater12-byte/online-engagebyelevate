/* Engage Online — programme */
(function () {
  'use strict';

  const STORAGE_KEY = 'engage_online_viewer';
  const EVENT_TZ = 'Asia/Dubai';

  let viewer = null;
  try {
    viewer = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
  } catch (_) {}
  if (!viewer || !viewer.email || !viewer.name) {
    window.location.replace('/');
    return;
  }
  const firstName = viewer.name.split(/\s+/)[0];
  document.getElementById('viewerName').textContent = firstName;

  document.getElementById('signOut').addEventListener('click', function () {
    try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
    window.location.replace('/');
  });

  let allMeetings = [];
  let activeDay = 'all';

  const grid = document.getElementById('meetingsGrid');
  const emptyState = document.getElementById('emptyState');

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
    .catch(function () {
      allMeetings = [];
      render();
    });

  document.querySelectorAll('.day-tab').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.day-tab').forEach(function (b) {
        b.classList.remove('is-active');
      });
      btn.classList.add('is-active');
      activeDay = btn.dataset.day;
      render();
    });
  });

  function render() {
    const now = Date.now();

    const filtered = allMeetings.filter(function (m) {
      if (activeDay === 'all') return true;
      const d = new Date(m.startsAt);
      const dayStr = d.toLocaleDateString('en-CA', { timeZone: EVENT_TZ });
      return dayStr === activeDay;
    });

    if (filtered.length === 0) {
      grid.innerHTML = '';
      emptyState.hidden = false;
      return;
    }
    emptyState.hidden = true;

    grid.innerHTML = filtered.map(function (m) {
      return cardHtml(m, now);
    }).join('');
  }

  function cardHtml(m, now) {
    const start = new Date(m.startsAt).getTime();
    const end = new Date(m.endsAt || (start + 60 * 60 * 1000)).getTime();

    let status, statusLabel, joinable;
    const earlyMs = 10 * 60 * 1000;
    if (now >= end) {
      status = 'ended';
      statusLabel = 'Ended';
      joinable = false;
    } else if (now >= start - earlyMs) {
      status = 'live';
      statusLabel = now >= start ? 'Live now' : 'Opens soon';
      joinable = true;
    } else {
      status = 'upcoming';
      statusLabel = 'Upcoming';
      joinable = false;
    }

    const dayLabel = formatDay(m.startsAt);
    const hourLabel = formatTime(m.startsAt) + (m.endsAt ? ' — ' + formatTime(m.endsAt) : '');

    const speakers = (m.speakers || []).map(function (s) {
      return '<span class="meeting-speaker">' + escapeHtml(s) + '</span>';
    }).join('');

    const safeTitle = escapeHtml(m.title || 'Session');
    const safeDesc = m.description ? '<p class="meeting-desc">' + escapeHtml(m.description) + '</p>' : '';

    const joinBtn = joinable && m.joinUrl
      ? '<a class="btn-join" href="' + escapeAttr(m.joinUrl) + '" target="_blank" rel="noopener">' +
        '<span>Join via Teams</span>' +
        '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 10h12M11 5l5 5-5 5"/></svg>' +
        '</a>'
      : '<span class="btn-join disabled">' + (status === 'ended' ? 'Session ended' : 'Opens 10 min before') + '</span>';

    return (
      '<article class="meeting-card ' + (status === 'live' ? 'is-live' : '') + '">' +
        '<div class="meeting-time">' +
          '<span class="meeting-day">' + dayLabel + '</span>' +
          '<span class="meeting-hour">' + hourLabel + '</span>' +
          '<span class="meeting-tz">GST</span>' +
          '<span class="meeting-status ' + status + '">' + statusLabel + '</span>' +
        '</div>' +
        '<h3 class="meeting-title">' + safeTitle + '</h3>' +
        safeDesc +
        (speakers ? '<div class="meeting-speakers">' + speakers + '</div>' : '') +
        '<div class="meeting-actions">' + joinBtn + '</div>' +
      '</article>'
    );
  }

  function formatDay(iso) {
    return new Date(iso).toLocaleDateString('en-GB', {
      timeZone: EVENT_TZ,
      weekday: 'short',
      day: '2-digit',
      month: 'short'
    });
  }

  function formatTime(iso) {
    return new Date(iso).toLocaleTimeString('en-GB', {
      timeZone: EVENT_TZ,
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  function escapeAttr(s) { return escapeHtml(s); }
})();
