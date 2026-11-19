/* Shared plumbing for the plain-HTML frontend. Every page loads, in order:
   config.js, the supabase-js CDN script, then this file.

   Security lives in the database (row-level security), not here: the browser
   key is public by design, and every query runs as the signed-in person. What
   this file does is make the pages behave — send people to the right place,
   draw the shared layout, and show errors instead of hanging on "Loading…". */
(function () {
  'use strict';

  // ---------------------------------------------------------------- setup

  var cfg = window.NEST_CONFIG;
  if (!cfg || !window.supabase) {
    document.body.innerHTML = '<p style="padding:2rem;font-family:sans-serif">' +
      (!cfg ? 'Missing web/config.js. Copy config.example.js to config.js and fill it in.'
            : 'Could not load the Supabase library. Check your internet connection and reload.') + '</p>';
    throw new Error(!cfg ? 'no config' : 'no supabase');
  }
  var sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY);

  // Every link is built from where this script was loaded, so pages work the
  // same from web/ and from web/faculty/ without counting "../" by hand.
  var BASE = (function () {
    var s = document.currentScript && document.currentScript.src;
    return s ? s.replace(/js\/api\.js(\?.*)?$/, '') : location.origin + '/';
  })();
  function url(path) { return BASE + path; }

  var HOME = { student: 'student/index.html', faculty: 'faculty/index.html', admin: 'admin/index.html' };
  function homeFor(role) { return url(HOME[role] || HOME.student); }
  var ROLE_LABEL = { student: 'STUDENT', faculty: 'FACULTY', admin: 'HOD' };

  // ---------------------------------------------------------------- small helpers

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function $(id) { return document.getElementById(id); }
  function param(name) { return new URLSearchParams(location.search).get(name); }

  /** Await a Supabase call and throw on error, so a failed query surfaces as
   *  a visible message (via the handlers below) rather than an empty page. */
  async function must(p) {
    var r = await p;
    if (r.error) throw new Error(r.error.message);
    return r;
  }

  /** must(), for a list that can outgrow one response. The API returns at
   *  most 1000 rows per request and says nothing when it stops there, so
   *  this asks page by page until a short page comes back. build() makes a
   *  fresh query each time; give it an order() that is unique, or rows can
   *  slip between pages. */
  var PAGE = 1000;
  async function mustAll(build) {
    var all = [];
    for (var from = 0; ; from += PAGE) {
      var r = await must(build().range(from, from + PAGE - 1));
      var rows = r.data || [];
      all = all.concat(rows);
      if (rows.length < PAGE) return { data: all, error: null };
    }
  }

  // Dates are the browser's local time — the person is in the college's
  // timezone, which is exactly what "today" and "now" should mean.
  function pad(n) { return String(n).padStart(2, '0'); }
  function localISO(d) { d = d || new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function isISODate(s) { return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s + 'T00:00:00')); }
  function parseISO(s) { return new Date(s + 'T00:00:00'); }
  function fmtDate(s, opts) {
    if (!s) return '';
    var d = /^\d{4}-\d{2}-\d{2}$/.test(s) ? parseISO(s) : new Date(s);
    return d.toLocaleDateString('en-GB', opts || { day: 'numeric', month: 'short', year: 'numeric' });
  }
  function fmtDateTime(s) {
    return new Date(s).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }

  var DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Placeholder period times until the college confirms theirs. Everything
  // that shows a time reads from here, so correcting them is one edit.
  var PERIODS = [
    { n: 1, from: '09:00', to: '09:55' },
    { n: 2, from: '09:55', to: '10:50' },
    { n: 3, from: '11:10', to: '12:05' },
    { n: 4, from: '12:05', to: '13:00' },
    { n: 5, from: '13:45', to: '14:40' },
    { n: 6, from: '14:40', to: '15:35' }
  ];
  var BREAK_AFTER = { 2: 'Break', 4: 'Lunch' };
  function toMin(t) { return Number(t.slice(0, 2)) * 60 + Number(t.slice(3)); }
  /** Which period is running and which is next, for a given time. */
  function periodAt(now) {
    now = now || new Date();
    var m = now.getHours() * 60 + now.getMinutes(), current = null, next = null;
    PERIODS.forEach(function (p) {
      if (m >= toMin(p.from) && m < toMin(p.to)) current = p.n;
      if (next === null && toMin(p.from) > m) next = p.n;
    });
    return { current: current, next: next };
  }
  function periodTime(n) { var p = PERIODS[n - 1]; return p ? p.from + '–' + p.to : ''; }

  function sectionLabel(s) { return s ? s.dept + '-' + s.semester + s.name : ''; }
  function pct(attended, held) { return held ? Math.round((1000 * attended) / held) / 10 : null; }
  function initials(name) {
    var parts = String(name || '').replace(/^(dr|prof|mr|ms|mrs)\.?\s+/i, '').trim().split(/\s+/);
    return ((parts[0] || '?')[0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
  }

  /** Disable a button while a promise runs, so a double tap cannot save twice. */
  async function busy(btn, label, fn) {
    var old = btn.textContent;
    btn.disabled = true; btn.textContent = label;
    try { return await fn(); } finally { btn.disabled = false; btn.textContent = old; }
  }

  /** Put a message in a .msg element. kind: '' | 'err' | 'good'. */
  function say(el, kind, text) { if (!el) return; el.className = 'msg' + (kind ? ' ' + kind : ''); el.textContent = text || ''; }

  var toastT;
  function toast(msg) {
    var t = $('toast'); if (!t) return;
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(function () { t.classList.remove('show'); }, 2400);
  }

  // ---------------------------------------------------------------- theme

  // Follows the operating system until someone picks one; the choice is then
  // remembered on this device. The login page reads the same key.
  var THEME_KEY = 'nest-theme';
  function theme() {
    var t = document.documentElement.getAttribute('data-theme');
    if (t === 'light' || t === 'dark') return t;
    return matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  function setTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    try { localStorage.setItem(THEME_KEY, t); } catch (e) { /* not remembered, still applied */ }
    paintThemeButton();
  }
  var SUN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.6v2.2M12 19.2v2.2M21.4 12h-2.2M4.8 12H2.6M18.6 5.4 17 7M7 17l-1.6 1.6M18.6 18.6 17 17M7 7 5.4 5.4"/></svg>';
  var MOON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20.5 14.6A8.5 8.5 0 0 1 9.4 3.5a8.5 8.5 0 1 0 11.1 11.1Z"/></svg>';
  function paintThemeButton() {
    var b = $('themeBtn'); if (!b) return;
    var dark = theme() === 'dark';
    b.innerHTML = dark ? SUN : MOON;
    b.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
    b.title = b.getAttribute('aria-label');
  }

  // ---------------------------------------------------------------- session

  function hang() { return new Promise(function () {}); }
  function go(href) { location.replace(href); return hang(); }

  /** The signed-in person with their profile, or null. */
  async function getMe() {
    var s = await sb.auth.getSession();
    var user = s.data.session && s.data.session.user;
    if (!user) return null;
    var p = await sb.from('profiles')
      .select('id, full_name, role, usn, dept, semester, email, must_change_password')
      .eq('id', user.id).maybeSingle();
    if (p.error) throw new Error(p.error.message);
    // A session for an account whose profile is gone is no session at all.
    if (!p.data) { await sb.auth.signOut(); return null; }
    return p.data;
  }

  /** Gate a page. roles: 'faculty' or ['student', …]; omit to allow any role.
   *  Not signed in -> login. Still on the office's default password -> made to
   *  pick one first. Wrong role -> their own home, not an error page. */
  async function requireRole(roles, opts) {
    opts = opts || {};
    var me = await getMe();
    if (!me) return go(url('login.html'));
    if (me.must_change_password && !opts.allowUnsettled) return go(url('change-password.html'));
    if (roles) {
      var list = Array.isArray(roles) ? roles : [roles];
      if (list.indexOf(me.role) < 0) return go(homeFor(me.role));
    }
    return me;
  }

  async function signOut() {
    try { await sb.auth.signOut(); } finally { location.replace(url('login.html')); }
  }

  // ---------------------------------------------------------------- layout

  var I = {
    home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1Z"/>',
    grid: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
    check: '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
    chart: '<path d="M3 3v18h18"/><path d="M7 16v-5M12 16V8M17 16v-8"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    pen: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    layers: '<path d="M12 2 2 7l10 5 10-5-10-5Z"/><path d="m2 17 10 5 10-5M2 12l10 5 10-5"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    out: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>'
  };
  function icon(name) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + I[name] + '</svg>';
  }

  var NAV = {
    student: [
      ['home', 'student/index.html', 'Dashboard', 'grid'],
      ['attendance', 'student/attendance.html', 'Attendance', 'check'],
      ['scorecard', 'student/scorecard.html', 'Scorecard', 'chart'],
      ['timetable', 'student/timetable.html', 'Timetable', 'calendar'],
      ['mentor', 'student/mentor.html', 'Mentor', 'users', 'mentorBadge'],
      ['news', 'student/news.html', 'News & events', 'list'],
      ['certifications', 'student/certifications.html', 'Certifications', 'layers'],
      ['profile', 'student/profile.html', 'Profile', 'user']
    ],
    faculty: [
      ['home', 'faculty/index.html', 'Home', 'home'],
      ['attendance', 'faculty/attendance.html', 'Attendance', 'check'],
      ['report', 'faculty/report.html', 'Class report', 'list'],
      ['marks', 'faculty/marks.html', 'Marks', 'pen'],
      ['mentees', 'faculty/mentees.html', 'Mentees', 'users', 'menteeBadge']
    ],
    admin: [
      ['home', 'admin/index.html', 'Overview', 'grid'],
      ['people', 'admin/people.html', 'People', 'users'],
      ['structure', 'admin/structure.html', 'Structure', 'layers'],
      ['timetable', 'admin/timetable.html', 'Timetable', 'calendar']
    ]
  };

  function swirl() {
    var cx = 40, cy = 700, out = '', seed = 7;
    function rnd() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }
    for (var i = 0; i < 58; i++) {
      var r = 30 + i * 6 + rnd() * 10, a0 = rnd() * Math.PI * 2, a1 = a0 + 0.6 + rnd() * 1.6;
      out += '<path class="' + (i % 2 ? 'r' : '') + '" style="--d:' + (90 + rnd() * 150).toFixed(0) + 's;--g:' + (5 + rnd() * 6).toFixed(1) +
        's;animation-delay:0s,-' + (rnd() * 8).toFixed(1) + 's" d="M' + (cx + r * Math.cos(a0)).toFixed(1) + ' ' + (cy + r * Math.sin(a0)).toFixed(1) +
        ' A' + r.toFixed(1) + ' ' + r.toFixed(1) + ' 0 0 1 ' + (cx + r * Math.cos(a1)).toFixed(1) + ' ' + (cy + r * Math.sin(a1)).toFixed(1) +
        '" fill="none" stroke="rgba(207,169,98,' + (0.2 + rnd() * 0.35).toFixed(2) + ')" stroke-width="' + (0.7 + rnd() * 0.9).toFixed(2) + '"/>';
    }
    return '<svg class="side-swirl" viewBox="0 0 260 900" preserveAspectRatio="xMinYMax slice" aria-hidden="true">' + out + '</svg>';
  }

  /** Draw the sidebar and page header, and return the element pages render into.
   *  opts: { active, title, sub } */
  function shell(me, opts) {
    var items = NAV[me.role] || [];
    var meta = me.role === 'student'
      ? [me.usn, me.semester ? 'Sem ' + me.semester : null].filter(Boolean).join(' · ')
      : (me.role === 'admin' ? 'HOD' : 'Faculty');
    document.title = 'NEST · ' + (opts.docTitle || opts.title);
    document.body.innerHTML =
      '<a class="skip" href="#app">Skip to content</a>' +
      '<div class="shell">' +
        '<aside class="side">' + swirl() +
          '<a class="brand" href="' + esc(homeFor(me.role)) + '">' +
            '<img class="brand-logo" src="' + esc(url('assets/nest-logo.png')) + '" alt="NEST — Nurturing Education and Student Tracking" width="274" height="246">' +
            '<div class="brand-role">' + ROLE_LABEL[me.role] + '</div>' +
          '</a>' +
          '<nav class="nav" aria-label="Main">' + items.map(function (it) {
            return '<a href="' + esc(url(it[1])) + '"' + (it[0] === opts.active ? ' aria-current="page"' : '') + '>' +
              icon(it[3]) + esc(it[2]) + (it[4] ? '<span class="nav-badge" id="' + it[4] + '" hidden></span>' : '') + '</a>';
          }).join('') + '</nav>' +
          '<div class="side-foot">' +
            '<a class="me" href="' + esc(url('account.html')) + '"' + (opts.active === 'account' ? ' aria-current="page"' : '') + '>' +
              '<span class="ini" aria-hidden="true">' + esc(initials(me.full_name)) + '</span>' +
              '<span><span class="who">' + esc(me.full_name || me.email) + '</span><span class="meta">' + esc(meta) + '</span></span>' +
            '</a>' +
            '<button type="button" class="signout" id="signOut">' + icon('out') + 'Sign out</button>' +
          '</div>' +
        '</aside>' +
        '<main class="main">' +
          '<header class="head">' +
            '<div><h1 id="pageTitle">' + esc(opts.title) + '</h1>' + '<p class="sub" id="pageSub">' + esc(opts.sub || '') + '</p></div>' +
            '<div class="head-actions"><button class="icon-btn" type="button" id="themeBtn"></button></div>' +
          '</header>' +
          '<div id="app" tabindex="-1"><p class="loading">Loading…</p></div>' +
        '</main>' +
      '</div>' +
      '<div class="toast" id="toast" role="status" aria-live="polite"></div>';

    paintThemeButton();
    $('themeBtn').addEventListener('click', function () { setTheme(theme() === 'dark' ? 'light' : 'dark'); });
    $('signOut').addEventListener('click', signOut);
    var cur = document.querySelector('.nav a[aria-current="page"]');
    if (cur && cur.scrollIntoView && innerWidth <= 860) cur.scrollIntoView({ inline: 'center', block: 'nearest' });
    badges(me);
    return $('app');
  }

  function setHead(title, sub) {
    if (title != null) { $('pageTitle').textContent = title; document.title = 'NEST · ' + title; }
    if (sub != null) $('pageSub').textContent = sub;
  }

  // Counts in the menu: open mentor alerts for a student, waiting edit
  // requests for a mentor. Row-level security scopes both to the person.
  async function badges(me) {
    try {
      var r, el;
      if (me.role === 'student') {
        r = await sb.from('mentor_alerts').select('id', { count: 'exact', head: true }).eq('student_id', me.id).is('acknowledged_at', null);
        el = $('mentorBadge');
      } else if (me.role === 'faculty') {
        r = await sb.from('profile_edit_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending');
        el = $('menteeBadge');
      }
      if (el && r && !r.error && r.count) { el.textContent = r.count; el.hidden = false; el.setAttribute('aria-label', r.count + ' waiting'); }
    } catch (e) { /* a missing badge is not worth an error on screen */ }
  }

  // ---------------------------------------------------------------- errors

  // Never leave a page stuck on "Loading…": show what went wrong instead.
  function showError(msg) {
    var el = $('app') || document.body;
    el.innerHTML = '<div class="card"><p class="msg err">Something went wrong: ' + esc(msg || 'unknown error') + '</p>' +
      '<p class="dim">Try reloading the page. If it keeps happening, the browser console (F12) has the details.</p></div>';
  }
  window.addEventListener('error', function (e) {
    // Only our own scripts — a browser extension's noise is not the page failing.
    if (e.filename && e.filename.indexOf(location.origin) !== 0) return;
    if (/ResizeObserver/.test(e.message || '')) return;
    showError(e.message);
  });
  window.addEventListener('unhandledrejection', function (e) {
    showError((e.reason && e.reason.message) || String(e.reason));
  });

  window.NEST = {
    sb: sb, url: url, homeFor: homeFor, esc: esc, $: $, param: param, must: must, mustAll: mustAll,
    localISO: localISO, isISODate: isISODate, fmtDate: fmtDate, fmtDateTime: fmtDateTime,
    DAYS: DAYS, DAYS_SHORT: DAYS_SHORT, PERIODS: PERIODS, BREAK_AFTER: BREAK_AFTER, periodAt: periodAt, periodTime: periodTime,
    sectionLabel: sectionLabel, pct: pct, initials: initials, busy: busy, say: say, toast: toast,
    theme: theme, setTheme: setTheme, getMe: getMe, requireRole: requireRole, signOut: signOut,
    shell: shell, setHead: setHead
  };
})();
