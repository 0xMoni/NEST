/* Teacher marks: create an assessment, enter marks as a draft, publish.
   Students see nothing until it is published — the database enforces that,
   not this page. */
(async function () {
  'use strict';
  var N = NEST, sb = N.sb, esc = N.esc, must = N.must;
  var me = await N.requireRole('faculty');
  var app = N.shell(me, { active: 'marks', title: 'Marks', sub: 'IAT marks. Students see nothing until you publish.' });

  var id = N.param('id');
  return id ? entry(id) : list();

  // ---------------------------------------------------------------- all assessments

  async function list() {
    var res = await Promise.all([
      must(sb.from('faculty_assignments').select('id, sections!inner(dept, semester, name), subjects!inner(code, name)').eq('faculty_id', me.id)),
      must(sb.from('assessments').select('id, title, max_marks, held_on, published, assignment_id, created_at, marks(count)').order('created_at', { ascending: false }))
    ]);
    var as = res[0].data || [], ts = res[1].data || [];
    var byId = {}; as.forEach(function (a) { byId[a.id] = a; });
    ts = ts.filter(function (t) { return byId[t.assignment_id]; }); // only this teacher's classes

    if (!as.length) {
      app.innerHTML = '<div class="card"><p class="empty">You are not assigned to any class yet. The HOD sets this.</p></div>';
      return;
    }

    var opts = as.map(function (a) { return '<option value="' + esc(a.id) + '">' + esc(a.subjects.name) + ' · ' + esc(N.sectionLabel(a.sections)) + '</option>'; }).join('');
    app.innerHTML =
      '<section class="card"><div class="card-head"><h2>New assessment</h2><span class="aside">Starts as a draft</span></div>' +
        '<form id="nf" class="form-grid" style="align-items:end;margin:0" novalidate>' +
          '<label class="field wide">Class<select name="a" required>' + opts + '</select></label>' +
          '<label class="field">Title<input name="title" value="IAT 1" maxlength="60" required></label>' +
          '<label class="field">Out of<input name="max" type="number" min="1" max="999" step="0.5" value="25" required></label>' +
          '<label class="field">Held on<input name="on" type="date"></label>' +
          '<button class="btn primary">Create</button>' +
        '</form><p class="msg" id="nmsg" role="status"></p></section>' +
      '<section class="card"><div class="card-head"><h2>Your assessments</h2></div>' +
        (ts.length ? '<div class="table-wrap"><table class="data"><thead><tr><th>Assessment</th><th>Class</th><th>Out of</th><th>Entered</th><th>Status</th><th></th></tr></thead><tbody>' +
          ts.map(function (t) {
            var a = byId[t.assignment_id], n = t.marks && t.marks[0] ? t.marks[0].count : 0;
            return '<tr><td class="subj">' + esc(t.title) + (t.held_on ? '<div class="meta-line">' + esc(N.fmtDate(t.held_on)) + '</div>' : '') + '</td>' +
              '<td>' + esc(a.subjects.name) + ' <span class="dim">' + esc(N.sectionLabel(a.sections)) + '</span></td>' +
              '<td class="n">' + Number(t.max_marks) + '</td><td class="n">' + n + '</td>' +
              '<td>' + (t.published ? '<span class="pill ok">Published</span>' : '<span class="pill muted">Draft</span>') + '</td>' +
              '<td class="actions"><a class="btn sm" href="?id=' + encodeURIComponent(t.id) + '">Enter marks</a></td></tr>';
          }).join('') + '</tbody></table></div>' : '<p class="empty">No assessments yet. Create one above.</p>') +
      '</section>';

    N.$('nf').addEventListener('submit', async function (e) {
      e.preventDefault();
      var f = e.target, m = N.$('nmsg'), title = f.elements.title.value.trim(), max = Number(f.elements.max.value);
      if (!title) { f.elements.title.focus(); return N.say(m, 'err', 'Give it a title, like IAT 1.'); }
      if (!(max > 0) || max > 999) { f.elements.max.focus(); return N.say(m, 'err', '"Out of" must be a number above 0.'); }
      await N.busy(f.querySelector('.btn'), 'Creating…', async function () {
        var r = await sb.from('assessments').insert({ assignment_id: f.elements.a.value, title: title, max_marks: max, held_on: f.elements.on.value || null }).select('id').single();
        if (r.error) return N.say(m, 'err', r.error.message);
        location.search = '?id=' + encodeURIComponent(r.data.id);
      });
    });
  }

  // ---------------------------------------------------------------- one assessment

  async function entry(aid) {
    var t = await must(sb.from('assessments')
      .select('id, title, max_marks, published, assignment_id, faculty_assignments!inner(faculty_id, section_id, sections!inner(dept, semester, name), subjects!inner(code, name))')
      .eq('id', aid).maybeSingle());
    if (!t.data || t.data.faculty_assignments.faculty_id !== me.id) {
      app.innerHTML = '<div class="card"><p class="msg err">Not found, or it is not yours.</p><a class="btn" href="marks.html">Back</a></div>';
      return;
    }
    var A = t.data, fa = A.faculty_assignments, max = Number(A.max_marks), published = A.published, dirty = false;
    N.setHead(A.title + ' · ' + fa.subjects.name, N.sectionLabel(fa.sections) + ' · out of ' + max);

    var res = await Promise.all([
      // The roster view: name and USN only. Subject teachers can't read students' profiles.
      must(sb.from('v_class_roster').select('student_id, full_name, usn').eq('section_id', fa.section_id)),
      must(sb.from('marks').select('student_id, scored').eq('assessment_id', aid))
    ]);
    var students = (res[0].data || []).map(function (r) { return { id: r.student_id, full_name: r.full_name, usn: r.usn }; }).sort(function (x, y) { return (x.usn || '').localeCompare(y.usn || ''); });
    var saved = {}; (res[1].data || []).forEach(function (m) { saved[m.student_id] = m.scored; });

    if (!students.length) {
      app.innerHTML = '<div class="card"><p class="empty">No students are enrolled in this section yet.</p><a class="btn" href="marks.html">Back</a></div>';
      return;
    }

    app.innerHTML =
      '<div class="banner" id="state"></div>' +
      '<section class="card"><div class="table-wrap"><table class="data"><thead><tr><th>USN</th><th>Student</th><th>Marks (out of ' + max + ')</th></tr></thead><tbody>' +
        students.map(function (s) {
          var v = saved[s.id];
          return '<tr><td class="code">' + esc(s.usn || '') + '</td><td>' + esc(s.full_name) + '</td>' +
            '<td><input class="sc" type="number" inputmode="decimal" min="0" max="' + max + '" step="0.5" data-id="' + esc(s.id) + '" value="' + (v == null ? '' : esc(v)) + '" aria-label="Marks for ' + esc(s.full_name) + '"></td></tr>';
        }).join('') + '</tbody></table></div>' +
        '<p class="foot-note">Leave a box empty for someone who was absent or whose marks are not in yet.</p>' +
        '<div class="save-bar"><button class="btn primary" id="save">Save marks</button><button class="btn" id="pub"></button>' +
          '<a class="btn" href="marks.html">Back</a><p class="msg" id="msg" role="status" style="margin:0"></p></div>' +
      '</section>';

    function paint() {
      var st = N.$('state');
      st.className = 'banner' + (published ? '' : '');
      st.innerHTML = published ? '<b>Published.</b> Students can see these marks. Anything you save now, they see straight away.'
                               : '<b>Draft.</b> Students cannot see these yet. Save as often as you like, then publish.';
      N.$('pub').textContent = published ? 'Unpublish' : 'Publish to students';
    }
    paint();
    var msg = N.$('msg');
    app.addEventListener('input', function (e) { if (e.target.matches('input.sc')) { dirty = true; e.target.removeAttribute('aria-invalid'); N.say(msg, '', ''); } });
    addEventListener('beforeunload', function (e) { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

    function collect() {
      var bad = null, rows = [];
      app.querySelectorAll('input.sc').forEach(function (i) {
        var raw = i.value.trim(), n = raw === '' ? null : Number(raw);
        if (n !== null && (isNaN(n) || n < 0 || n > max)) { i.setAttribute('aria-invalid', 'true'); bad = bad || i; }
        rows.push({ assessment_id: aid, student_id: i.getAttribute('data-id'), scored: n });
      });
      return { bad: bad, rows: rows };
    }

    async function saveMarks() {
      var c = collect();
      if (c.bad) { c.bad.focus(); N.say(msg, 'err', 'Marks must be between 0 and ' + max + '.'); return false; }
      var r = await sb.from('marks').upsert(c.rows, { onConflict: 'assessment_id,student_id' });
      if (r.error) { N.say(msg, 'err', r.error.message); return false; }
      dirty = false;
      return true;
    }

    N.$('save').addEventListener('click', function () {
      N.busy(N.$('save'), 'Saving…', async function () {
        if (await saveMarks()) N.say(msg, 'good', published ? 'Saved. Students see the changes now.' : 'Saved as a draft. Students cannot see it yet.');
      });
    });

    N.$('pub').addEventListener('click', function () {
      var next = !published;
      if (next && !confirm('Publish ' + A.title + '? Students will see their marks straight away.')) return;
      if (!next && !confirm('Unpublish ' + A.title + '? Students will stop seeing these marks.')) return;
      N.busy(N.$('pub'), next ? 'Publishing…' : 'Unpublishing…', async function () {
        // Publishing saves first, so what students see is what is on screen.
        if (next && !(await saveMarks())) return;
        var r = await sb.from('assessments').update({ published: next }).eq('id', aid);
        if (r.error) return N.say(msg, 'err', r.error.message);
        published = next;
        N.say(msg, 'good', next ? 'Published. Students can see their marks.' : 'Unpublished. Students no longer see these marks.');
      }).then(paint);
    });
  }
})();
