/* HOD structure: sections, subjects, and who teaches what where. Everything
   else (attendance, marks, timetable) hangs off a teaching assignment. The
   "admin writes …" policies decide whether each write lands. */
(async function () {
  'use strict';
  var N = NEST, sb = N.sb, esc = N.esc, must = N.must;
  var me = await N.requireRole('admin');
  var term = await N.currentTerm();   // pages show the current term's sections
  var app = N.shell(me, { active: 'structure', title: 'Structure', sub: 'Sections, subjects, and who teaches what.' });

  async function load() {
    var res = await Promise.all([
      must(N.inTerm(sb.from('sections').select('id, dept, semester, name'), 'term_id', term).order('dept').order('semester').order('name')),
      must(sb.from('subjects').select('id, code, name, semester, credits').order('semester').order('code')),
      must(N.inTerm(sb.from('faculty_assignments').select('id, section_id, subject_id, sections!inner(dept, semester, name), subjects!inner(code, name), profiles!inner(full_name)'), 'sections.term_id', term)),
      must(sb.from('profiles').select('id, full_name, designation').eq('role', 'faculty').order('full_name')),
      N.mustAll(function () { return sb.from('section_students').select('section_id, student_id').order('section_id').order('student_id'); }),
      // not must(): a database from before terms has no such table, and the rest still works
      sb.from('academic_terms').select('id, name, starts_on, ends_on, is_current').order('starts_on', { ascending: false })
    ]);
    terms = res[5].error ? null : (res[5].data || []);
    render(res[0].data || [], res[1].data || [], res[2].data || [], res[3].data || [], res[4].data || []);
  }

  var terms = null;

  function termsCard() {
    if (!terms) return '';
    var opts = function (sel) { return terms.map(function (t) { return '<option value="' + esc(t.id) + '"' + (t.id === sel ? ' selected' : '') + '>' + esc(t.name) + '</option>'; }).join(''); };
    var cur = terms.find(function (t) { return t.is_current; });
    var next = terms.find(function (t) { return !t.is_current && (!cur || t.starts_on > cur.starts_on); });
    return '<section class="card"><div class="card-head"><h2>Terms</h2><span class="aside">Pages show the current term. Earlier terms keep their records.</span></div>' +
      (terms.length ? '<div class="table-wrap"><table class="data compact"><thead><tr><th>Term</th><th>From</th><th>To</th><th></th></tr></thead><tbody>' +
        terms.map(function (t) {
          return '<tr><td class="subj">' + esc(t.name) + '</td><td>' + esc(N.fmtDate(t.starts_on)) + '</td><td>' + esc(N.fmtDate(t.ends_on)) + '</td>' +
            '<td class="actions">' + (t.is_current ? '<span class="pill ok">Current</span>' : '<button class="btn sm" data-current="' + esc(t.id) + '">Make current</button>') + '</td></tr>';
        }).join('') + '</tbody></table></div>' : '<p class="empty">No terms yet.</p>') +
      '<form data-form="term" class="form-grid" style="align-items:end;margin:18px 0 0" novalidate>' +
        '<label class="field">Name<input name="name" placeholder="2027 even semester" maxlength="60" required></label>' +
        '<label class="field">Starts<input name="starts_on" type="date" required></label>' +
        '<label class="field">Ends<input name="ends_on" type="date" required></label>' +
        '<button class="btn primary">Add term</button></form><p class="msg" data-msg="term"></p>' +
      (terms.length > 1 ?
        '<form data-form="promote" class="form-grid" style="align-items:end;margin:18px 0 0" novalidate>' +
          '<label class="field">Promote students from<select name="from">' + opts(cur && cur.id) + '</select></label>' +
          '<label class="field">into<select name="to">' + opts(next && next.id) + '</select></label>' +
          '<button class="btn">Promote</button></form>' +
        '<p class="note">Every section below semester 8 gets its next-semester section in the new term, with the same students. Semester 8 graduates. Subjects, teachers and the timetable are set again for the new term.</p>' +
        '<p class="msg" data-msg="promote"></p>' : '') +
    '</section>';
  }

  function render(sections, subjects, assignments, faculty, enrol) {
    var size = {}; enrol.forEach(function (e) { size[e.section_id] = (size[e.section_id] || 0) + 1; });
    assignments.sort(function (a, b) { return (N.sectionLabel(a.sections) + a.subjects.code).localeCompare(N.sectionLabel(b.sections) + b.subjects.code); });

    app.innerHTML = termsCard() +
      '<div class="grid2">' +
      '<section class="card"><div class="card-head"><h2>Sections</h2><span class="aside">' + (term ? esc(term.name) + ' · ' : '') + sections.length + '</span></div>' +
        (sections.length ? '<div class="table-wrap"><table class="data compact"><thead><tr><th>Section</th><th>Students</th></tr></thead><tbody>' +
          sections.map(function (s) { return '<tr><td class="subj">' + esc(N.sectionLabel(s)) + '</td><td class="n">' + (size[s.id] || 0) + '</td></tr>'; }).join('') +
          '</tbody></table></div>' : '<p class="empty">No sections yet.</p>') +
        '<form data-form="section" class="form-grid" style="align-items:end;margin:18px 0 0" novalidate>' +
          '<label class="field">Department<input name="dept" placeholder="CSE" maxlength="10" required></label>' +
          '<label class="field">Semester<input name="semester" type="number" min="1" max="8" value="5" required></label>' +
          '<label class="field">Section<input name="name" placeholder="A" maxlength="3" required></label>' +
          '<button class="btn primary">Add section</button></form><p class="msg" data-msg="section"></p>' +
      '</section>' +
      '<section class="card"><div class="card-head"><h2>Subjects</h2><span class="aside">' + subjects.length + '</span></div>' +
        (subjects.length ? '<div class="table-wrap"><table class="data compact"><thead><tr><th>Code</th><th>Subject</th><th>Sem</th><th>Credits</th></tr></thead><tbody>' +
          subjects.map(function (s) { return '<tr><td class="code">' + esc(s.code) + '</td><td>' + esc(s.name) + '</td><td class="n">' + s.semester + '</td><td class="n">' + s.credits + '</td></tr>'; }).join('') +
          '</tbody></table></div>' : '<p class="empty">No subjects yet.</p>') +
        '<form data-form="subject" class="form-grid" style="align-items:end;margin:18px 0 0" novalidate>' +
          '<label class="field">Code<input name="code" placeholder="BCS501" maxlength="12" required></label>' +
          '<label class="field">Name<input name="name" placeholder="Machine Learning" maxlength="80" required></label>' +
          '<label class="field">Semester<input name="semester" type="number" min="1" max="8" value="5" required></label>' +
          '<label class="field">Credits<input name="credits" type="number" min="0" max="10" value="4"></label>' +
          '<button class="btn primary">Add subject</button></form><p class="msg" data-msg="subject"></p>' +
      '</section></div>' +

      '<section class="card"><div class="card-head"><h2>Who teaches what</h2><span class="aside">One teacher per subject per section</span></div>' +
        (assignments.length ? '<div class="table-wrap"><table class="data"><thead><tr><th>Section</th><th>Subject</th><th>Teacher</th><th></th></tr></thead><tbody>' +
          assignments.map(function (a) {
            return '<tr><td class="subj">' + esc(N.sectionLabel(a.sections)) + '</td><td>' + esc(a.subjects.name) + ' <span class="code">' + esc(a.subjects.code) + '</span></td>' +
              '<td>' + esc(a.profiles.full_name) + '</td><td class="actions"><button class="btn sm danger" data-remove="' + esc(a.id) + '">Remove</button></td></tr>';
          }).join('') + '</tbody></table></div>' : '<p class="empty">No one is assigned yet.</p>') +
        (sections.length && subjects.length && faculty.length ?
          '<form data-form="assignment" class="form-grid" style="align-items:end;margin:18px 0 0" novalidate>' +
            '<label class="field">Section<select name="section_id">' + sections.map(function (s) { return '<option value="' + esc(s.id) + '">' + esc(N.sectionLabel(s)) + '</option>'; }).join('') + '</select></label>' +
            '<label class="field">Subject<select name="subject_id">' + subjects.map(function (s) { return '<option value="' + esc(s.id) + '">' + esc(s.code + ' · ' + s.name) + '</option>'; }).join('') + '</select></label>' +
            '<label class="field">Teacher<select name="faculty_id">' + faculty.map(function (f) { return '<option value="' + esc(f.id) + '">' + esc(f.full_name) + '</option>'; }).join('') + '</select></label>' +
            '<button class="btn primary">Assign</button></form>'
          : '<p class="note">Add a section, a subject and at least one faculty account first.</p>') +
        '<p class="msg" data-msg="assignment"></p>' +
      '</section>';
  }

  function msg(k) { return app.querySelector('[data-msg="' + k + '"]'); }

  app.addEventListener('submit', async function (e) {
    e.preventDefault();
    var f = e.target, kind = f.getAttribute('data-form'), el = f.elements, row, table, dup;
    if (kind === 'section') {
      row = { dept: el.dept.value.trim().toUpperCase(), semester: Number(el.semester.value), name: el.name.value.trim().toUpperCase() };
      if (!row.dept || !row.name || !(row.semester >= 1 && row.semester <= 8)) return N.say(msg(kind), 'err', 'Fill in a department, a semester from 1 to 8, and a section letter.');
      table = 'sections'; dup = 'That section already exists.';
    } else if (kind === 'subject') {
      row = { code: el.code.value.trim().toUpperCase(), name: el.name.value.trim(), semester: Number(el.semester.value), credits: el.credits.value === '' ? 4 : Number(el.credits.value) };
      if (!row.code || !row.name || !(row.semester >= 1 && row.semester <= 8)) return N.say(msg(kind), 'err', 'Fill in a code, a name, and a semester from 1 to 8.');
      table = 'subjects'; dup = 'A subject with that code already exists.';
    } else if (kind === 'term') {
      row = { name: el.name.value.trim(), starts_on: el.starts_on.value, ends_on: el.ends_on.value };
      if (!row.name || !N.isISODate(row.starts_on) || !N.isISODate(row.ends_on) || row.ends_on <= row.starts_on) return N.say(msg(kind), 'err', 'Give the term a name, and an end date after its start.');
      table = 'academic_terms'; dup = 'A term with that name already exists.';
    } else if (kind === 'promote') {
      var from = el.from.value, to = el.to.value;
      if (from === to) return N.say(msg(kind), 'err', 'Pick two different terms.');
      if (!confirm('Promote every section of ' + el.from.selectedOptions[0].text + ' into ' + el.to.selectedOptions[0].text + '?')) return;
      return N.busy(f.querySelector('.btn'), 'Promoting…', async function () {
        var p = await sb.rpc('promote_term', { p_from: from, p_to: to });
        if (p.error) return N.say(msg(kind), 'err', p.error.message);
        N.toast(p.data + ' student' + (p.data === 1 ? '' : 's') + ' promoted');
        await load();
        N.say(msg(kind), 'good', p.data + ' student' + (p.data === 1 ? '' : 's') + ' promoted. Make the new term current when it starts.');
      });
    } else if (kind === 'assignment') {
      row = { section_id: el.section_id.value, subject_id: el.subject_id.value, faculty_id: el.faculty_id.value };
      table = 'faculty_assignments'; dup = 'That section already has someone teaching this subject. Remove them first.';
    } else return;
    await N.busy(f.querySelector('.btn'), 'Saving…', async function () {
      var r = await sb.from(table).insert(row);
      if (r.error) return N.say(msg(kind), 'err', r.error.code === '23505' ? dup : r.error.message);
      N.toast('Saved');
      await load();
    });
  });

  app.addEventListener('click', async function (e) {
    var c = e.target.closest('[data-current]');
    if (c) {
      if (!confirm('Make this the current term? Every page switches to its sections, timetable and classes.')) return;
      return N.busy(c, 'Switching…', async function () {
        var r = await sb.rpc('make_term_current', { p_term: c.getAttribute('data-current') });
        if (r.error) return N.say(msg('term'), 'err', r.error.message);
        location.reload();   // the term is read once per page
      });
    }
    var b = e.target.closest('[data-remove]'); if (!b) return;
    var id = b.getAttribute('data-remove');
    await N.busy(b, 'Checking…', async function () {
      // A class with attendance or marks can't be removed: the database
      // refuses (it would otherwise lose the term's records). Checking first
      // means the HOD gets the reason in plain words.
      var used = await Promise.all([
        sb.from('attendance_sessions').select('id', { count: 'exact', head: true }).eq('assignment_id', id),
        sb.from('assessments').select('id', { count: 'exact', head: true }).eq('assignment_id', id)
      ]);
      if (used[0].error || used[1].error) return N.say(msg('assignment'), 'err', (used[0].error || used[1].error).message);
      if (used[0].count || used[1].count) {
        return N.say(msg('assignment'), 'err', 'This class already has ' + (used[0].count ? used[0].count + ' attendance session' + (used[0].count === 1 ? '' : 's') : '') +
          (used[0].count && used[1].count ? ' and ' : '') + (used[1].count ? used[1].count + ' assessment' + (used[1].count === 1 ? '' : 's') : '') +
          '. Removing it would delete those records, so it can\'t be removed here.');
      }
      if (!confirm('Remove this teaching assignment? Its timetable periods go with it.')) return;
      var r = await sb.from('faculty_assignments').delete().eq('id', id);
      if (r.error) return N.say(msg('assignment'), 'err', r.error.code === '23503' ? 'This class already has attendance or marks against it, so it can\'t be removed.' : r.error.message);
      N.toast('Removed');
      await load();
    });
  });

  await load();
})();
