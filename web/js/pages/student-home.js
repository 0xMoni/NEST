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
    must(sb.from('v_my_mentor').select('full_name').maybeSingle()),
    must(sb.from('mentor_alerts').select('id, kind, urgent, title, due_text').eq('student_id', me.id).is('acknowledged_at', null)
      .order('urgent', { ascending: false }).order('created_at', { ascending: false })),
    must(sb.from('v_student_scorecard').select('subject_code').eq('student_id', me.id))
  ]);

  var rows = res[0].data || [], slots = res[1].data || [], alerts = res[3].data || [], marks = res[4].data || [];
  var mentor = res[2].data ? res[2].data.full_name : null;

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

  function stat(href, label, value, note, risk, extra) {
    return '<a class="stat' + (risk ? ' is-risk' : '') + '" href="' + esc(N.url(href)) + '">' +
      '<div class="eyebrow">' + label + '</div><div class="stat-value' + (extra || '') + '">' + value + '</div>' +
      '<div class="stat-note">' + note + '</div>' + '</a>';
  }

  app.innerHTML =
    '<section class="stats" aria-label="Summary">' +
      stat('student/attendance.html', 'Attendance', overall === null ? '—' : overall + '<small>%</small>',
        held ? attended + ' of ' + held + ' classes · ' + (held - attended) + ' missed' : 'Nothing marked yet', overall !== null && overall < 75) +
      stat('student/attendance.html', 'Subjects below 75%', rows.length ? String(short.length) : '—',
        short.length ? esc(short.map(function (s) { return s.subject_code + ' ' + s.percentage + '%'; }).join(', ')) : rows.length ? 'All above 75%' : 'Nothing marked yet', short.length > 0) +
      stat('student/scorecard.html', 'Scorecard', nScored ? nScored + '<small> subject' + (nScored === 1 ? '' : 's') + '</small>' : '—',
        nScored ? marks.length + ' published mark' + (marks.length === 1 ? '' : 's') : 'Nothing published yet') +
      stat('student/mentor.html', 'Mentor', esc(mentor || 'Not assigned'),
        alerts.length ? '<b>' + alerts.length + ' thing' + (alerts.length === 1 ? '' : 's') + ' waiting on you</b>' : mentor ? 'Nothing outstanding' : 'The HOD assigns this', alerts.some(function (a) { return a.urgent; }), ' small') +
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
})();
