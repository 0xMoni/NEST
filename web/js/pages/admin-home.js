/* HOD overview: how much of the department is set up, and what is missing. */
(async function () {
  'use strict';
  var N = NEST, sb = N.sb, esc = N.esc, must = N.must;
  var me = await N.requireRole('admin');
  var app = N.shell(me, { active: 'home', title: 'Overview', sub: 'The department at a glance.' });

  function count(table, filter) {
    var q = sb.from(table).select('*', { count: 'exact', head: true });
    if (filter) q = filter(q);
    return must(q).then(function (r) { return r.count || 0; });
  }
  var c = await Promise.all([
    count('profiles', function (q) { return q.eq('role', 'student'); }),
    count('profiles', function (q) { return q.eq('role', 'faculty'); }),
    count('sections'), count('subjects'), count('faculty_assignments'), count('timetable_slots'),
    count('mentorships'), count('section_students'),
    count('profiles', function (q) { return q.eq('must_change_password', true); })
  ]);
  var secs = (await must(sb.from('sections').select('id, dept, semester, name'))).data || [];
  secs.sort(function (a, b) { return N.sectionLabel(a).localeCompare(N.sectionLabel(b)); });
  var students = c[0], faculty = c[1], sections = c[2], subjects = c[3], assignments = c[4], slots = c[5], mentored = c[6], enrolled = c[7], defaultPw = c[8];

  function stat(href, label, value, note, risk) {
    return '<a class="stat' + (risk ? ' is-risk' : '') + '" href="' + href + '"><div class="eyebrow">' + label + '</div><div class="stat-value">' + value + '</div><div class="stat-note">' + note + '</div></a>';
  }
  // What still needs doing, in the order things depend on each other.
  var todo = [];
  if (!sections) todo.push(['Create a section', 'structure.html']);
  if (!subjects) todo.push(['Add the subjects', 'structure.html']);
  if (sections && subjects && !assignments) todo.push(['Assign a teacher to each subject in each section', 'structure.html']);
  if (assignments && !slots) todo.push(['Build the timetable', 'timetable.html']);
  if (students > enrolled) todo.push([(students - enrolled) + ' student account' + (students - enrolled === 1 ? ' is' : 's are') + ' not enrolled in a section (done by the import script for now)', 'people.html']);
  if (students > mentored) todo.push([(students - mentored) + ' student' + (students - mentored === 1 ? ' has' : 's have') + ' no mentor (assigned by the import script for now)', 'people.html']);

  app.innerHTML =
    '<section class="stats">' +
      stat('people.html', 'Students', students, enrolled + ' enrolled in a section') +
      stat('people.html', 'Faculty', faculty, mentored + ' students have a mentor') +
      stat('structure.html', 'Sections & subjects', sections + '<small> / ' + subjects + '</small>', assignments + ' teaching assignments') +
      stat('timetable.html', 'Timetable', slots + '<small> periods</small>', 'set across all sections') +
    '</section>' +
    (defaultPw ? '<div class="banner">' + defaultPw + ' account' + (defaultPw === 1 ? ' is' : 's are') + ' still on the default password. They are asked to pick their own the next time they sign in.</div>' : '') +
    '<section class="card"><div class="card-head"><h2>Still to do</h2></div>' +
      (todo.length ? '<ul class="list">' + todo.map(function (t) { return '<li><div class="list-row"><span>' + esc(t[0]) + '</span><a class="link" href="' + t[1] + '">Open</a></div></li>'; }).join('') + '</ul>'
                   : '<p class="empty">Everything is set up.</p>') +
    '</section>' +
    // A section's attendance as one Excel file: every subject side by side, then one register sheet per subject.
    '<section class="card"><div class="card-head"><h2>Attendance in Excel</h2></div>' +
      (secs.length
        ? '<div class="tools" style="align-items:flex-end;margin:0"><label class="field" style="min-width:200px">Section<select id="xsec">' +
            secs.map(function (x) { return '<option value="' + esc(x.id) + '">' + esc(N.sectionLabel(x)) + '</option>'; }).join('') +
          '</select></label><div id="xbtns"></div></div>' +
          '<p class="foot-note">Every subject\'s percentage per student, who is below 75%, and the full date-by-date register for each subject.</p>'
        : '<p class="empty">Create a section first.</p>') +
    '</section>';

  if (secs.length) N.exportXlsx.buttons(N.$('xbtns'), me, function () { return N.exportXlsx.sectionWorkbook(N.$('xsec').value); });
})();
