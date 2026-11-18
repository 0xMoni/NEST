/* Class report: every student's attendance in one of the teacher's classes,
   who is below 75%, and who is one missed class away from it. */
(async function () {
  'use strict';
  var N = NEST, sb = N.sb, esc = N.esc, must = N.must;
  var me = await N.requireRole('faculty');
  var app = N.shell(me, { active: 'report', title: 'Class report', sub: 'Attendance per student, for one class at a time.' });

  var as = await must(sb.from('faculty_assignments').select('id, section_id, subject_id, sections!inner(dept, semester, name), subjects!inner(code, name)').eq('faculty_id', me.id));
  var classes = (as.data || []).sort(function (a, b) { return (a.subjects.code + N.sectionLabel(a.sections)).localeCompare(b.subjects.code + N.sectionLabel(b.sections)); });
  if (!classes.length) {
    app.innerHTML = '<div class="card"><p class="empty">You are not assigned to any class yet. The HOD sets this.</p></div>';
    return;
  }

  var chosen = classes.filter(function (c) { return c.id === N.param('a'); })[0] || classes[0];
  var filter = N.param('show') || 'all';

  var res = await Promise.all([
    // The roster view: name and USN only. Subject teachers can't read students' profiles.
    must(sb.from('v_class_roster').select('student_id, full_name, usn').eq('section_id', chosen.section_id)),
    must(sb.from('v_student_attendance').select('student_id, held, attended, percentage, short').eq('section_id', chosen.section_id).eq('subject_id', chosen.subject_id)),
    must(sb.from('attendance_sessions').select('id', { count: 'exact', head: true }).eq('assignment_id', chosen.id))
  ]);
  var stats = {}; (res[1].data || []).forEach(function (r) { stats[r.student_id] = r; });
  var sessions = res[2].count || 0;

  // (a+k)/(h+k) >= 3/4  =>  k >= 3h - 4a : classes in a row needed to recover.
  function toRecover(s) { return Math.max(0, 3 * s.held - 4 * s.attended); }
  var students = (res[0].data || []).map(function (e) {
    var p = { id: e.student_id, full_name: e.full_name, usn: e.usn }, s = stats[p.id], held = s ? Number(s.held) : 0, att = s ? Number(s.attended) : 0;
    var pc = s ? Number(s.percentage) : null;
    // One away: fine now, but a single absence next class drops them below 75%.
    var edge = held > 0 && pc >= 75 && (att / (held + 1)) * 100 < 75;
    return { id: p.id, name: p.full_name, usn: p.usn, held: held, attended: att, pct: pc, short: !!(s && s.short), edge: edge };
  }).sort(function (a, b) { return (a.usn || '').localeCompare(b.usn || ''); });

  var short = students.filter(function (s) { return s.short; }), edge = students.filter(function (s) { return s.edge; });
  var shown = filter === 'short' ? short : filter === 'edge' ? edge : students;

  function link(params) {
    var q = new URLSearchParams({ a: chosen.id, show: params.show || filter });
    return '?' + q.toString();
  }

  app.innerHTML =
    '<div class="tools"><label class="field" style="min-width:280px">Class<select id="pick">' + classes.map(function (c) {
      return '<option value="' + esc(c.id) + '"' + (c.id === chosen.id ? ' selected' : '') + '>' + esc(c.subjects.name) + ' · ' + esc(N.sectionLabel(c.sections)) + '</option>';
    }).join('') + '</select></label></div>' +
    '<section class="stats">' +
      '<div class="stat"><div class="eyebrow">Classes held</div><div class="stat-value">' + sessions + '</div><div class="stat-note">' + esc(chosen.subjects.code) + ' · ' + esc(N.sectionLabel(chosen.sections)) + '</div></div>' +
      '<a class="stat' + (short.length ? ' is-risk' : '') + '" href="' + link({ show: 'short' }) + '"><div class="eyebrow">Below 75%</div><div class="stat-value">' + short.length + '<small> of ' + students.length + '</small></div><div class="stat-note">Show only these</div></a>' +
      '<a class="stat" href="' + link({ show: 'edge' }) + '"><div class="eyebrow">One miss away</div><div class="stat-value">' + edge.length + '</div><div class="stat-note">Fine today, short after one more absence</div></a>' +
    '</section>' +
    '<section class="card"><div class="card-head"><h2>' + (filter === 'short' ? 'Below 75%' : filter === 'edge' ? 'One miss away' : 'Every student') + '</h2>' +
      '<div class="seg" role="group" aria-label="Show">' +
        [['all', 'All'], ['short', 'Below 75%'], ['edge', 'One miss away']].map(function (o) {
          return '<a class="btn sm" style="border:0;min-height:30px' + (filter === o[0] ? ';background:var(--text);color:var(--bg)' : '') + '" href="' + link({ show: o[0] }) + '"' + (filter === o[0] ? ' aria-current="true"' : '') + '>' + o[1] + '</a>';
        }).join('') + '</div></div>' +
      (!students.length ? '<p class="empty">No students are enrolled in this section yet.</p>'
        : !shown.length ? '<p class="empty">No one here. ' + (filter === 'all' ? '' : '<a class="link" href="' + link({ show: 'all' }) + '">Show everyone</a>') + '</p>'
        : '<div class="table-wrap"><table class="data"><thead><tr><th>USN</th><th>Name</th><th>Attended</th><th>Percentage</th><th>Status</th></tr></thead><tbody>' +
          shown.map(function (s) {
            return '<tr class="' + (s.short ? 'risk' : s.edge ? 'watch' : '') + '"><td class="code">' + esc(s.usn || '') + '</td><td class="subj">' + esc(s.name) + '</td>' +
              '<td class="n">' + (s.held ? s.attended + ' / ' + s.held : '—') + '</td>' +
              '<td>' + (s.pct == null ? '<span class="dim">No classes yet</span>' : '<div class="pbar"><div class="track mark"><i style="width:' + Math.min(100, s.pct) + '%"></i></div><span class="v">' + s.pct + '%</span></div>') + '</td>' +
              '<td>' + (s.short ? '<span class="pill risk">Short</span> <span class="dim">needs ' + toRecover(s) + ' in a row</span>' : s.edge ? '<span class="pill watch">One miss away</span>' : s.pct == null ? '' : '<span class="pill ok">Fine</span>') + '</td></tr>';
          }).join('') + '</tbody></table></div>') +
      '<p class="foot-note">75% is the minimum per subject.</p>' +
    '</section>';

  // Excel: the whole class whatever filter is showing; whole term, or a date range (both ends optional).
  var xh = document.createElement('div'); xh.className = 'tools'; xh.style.alignItems = 'flex-end';
  xh.innerHTML = '<label class="field">From<input type="date" id="xFrom" max="' + N.localISO() + '"></label>' +
    '<label class="field">To<input type="date" id="xTo" max="' + N.localISO() + '"></label><div id="xbtns"></div>';
  app.querySelector('.tools').after(xh);
  N.exportXlsx.buttons(N.$('xbtns'), me, function () {
    var from = N.$('xFrom').value, to = N.$('xTo').value;
    if (from && to && from > to) throw new Error('"From" is after "To".');
    return N.exportXlsx.classWorkbook(chosen.id, 'summary', from, to);
  });

  N.$('pick').addEventListener('change', function (e) { location.search = '?a=' + encodeURIComponent(e.target.value); });
})();
