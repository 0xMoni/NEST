/* Teacher home: today's classes, what is waiting, mentees who need a word,
   and the week. Row-level security means every query returns only this
   teacher's own classes, assessments and mentees. */
(async function () {
  'use strict';
  var N = NEST, sb = N.sb, esc = N.esc, must = N.must;
  var me = await N.requireRole('faculty');
  var now = new Date(), dow = now.getDay(), today = N.localISO(now);
  var app = N.shell(me, {
    active: 'home', docTitle: 'Home',
    title: 'Hello, ' + (me.full_name || '').split(' ').slice(-1)[0],
    sub: N.DAYS[dow] + ', ' + now.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })
  });

  var res = await Promise.all([
    must(sb.from('timetable_slots').select('day_of_week, period, assignment_id, faculty_assignments!inner(faculty_id, sections!inner(dept, semester, name), subjects!inner(code, name))')
      .eq('faculty_assignments.faculty_id', me.id).order('day_of_week').order('period')),
    must(sb.from('attendance_sessions').select('assignment_id, period').eq('held_on', today)),
    must(sb.from('assessments').select('id', { count: 'exact', head: true }).eq('published', false)),
    must(sb.from('profile_edit_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending')),
    must(sb.from('mentorships').select('student_id, profiles!mentorships_student_id_fkey(full_name, usn)').eq('mentor_id', me.id)),
    must(sb.from('mentor_alerts').select('id', { count: 'exact', head: true }).eq('mentor_id', me.id).is('acknowledged_at', null))
  ]);
  var week = res[0].data || [];
  var marked = {}; (res[1].data || []).forEach(function (m) { marked[m.assignment_id + ':' + m.period] = true; });
  var drafts = res[2].count || 0, requests = res[3].count || 0, openAlerts = res[5].count || 0;
  var mentees = (res[4].data || []).filter(function (m) { return m.profiles; });

  // Mentees below 75% in any subject.
  var atRisk = [];
  if (mentees.length) {
    var ids = mentees.map(function (m) { return m.student_id; });
    var att = await must(sb.from('v_student_attendance').select('student_id, subject_code, percentage, short').in('student_id', ids).eq('short', true));
    var by = {};
    (att.data || []).forEach(function (r) { (by[r.student_id] = by[r.student_id] || []).push(r.subject_code + ' ' + r.percentage + '%'); });
    mentees.forEach(function (m) { if (by[m.student_id]) atRisk.push({ m: m.profiles, subjects: by[m.student_id] }); });
  }

  var todays = week.filter(function (s) { return s.day_of_week === dow; });
  var at = N.periodAt(now);

  var classes = todays.length
    ? '<div class="table-wrap"><table class="data compact"><tbody>' + todays.map(function (s) {
        var fa = s.faculty_assignments, ok = marked[s.assignment_id + ':' + s.period];
        return '<tr class="' + (s.period === at.current ? 'now' : '') + '"><td class="n">P' + s.period + '</td><td class="dim">' + N.periodTime(s.period) + '</td>' +
          '<td class="subj">' + esc(fa.subjects.name) + '</td><td class="dim">' + esc(N.sectionLabel(fa.sections)) + '</td><td class="actions">' +
          (ok ? '<span class="pill ok">Marked</span> <a class="link" href="attendance.html?a=' + encodeURIComponent(s.assignment_id) + '&period=' + s.period + '&date=' + today + '">Edit</a>'
              : '<a class="btn sm primary" href="attendance.html?a=' + encodeURIComponent(s.assignment_id) + '&period=' + s.period + '&date=' + today + '">Mark attendance</a>') +
          '</td></tr>';
      }).join('') + '</tbody></table></div>'
    : '<p class="empty">' + (dow === 0 ? "It's Sunday. No classes." : 'No classes on your timetable today.') + '</p>';

  // The week at a glance: a grid of the teacher's own periods.
  var grid = {}; week.forEach(function (s) { grid[s.day_of_week + ':' + s.period] = s.faculty_assignments; });
  var weekHtml = '<div class="table-wrap"><table class="tt"><thead><tr><th class="day"></th>' +
    N.PERIODS.map(function (p) { return '<th>P' + p.n + '<span class="t">' + p.from + '</span></th>'; }).join('') + '</tr></thead><tbody>';
  for (var d = 1; d <= 6; d++) {
    weekHtml += '<tr><th class="day" scope="row">' + N.DAYS_SHORT[d] + '</th>' + N.PERIODS.map(function (p) {
      var fa = grid[d + ':' + p.n];
      return fa ? '<td class="' + (d === dow ? (p.n === at.current ? 'now' : 'today') : '') + '"><div class="code">' + esc(fa.subjects.code) + '</div><div class="nm">' + esc(N.sectionLabel(fa.sections)) + '</div></td>'
                : '<td class="free"></td>';
    }).join('') + '</tr>';
  }
  weekHtml += '</tbody></table></div>';

  function stat(href, label, value, note, risk) {
    return '<a class="stat' + (risk ? ' is-risk' : '') + '" href="' + href + '"><div class="eyebrow">' + label + '</div><div class="stat-value">' + value + '</div><div class="stat-note">' + note + '</div></a>';
  }

  app.innerHTML =
    '<section class="stats" aria-label="Waiting on you">' +
      stat('marks.html', 'Marks not published', drafts, drafts ? 'Students can\'t see these yet' : 'Nothing in draft') +
      stat('mentees.html#requests', 'Edit requests', requests, requests ? 'Mentees waiting on you' : 'None waiting', requests > 0) +
      stat('mentees.html', 'Mentees below 75%', mentees.length ? atRisk.length : '—', mentees.length ? 'Of ' + mentees.length + ' mentees, in any subject' : 'No mentees assigned', atRisk.length > 0) +
      stat('mentees.html#alerts', 'Alerts not acknowledged', openAlerts, openAlerts ? 'Sent, not yet seen to' : 'All acknowledged') +
    '</section>' +
    '<section class="card"><div class="card-head"><h2>Today\'s classes</h2><a class="link" href="attendance.html">All classes</a></div>' + classes + '</section>' +
    (atRisk.length ? '<section class="card"><div class="card-head"><h2>Mentees who need a word</h2><a class="link" href="mentees.html">Mentees</a></div><ul class="list">' +
      atRisk.map(function (x) {
        return '<li><div class="list-row"><span><span class="title-line">' + esc(x.m.full_name) + '</span> <span class="dim">' + esc(x.m.usn || '') + '</span></span>' +
          '<span class="pill risk">' + esc(x.subjects.join(', ')) + '</span></div></li>';
      }).join('') + '</ul></section>' : '') +
    '<section class="card"><div class="card-head"><h2>Your week</h2></div>' + (week.length ? weekHtml : '<p class="empty">You have no classes on the timetable yet. The HOD sets this.</p>') + '</section>';
})();
