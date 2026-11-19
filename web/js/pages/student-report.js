/* One student's report: details, attendance and published marks by subject,
   and verified certificates. For their mentor (from Mentees) and the HOD
   (from People). "Save as PDF" is the browser's print dialog: the page has
   print styles, so the PDF is the report without the sidebar or buttons.

   What shows is what the database lets this person read: a mentor sees their
   own mentees, the HOD anyone. Anyone else gets "not found". */
(async function () {
  'use strict';
  var N = NEST, sb = N.sb, esc = N.esc, must = N.must;
  var me = await N.requireRole(['faculty', 'admin']);
  var term = await N.currentTerm();
  var back = me.role === 'admin' ? 'people.html' : 'mentees.html';
  var app = N.shell(me, { active: me.role === 'admin' ? 'people' : 'mentees', title: 'Student report' });

  var sid = N.param('s');
  var p = sid && /^[0-9a-f-]{36}$/i.test(sid)
    ? (await must(sb.from('profiles').select('id, full_name, usn, dept, semester, email, phone, father_name, father_phone, mother_name, mother_phone').eq('id', sid).eq('role', 'student').maybeSingle())).data
    : null;
  if (!p) {
    app.innerHTML = '<div class="card"><p class="msg err">Student not found, or not one of your mentees.</p><a class="btn" href="' + back + '">Back</a></div>';
    return;
  }

  var allTerms = N.param('all') === '1';
  var scope = function (q) { return allTerms ? q : N.inTerm(q, 'term_id', term); };
  var res = await Promise.all([
    must(scope(sb.from('v_student_attendance').select('subject_code, subject_name, held, attended, percentage, short').eq('student_id', p.id)).order('subject_code')),
    must(scope(sb.from('v_student_scorecard').select('subject_code, subject_name, title, scored, max_marks, percentage').eq('student_id', p.id)).order('subject_code')),
    sb.from('mentorships').select('profiles!mentorships_mentor_id_fkey(full_name)').eq('student_id', p.id).maybeSingle(),
    sb.from('certificates').select('title, provider, issued_on').eq('student_id', p.id).eq('status', 'verified').order('issued_on', { ascending: false })
  ]);
  var att = res[0].data || [], marks = res[1].data || [];
  var mentor = res[2].data && res[2].data.profiles ? res[2].data.profiles.full_name : (me.role === 'faculty' ? me.full_name : null);
  var certs = res[3].error ? null : (res[3].data || []);

  N.setHead(p.full_name, [p.usn, p.dept && p.semester ? p.dept + ' · Semester ' + p.semester : null].filter(Boolean).join(' · '));

  var held = 0, attended = 0;
  att.forEach(function (r) { held += Number(r.held); attended += Number(r.attended); });
  var overall = N.pct(attended, held);
  var short = att.filter(function (r) { return r.short; });

  // marks: one row per subject, each assessment as "IAT 1 18/25"
  var bySub = {};
  marks.forEach(function (m) {
    var s = bySub[m.subject_code] || (bySub[m.subject_code] = { name: m.subject_name, items: [], scored: 0, out: 0 });
    s.items.push(m);
    if (m.scored != null) { s.scored += Number(m.scored); s.out += Number(m.max_marks); }
  });
  var subs = Object.keys(bySub).sort();

  function dl(rows) {
    return '<dl class="kv">' + rows.filter(function (r) { return r[1]; }).map(function (r) { return '<dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd>'; }).join('') + '</dl>';
  }
  var num = function (v) { return Number(v) % 1 ? Number(v).toFixed(1) : String(Number(v)); };

  app.innerHTML =
    '<div class="row no-print" style="margin-bottom:16px;gap:8px;flex-wrap:wrap">' +
      '<button class="btn primary" id="print">Save as PDF</button>' +
      '<a class="btn" href="?s=' + encodeURIComponent(p.id) + (allTerms ? '' : '&all=1') + '">' + (allTerms ? 'This term only' : 'Include earlier terms') + '</a>' +
      '<a class="btn" href="' + back + '">Back</a></div>' +
    '<p class="dim" style="margin:0 0 16px">' + esc((allTerms ? 'All terms' : term ? term.name : 'All terms') + ' · prepared ' + N.fmtDate(N.localISO()) + ' by ' + me.full_name) + '</p>' +

    '<div class="grid2">' +
      '<section class="card"><div class="card-head"><h2>Student</h2></div>' +
        dl([['Name', p.full_name], ['USN', p.usn], ['Department', p.dept], ['Semester', p.semester ? String(p.semester) : ''], ['Email', p.email], ['Phone', p.phone], ['Mentor', mentor]]) + '</section>' +
      '<section class="card"><div class="card-head"><h2>Parents</h2></div>' +
        (p.father_name || p.mother_name
          ? dl([['Father', p.father_name], ['Father\'s phone', p.father_phone], ['Mother', p.mother_name], ['Mother\'s phone', p.mother_phone]])
          : '<p class="empty">Not filled in.</p>') + '</section>' +
    '</div>' +

    '<section class="card"><div class="card-head"><h2>Attendance</h2><span class="aside">' +
      (overall == null ? 'No classes marked' : 'Overall ' + overall + '% · ' + attended + ' of ' + held + ' classes') + '</span></div>' +
      (att.length ? '<div class="table-wrap"><table class="data"><thead><tr><th>Subject</th><th>Held</th><th>Attended</th><th>%</th><th></th></tr></thead><tbody>' +
        att.map(function (r) {
          return '<tr class="' + (r.short ? 'risk' : '') + '"><td class="subj">' + esc(r.subject_name) + ' <span class="code">' + esc(r.subject_code) + '</span></td>' +
            '<td class="n">' + r.held + '</td><td class="n">' + r.attended + '</td><td class="n">' + num(r.percentage) + '%</td>' +
            '<td>' + (r.short ? '<span class="pill risk">Below 75%</span>' : '<span class="pill ok">Fine</span>') + '</td></tr>';
        }).join('') + '</tbody></table></div>' +
        (short.length ? '<p class="foot-note">Below 75% in ' + short.length + ' subject' + (short.length === 1 ? '' : 's') + '.</p>' : '')
      : '<p class="empty">No attendance marked yet.</p>') + '</section>' +

    '<section class="card"><div class="card-head"><h2>Marks</h2><span class="aside">Published only</span></div>' +
      (subs.length ? '<div class="table-wrap"><table class="data"><thead><tr><th>Subject</th><th>Assessments</th><th>Total</th></tr></thead><tbody>' +
        subs.map(function (k) {
          var s = bySub[k];
          return '<tr><td class="subj">' + esc(s.name) + ' <span class="code">' + esc(k) + '</span></td>' +
            '<td>' + s.items.map(function (m) { return esc(m.title) + ' ' + (m.scored == null ? '—' : num(m.scored)) + '/' + num(m.max_marks); }).join(' · ') + '</td>' +
            '<td class="n">' + (s.out ? num(s.scored) + '/' + num(s.out) + ' (' + N.pct(s.scored, s.out) + '%)' : '—') + '</td></tr>';
        }).join('') + '</tbody></table></div>' : '<p class="empty">No marks published yet.</p>') + '</section>' +

    (certs === null ? '' :
    '<section class="card"><div class="card-head"><h2>Certificates</h2><span class="aside">Verified by the mentor</span></div>' +
      (certs.length ? '<ul class="list">' + certs.map(function (c) {
        return '<li><div class="title-line">' + esc(c.title) + '</div><div class="meta-line">' + esc([c.provider, c.issued_on ? N.fmtDate(c.issued_on) : null].filter(Boolean).join(' · ')) + '</div></li>';
      }).join('') + '</ul>' : '<p class="empty">None verified yet.</p>') + '</section>');

  N.$('print').addEventListener('click', function () {
    var was = document.title;
    // the PDF's suggested file name
    document.title = 'NEST report ' + (p.usn || p.full_name) + ' ' + N.localISO();
    window.print();
    document.title = was;
  });
})();
