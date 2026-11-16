/* Student scorecard: published marks only, per subject. */
(async function () {
  'use strict';
  var N = NEST, sb = N.sb, esc = N.esc, must = N.must;
  var me = await N.requireRole('student');
  var app = N.shell(me, { active: 'scorecard', title: 'Scorecard', sub: 'Only marks your teachers have published.' });

  var res = await Promise.all([
    // The view already leaves out unpublished assessments, and row-level
    // security keeps it to this student — a half-entered test cannot leak here.
    must(sb.from('v_student_scorecard').select('subject_id, subject_code, subject_name, title, scored, max_marks, percentage').eq('student_id', me.id)),
    must(sb.from('v_my_teachers').select('subject_id, subject_code, subject_name, faculty_name'))
  ]);
  var marks = res[0].data || [], classes = res[1].data || [];

  // Every subject the student takes, whether or not anything is published yet.
  var subjects = {};
  classes.forEach(function (a) {
    subjects[a.subject_id] = { code: a.subject_code, name: a.subject_name, who: a.faculty_name || '', items: [] };
  });
  marks.forEach(function (m) {
    var s = subjects[m.subject_id] || (subjects[m.subject_id] = { code: m.subject_code, name: m.subject_name, who: '', items: [] });
    s.items.push(m);
  });
  var list = Object.keys(subjects).map(function (k) { return subjects[k]; })
    .sort(function (a, b) { return a.code.localeCompare(b.code); });

  if (!list.length) {
    app.innerHTML = '<div class="card"><p class="empty">You are not enrolled in any subjects yet.</p></div>';
    return;
  }

  var published = list.filter(function (s) { return s.items.length; });
  var totalScored = 0, totalOut = 0;
  marks.forEach(function (m) { if (m.scored != null) { totalScored += Number(m.scored); totalOut += Number(m.max_marks); } });

  function tone(p) { return p == null ? '' : p < 40 ? 'risk' : p < 60 ? 'watch' : ''; }

  app.innerHTML =
    '<section class="stats" aria-label="Summary">' +
      '<div class="stat"><div class="eyebrow">Subjects with marks</div><div class="stat-value">' + published.length + '<small> of ' + list.length + '</small></div><div class="stat-note">' + marks.length + ' published assessment' + (marks.length === 1 ? '' : 's') + '</div></div>' +
      '<div class="stat"><div class="eyebrow">Overall</div><div class="stat-value">' + (totalOut ? N.pct(totalScored, totalOut) + '<small>%</small>' : '—') + '</div><div class="stat-note">' + (totalOut ? totalScored + ' of ' + totalOut + ' marks' : 'Nothing published yet') + '</div></div>' +
    '</section>' +
    '<section class="card"><div class="table-wrap"><table class="data"><thead><tr>' +
      '<th scope="col">Code</th><th scope="col">Subject</th><th scope="col">Assessment</th><th scope="col">Marks</th><th scope="col">Percentage</th>' +
    '</tr></thead><tbody>' + list.map(function (s) {
      if (!s.items.length) {
        return '<tr><td class="code">' + esc(s.code) + '</td><td class="subj">' + esc(s.name) + '</td>' +
          '<td colspan="3" class="dim">Not published yet' + (s.who ? ' by ' + esc(s.who) : '') + '</td></tr>';
      }
      s.items.sort(function (a, b) { return a.title.localeCompare(b.title); });
      return s.items.map(function (m, i) {
        var p = m.percentage == null ? null : Number(m.percentage);
        return '<tr class="' + tone(p) + '">' +
          (i === 0 ? '<td class="code" rowspan="' + s.items.length + '">' + esc(s.code) + '</td><td class="subj" rowspan="' + s.items.length + '">' + esc(s.name) + (s.who ? '<div class="meta-line">' + esc(s.who) + '</div>' : '') + '</td>' : '') +
          '<td>' + esc(m.title) + '</td>' +
          '<td class="n">' + (m.scored == null ? '<span class="dim">Absent / not entered</span>' : m.scored + ' <span class="dim">/ ' + Number(m.max_marks) + '</span>') + '</td>' +
          '<td>' + (p == null ? '' : '<div class="pbar"><div class="track"><i style="width:' + Math.min(100, p) + '%"></i></div><span class="v">' + p + '%</span></div>') + '</td></tr>';
      }).join('');
    }).join('') + '</tbody></table></div>' +
    '<p class="foot-note">Marks appear the moment a teacher publishes them, and change if they correct one.</p></section>';
})();
