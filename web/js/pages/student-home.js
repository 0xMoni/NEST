/* Student dashboard: attendance at a glance, today's classes, mentor alerts. */
(async function () {
  'use strict';
  var N = NEST, sb = N.sb, esc = N.esc, must = N.must;
  var me = await N.requireRole('student');
  var now = new Date(), dow = now.getDay(), hour = now.getHours();
  var greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  var app = N.shell(me, {
    active: 'home', docTitle: 'Dashboard',
    title: greeting + ', ' + String(me.full_name || '').split(' ')[0],
    sub: N.DAYS[dow] + ' · ' + now.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })
  });

  var res = await Promise.all([
    must(sb.from('v_student_attendance').select('subject_code, subject_name, held, attended, percentage, short').eq('student_id', me.id).order('percentage', { ascending: true })),
    must(sb.from('timetable_slots').select('period, faculty_assignments!inner(subjects!inner(code, name))').eq('day_of_week', dow).order('period')),
    // v_my_mentor: the mentor's contact card only. Students can't read teachers' full profiles.
    must(sb.from('v_my_mentor').select('full_name, designation, cabin, office_hours').maybeSingle()),
    must(sb.from('mentor_alerts').select('id, kind, urgent, title, due_text').eq('student_id', me.id).is('acknowledged_at', null)
      .order('urgent', { ascending: false }).order('created_at', { ascending: false })),
    must(sb.from('v_student_scorecard').select('subject_code').eq('student_id', me.id))
  ]);

  var rows = res[0].data || [], slots = res[1].data || [], alerts = res[3].data || [], marks = res[4].data || [];
  var mentorRow = res[2].data || null;
  var mentor = mentorRow ? mentorRow.full_name : null;

  var held = 0, attended = 0;
  rows.forEach(function (r) { held += Number(r.held || 0); attended += Number(r.attended || 0); });
  var overall = N.pct(attended, held);
  var short = rows.filter(function (r) { return r.short; });
  var scoredSubjects = {}; marks.forEach(function (m) { scoredSubjects[m.subject_code] = 1; });
  var nScored = Object.keys(scoredSubjects).length;

  // Today's classes, and where we are in the day.
  var byPeriod = {}; slots.forEach(function (s) { byPeriod[s.period] = s.faculty_assignments.subjects; });
  var at = N.periodAt(now), onDay = dow >= 1 && dow <= 6;
  var cur = onDay && at.current ? byPeriod[at.current] : null;
  var upcoming = null;
  if (onDay) N.PERIODS.forEach(function (p) {
    if (!upcoming && byPeriod[p.n] && p.n !== at.current && (at.current ? p.n > at.current : (at.next !== null && p.n >= at.next))) upcoming = p.n;
  });
  var dayLine = !onDay ? "It's Sunday. Nothing scheduled."
    : !slots.length ? 'No classes scheduled today.'
    : cur ? 'Now: ' + cur.name + (upcoming ? ' · Next: ' + byPeriod[upcoming].name + ' at ' + N.PERIODS[upcoming - 1].from : '')
    : upcoming ? 'Next: ' + byPeriod[upcoming].name + ', period ' + upcoming + ' at ' + N.PERIODS[upcoming - 1].from
    : 'Nothing left today.';

  // Subject lines for the popovers. Below 75% says how many classes to attend to get back;
  // 75-80% says how many can still be missed.
  function subj(r) {
    var p = Number(r.percentage), h = Number(r.held), a = Number(r.attended);
    var cls = p < 75 ? 'risk' : p < 80 ? 'watch' : '';
    var canMiss = Math.floor(a / 0.75 - h);
    var hint = p < 75 ? 'Below 75%. Attend the next ' + Math.max(1, Math.ceil((0.75 * h - a) / 0.25)) + ' classes in a row to get back.'
      : p < 80 ? 'Close to the line. ' + (canMiss <= 0 ? 'One more miss drops it under 75%.' : 'You can miss ' + canMiss + ' more.') : '';
    return '<div class="gp-subj ' + cls + '"><span class="name">' + esc(r.subject_name || r.subject_code) + '</span><span class="pct">' + p + '%</span>' +
      '<span class="bar"><i style="width:' + Math.min(100, Math.max(0, p)) + '%"></i></span>' + (hint ? '<span class="hint">' + esc(hint) + '</span>' : '') + '</div>';
  }
  function pop(title, body, href, linkText) {
    return '<h3>' + title + '</h3>' + body + (href ? '<a class="gp-link" href="' + esc(N.url(href)) + '">' + linkText + ' →</a>' : '');
  }
  var popAtt = rows.length ? pop('Subjects to watch', (rows.filter(function (r) { return Number(r.percentage) < 80; }).map(subj).join('') || '<p class="gp-empty">Every subject is at 80% or above.</p>'), 'student/attendance.html', 'Full attendance') : '';
  var popShort = short.length ? pop('Below 75%', short.map(subj).join(''), 'student/attendance.html', 'Full attendance') : '';
  var popMarks = nScored ? pop('Marks published for', '<p class="gp-empty">' + Object.keys(scoredSubjects).map(esc).join(', ') + '</p>', 'student/scorecard.html', 'Open scorecard') : '';
  var popMentor = alerts.length ? pop('Waiting on you', alerts.slice(0, 3).map(function (a) {
    return '<div class="gp-alert"><div class="t">' + esc(a.title) + '</div><div class="d">' + (a.kind === 'meet' ? 'Meeting' : 'To do') + (a.due_text ? ' · ' + esc(a.due_text) : '') + '</div></div>';
  }).join(''), 'student/mentor.html', 'See all alerts') : '';

  var popN = 0;
  function stat(href, label, value, note, risk, extra, popHtml) {
    var id = 'gp' + (++popN);
    return '<div class="stat-hold"><a class="stat' + (risk ? ' is-risk' : '') + '" href="' + esc(N.url(href)) + '"' + (popHtml ? ' aria-describedby="' + id + '"' : '') + '>' +
      '<div class="eyebrow">' + label + '</div><div class="stat-value' + (extra || '') + '">' + value + '</div>' +
      '<div class="stat-note">' + note + '</div>' + '</a>' +
      (popHtml ? '<div class="gp-pop" id="' + id + '" role="tooltip">' + popHtml + '</div>' : '') + '</div>';
  }

  app.innerHTML =
    '<section class="stats" aria-label="Summary">' +
      stat('student/attendance.html', 'Attendance', overall === null ? '—' : overall + '<small>%</small>',
        held ? attended + ' of ' + held + ' classes · ' + (held - attended) + ' missed' : 'Nothing marked yet', overall !== null && overall < 75, '', popAtt) +
      stat('student/attendance.html', 'Subjects below 75%', rows.length ? String(short.length) : '—',
        short.length ? esc(short.map(function (s) { return s.subject_code + ' ' + s.percentage + '%'; }).join(', ')) : rows.length ? 'All above 75%' : 'Nothing marked yet', short.length > 0, '', popShort) +
      stat('student/scorecard.html', 'Scorecard', nScored ? nScored + '<small> subject' + (nScored === 1 ? '' : 's') + '</small>' : '—',
        nScored ? marks.length + ' published mark' + (marks.length === 1 ? '' : 's') : 'Nothing published yet', false, '', popMarks) +
      stat('student/mentor.html', 'Mentor', esc(mentor || 'Not assigned'),
        alerts.length ? '<b>' + alerts.length + ' thing' + (alerts.length === 1 ? '' : 's') + ' waiting on you</b>' : mentor ? 'Nothing outstanding' : 'The HOD assigns this', alerts.some(function (a) { return a.urgent; }), ' small', popMentor) +
    '</section>' +

    '<section class="card"><div class="card-head"><h2>Today</h2><span class="aside">' + esc(dayLine) + '</span></div>' +
      (!onDay || !slots.length ? '<p class="empty">No classes today.</p>' :
        '<div class="tiles">' + N.PERIODS.map(function (p) {
          var s = byPeriod[p.n], isNow = p.n === at.current && s;
          return '<div class="tile' + (isNow ? ' now' : '') + (s ? '' : ' free') + '">' +
            '<span class="per">P' + p.n + ' · ' + p.from + (isNow ? ' · NOW' : p.n === upcoming ? ' · NEXT' : '') + '</span>' +
            '<span class="nm">' + (s ? esc(s.name) : 'Free') + '</span>' +
            '<span class="code">' + (s ? esc(s.code) : '') + '</span></div>';
        }).join('') + '</div>') +
      '<p class="note"><a class="link" href="' + esc(N.url('student/timetable.html')) + '">Whole week</a></p>' +
    '</section>' +

    (alerts.length ?
      '<section class="card"><div class="card-head"><h2>From your mentor</h2><a class="btn sm" href="' + esc(N.url('student/mentor.html')) + '">Open</a></div>' +
        '<ul class="list">' + alerts.slice(0, 3).map(function (a) {
          return '<li><div class="list-row"><span class="row"><span class="dot' + (a.urgent ? ' risk' : '') + '"></span><span class="title-line">' + esc(a.title) + '</span></span>' +
            '<span class="dim">' + (a.kind === 'meet' ? 'Meeting' : 'To do') + (a.due_text ? ' · ' + esc(a.due_text) : '') + '</span></div></li>';
        }).join('') + '</ul>' +
        (alerts.length > 3 ? '<p class="note">and ' + (alerts.length - 3) + ' more.</p>' : '') +
      '</section>' : '');
  // Floating mentor pill: tap to open a small card, minimise it again. Remembered on this device.
  if (mentorRow) {
    var KEY = 'nest.mentorOpen', open = false;
    try { open = localStorage.getItem(KEY) === '1'; } catch (e) { open = false; }
    var ini = N.initials(mentorRow.full_name);
    var where = [mentorRow.cabin, mentorRow.office_hours].filter(Boolean).join(' · ');
    var wrap = document.createElement('aside');
    wrap.className = 'mp-wrap' + (open ? ' expanded' : '');
    wrap.setAttribute('aria-label', 'Your mentor');
    wrap.innerHTML =
      '<div class="mp-card" id="mpCard"><div class="mp-top"><span class="eyebrow">Your mentor</span>' +
        '<button class="mp-x" type="button" id="mpMin" aria-label="Minimise mentor card"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg></button></div>' +
        '<div class="mp-row"><div class="mp-avatar" aria-hidden="true">' + esc(ini) + '</div><div><p class="mp-name">' + esc(mentorRow.full_name) + '</p>' +
        (mentorRow.designation ? '<div class="mp-dept">' + esc(mentorRow.designation) + '</div>' : '') + '</div></div>' +
        '<div class="mp-where">' + esc(where) + '</div>' +
        '<a class="btn primary mp-go" href="' + esc(N.url('student/mentor.html')) + '">Contact mentor</a></div>' +
      '<button class="mp-pill" type="button" id="mpPill" aria-expanded="' + open + '" aria-controls="mpCard"><span class="mp-avatar sm" aria-hidden="true">' + esc(ini) + '</span>' +
        '<span class="mp-pill-txt"><b>' + esc(mentorRow.full_name) + '</b><small>Your mentor</small></span></button>';
    document.body.appendChild(wrap);
    var setOpen = function (o) {
      wrap.classList.toggle('expanded', o);
      document.getElementById('mpPill').setAttribute('aria-expanded', o ? 'true' : 'false');
      try { localStorage.setItem(KEY, o ? '1' : '0'); } catch (e) { /* not remembered */ }
    };
    document.getElementById('mpPill').addEventListener('click', function () { setOpen(true); wrap.querySelector('.mp-go').focus(); });
    document.getElementById('mpMin').addEventListener('click', function () { setOpen(false); document.getElementById('mpPill').focus(); });
  }
})();
