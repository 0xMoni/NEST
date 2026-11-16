/* Student timetable: the week, with now and next called out. */
(async function () {
  'use strict';
  var N = NEST, sb = N.sb, esc = N.esc, must = N.must;
  var me = await N.requireRole('student');
  var app = N.shell(me, { active: 'timetable', title: 'Timetable', sub: 'Your week.' });

  var r = await must(sb.from('timetable_slots')
    .select('day_of_week, period, faculty_assignments!inner(subjects!inner(code, name), profiles(full_name))'));
  var slots = (r.data || []).map(function (s) {
    var fa = s.faculty_assignments;
    return { day: s.day_of_week, period: s.period, code: fa.subjects.code, name: fa.subjects.name, who: fa.profiles ? fa.profiles.full_name : '' };
  });
  if (!slots.length) {
    app.innerHTML = '<div class="card"><p class="empty">No timetable has been set for your section yet.</p></div>';
    return;
  }

  var grid = {};
  slots.forEach(function (s) { grid[s.day + ':' + s.period] = s; });
  var now = new Date(), today = now.getDay(), at = N.periodAt(now), onDay = today >= 1 && today <= 6;
  var nowClass = onDay && at.current ? grid[today + ':' + at.current] : null;
  var nextP = null;
  if (onDay) N.PERIODS.forEach(function (p) {
    if (nextP === null && grid[today + ':' + p.n] && (at.current ? p.n > at.current : at.next !== null && p.n >= at.next)) nextP = p.n;
  });
  var nextClass = nextP ? grid[today + ':' + nextP] : null;

  // A coloured dot per subject: enough to tell two apart at a glance.
  var codes = []; slots.forEach(function (s) { if (codes.indexOf(s.code) < 0) codes.push(s.code); });
  codes.sort();
  function dot(code) { return '<span class="dot" style="background:hsl(' + ((codes.indexOf(code) * 67 + 200) % 360) + ' 55% 60%)"></span>'; }

  var head = '<tr><th class="day"></th>';
  N.PERIODS.forEach(function (p) {
    head += '<th>P' + p.n + '<span class="t">' + p.from + '–' + p.to + '</span></th>';
  });
  head += '</tr>';

  var body = '';
  for (var d = 1; d <= 6; d++) {
    body += '<tr><th class="day" scope="row">' + N.DAYS_SHORT[d] + '</th>';
    N.PERIODS.forEach(function (p) {
      var s = grid[d + ':' + p.n], isNow = d === today && p.n === at.current && s;
      body += s
        ? '<td class="' + (isNow ? 'now' : d === today ? 'today' : '') + '"><div class="code">' + dot(s.code) + esc(s.code) + '</div><div class="nm">' + esc(s.name) + '</div></td>'
        : '<td class="free">Free</td>';
    });
    body += '</tr>';
  }

  app.innerHTML =
    '<div class="tt-status">' +
      '<div><span class="eyebrow">Now</span><b>' + (nowClass ? esc(nowClass.name) : onDay && at.current ? 'Free period' : 'No class') + '</b></div>' +
      '<div><span class="eyebrow">Next</span><b>' + (nextClass ? esc(nextClass.name) + ' · ' + N.PERIODS[nextP - 1].from : 'Nothing left today') + '</b></div>' +
    '</div>' +
    '<section class="card"><div class="table-wrap"><table class="tt"><thead>' + head + '</thead><tbody>' + body + '</tbody></table></div>' +
    '<p class="foot-note">Breaks: ' + Object.keys(N.BREAK_AFTER).map(function (k) { return N.BREAK_AFTER[k] + ' after P' + k; }).join(', ') + '. Period times are placeholders until the college confirms them.</p></section>' +
    '<section class="card"><div class="card-head"><h2>Subjects</h2></div><ul class="list">' + codes.map(function (c) {
      var s = slots.filter(function (x) { return x.code === c; })[0];
      var n = slots.filter(function (x) { return x.code === c; }).length;
      return '<li><div class="list-row"><span class="row">' + dot(c) + '<span class="title-line">' + esc(s.name) + '</span><span class="dim">' + esc(c) + '</span></span>' +
        '<span class="dim">' + esc(s.who) + ' · ' + n + ' period' + (n === 1 ? '' : 's') + ' a week</span></div></li>';
    }).join('') + '</ul></section>';
})();
