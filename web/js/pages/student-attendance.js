/* Student attendance: a row per subject, opening onto the individual classes. */
(async function () {
  'use strict';
  var N = NEST, sb = N.sb, esc = N.esc, must = N.must;
  var me = await N.requireRole('student');
  var app = N.shell(me, { active: 'attendance', title: 'Attendance', sub: 'You need 75% in every subject.' });

  var res = await Promise.all([
    must(sb.from('v_student_attendance').select('subject_id, subject_code, subject_name, section_id, held, attended, percentage, short').eq('student_id', me.id).order('subject_code')),
    N.mustAll(function () { return sb.from('attendance_records').select('session_id, status, attendance_sessions!inner(held_on, period, faculty_assignments!inner(subject_id))').eq('student_id', me.id).order('session_id'); }),
    must(sb.from('v_my_teachers').select('subject_id, section_id, faculty_name'))
  ]);
  var rows = res[0].data || [], records = res[1].data || [];
  var teacher = {};
  (res[2].data || []).forEach(function (a) { teacher[a.section_id + ':' + a.subject_id] = a.faculty_name || ''; });

  if (!rows.length) {
    app.innerHTML = '<div class="card"><p class="empty">No attendance has been marked for you yet. It appears here as soon as a teacher marks a class.</p></div>';
    return;
  }

  // Every class, grouped by subject, newest first.
  var classes = {};
  records.forEach(function (r) {
    var s = r.attendance_sessions, k = s.faculty_assignments.subject_id;
    (classes[k] = classes[k] || []).push({ on: s.held_on, period: s.period, missed: r.status === 'absent' });
  });
  Object.keys(classes).forEach(function (k) {
    classes[k].sort(function (a, b) { return b.on.localeCompare(a.on) || b.period - a.period; });
  });

  var held = 0, attended = 0;
  rows.forEach(function (r) { held += Number(r.held); attended += Number(r.attended); });
  var overall = N.pct(attended, held), short = rows.filter(function (r) { return r.short; });
  var weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
  var cutoff = N.localISO(weekAgo), range = 'week';

  // How many classes in a row it takes to get back to 75%: (a+k)/(h+k) >= 3/4  =>  k >= 3h - 4a.
  function toRecover(r) { return Math.max(0, 3 * Number(r.held) - 4 * Number(r.attended)); }
  // How many can be missed and still stay at 75%: a/(h+k) >= 3/4  =>  k <= (4a - 3h) / 3.
  function canMiss(r) { return Math.max(0, Math.floor((4 * Number(r.attended) - 3 * Number(r.held)) / 3)); }

  function status(r) {
    if (r.short) return '<span class="pill risk">Below 75%</span><span class="meta-line">Attend the next ' + toRecover(r) + ' to recover</span>';
    var m = canMiss(r);
    if (m === 0) return '<span class="pill watch">On the edge</span><span class="meta-line">One more miss drops you below 75%</span>';
    return '<span class="pill ok">Fine</span><span class="meta-line">Can miss ' + m + ' more</span>';
  }

  function detail(r) {
    var list = (classes[r.subject_id] || []).filter(function (c) { return range === 'sem' || c.on >= cutoff; });
    var missed = list.filter(function (c) { return c.missed; }).length;
    return '<div class="row" style="justify-content:space-between;padding:6px 0 12px">' +
      '<span class="' + 'dim' + '">' + (list.length ? list.length + ' class' + (list.length === 1 ? '' : 'es') + ' · ' + (missed ? '<b style="color:var(--risk)">' + missed + ' missed</b>' : 'none missed') : 'No classes ' + (range === 'week' ? 'in the last 7 days' : 'yet')) + '</span>' +
      '<div class="seg" role="group" aria-label="Range"><button type="button" data-range="week" aria-pressed="' + (range === 'week') + '">Last 7 days</button><button type="button" data-range="sem" aria-pressed="' + (range === 'sem') + '">Whole semester</button></div></div>' +
      '<div class="cls-list">' + list.map(function (c) {
        return '<span class="cls' + (c.missed ? ' miss' : '') + '">' + esc(N.fmtDate(c.on, { day: 'numeric', month: 'short' })) + ' · P' + c.period + (c.missed ? ' <b>absent</b>' : '') + '</span>';
      }).join('') + '</div>';
  }

  app.innerHTML =
    '<section class="stats" aria-label="Summary">' +
      '<div class="stat' + (overall < 75 ? ' is-risk' : '') + '"><div class="eyebrow">Overall</div><div class="stat-value">' + overall + '<small>%</small></div><div class="meter"><i style="width:' + Math.min(100, overall) + '%"></i></div></div>' +
      '<div class="stat"><div class="eyebrow">Classes attended</div><div class="stat-value">' + attended + '<small> / ' + held + '</small></div><div class="stat-note">' + (held - attended) + ' missed</div></div>' +
      '<div class="stat' + (short.length ? ' is-risk' : '') + '"><div class="eyebrow">Below 75%</div><div class="stat-value">' + short.length + '<small> of ' + rows.length + '</small></div><div class="stat-note">' + (short.length ? esc(short.map(function (s) { return s.subject_code; }).join(', ')) : 'Every subject is above 75%') + '</div></div>' +
    '</section>' +
    '<section class="card"><div class="table-wrap"><table class="data"><thead><tr>' +
      '<th scope="col">Code</th><th scope="col">Subject</th><th scope="col">Faculty</th><th scope="col">Held</th><th scope="col">Attended</th><th scope="col">Percentage</th><th scope="col">Status</th>' +
    '</tr></thead><tbody>' + rows.map(function (r, i) {
      var cls = r.short ? 'risk' : canMiss(r) === 0 ? 'watch' : '';
      return '<tr class="' + cls + '"><td class="code">' + esc(r.subject_code) + '</td>' +
        '<td><button type="button" class="expand" aria-expanded="false" aria-controls="d' + i + '" data-i="' + i + '">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>' + esc(r.subject_name) + '</button></td>' +
        '<td class="fac">' + esc(teacher[r.section_id + ':' + r.subject_id] || '') + '</td>' +
        '<td class="n">' + r.held + '</td><td class="n">' + r.attended + '</td>' +
        '<td><div class="pbar"><div class="track mark"><i style="width:' + Math.min(100, Number(r.percentage)) + '%"></i></div><span class="v">' + r.percentage + '%</span></div></td>' +
        '<td>' + status(r) + '</td></tr>' +
        '<tr class="detail" id="d' + i + '" hidden><td colspan="7"></td></tr>';
    }).join('') + '</tbody></table></div>' +
    '<p class="foot-note">A corrected entry shows here as soon as your teacher saves it.</p></section>';

  // Open a subject to see its classes. The range toggle is shared by all rows.
  app.addEventListener('click', function (e) {
    var b = e.target.closest('.expand');
    if (b) {
      var i = Number(b.getAttribute('data-i')), tr = N.$('d' + i), open = b.getAttribute('aria-expanded') !== 'true';
      b.setAttribute('aria-expanded', String(open)); tr.hidden = !open;
      if (open) tr.firstChild.innerHTML = detail(rows[i]);
      return;
    }
    var seg = e.target.closest('[data-range]');
    if (seg) {
      range = seg.getAttribute('data-range');
      app.querySelectorAll('.expand[aria-expanded="true"]').forEach(function (x) {
        N.$('d' + x.getAttribute('data-i')).firstChild.innerHTML = detail(rows[Number(x.getAttribute('data-i'))]);
      });
    }
  });
})();
