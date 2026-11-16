/* Teacher attendance: the list of classes, and the roll for one of them.
   Everyone starts present and the teacher taps the absentees — absences are
   the exception, which is how a register is read out loud. Marking the same
   class, date and period again corrects it rather than duplicating it: the
   unique key on attendance_sessions makes that true. */
(async function () {
  'use strict';
  var N = NEST, sb = N.sb, esc = N.esc, must = N.must;
  var me = await N.requireRole('faculty');
  var app = N.shell(me, { active: 'attendance', title: 'Attendance', sub: 'Every class you teach.' });
  var today = N.localISO();

  if (N.param('a')) return markSheet(N.param('a'));
  return classList();

  // ---------------------------------------------------------------- list

  async function classList() {
    var res = await Promise.all([
      must(sb.from('timetable_slots')
        .select('day_of_week, period, assignment_id, faculty_assignments!inner(faculty_id, sections!inner(dept, semester, name), subjects!inner(code, name))')
        .eq('faculty_assignments.faculty_id', me.id).order('day_of_week').order('period')),
      must(sb.from('attendance_sessions').select('assignment_id, period').eq('held_on', today)),
      must(sb.from('faculty_assignments').select('id, sections!inner(dept, semester, name), subjects!inner(code, name)').eq('faculty_id', me.id))
    ]);
    var slots = res[0].data || [], assignments = res[2].data || [];
    var marked = {}; (res[1].data || []).forEach(function (m) { marked[m.assignment_id + ':' + m.period] = true; });
    var dow = new Date().getDay();

    if (!assignments.length) {
      app.innerHTML = '<div class="card"><p class="empty">You are not assigned to any class yet. The HOD sets this.</p></div>';
      return;
    }

    var table = slots.length
      ? '<div class="table-wrap"><table class="data"><thead><tr><th>Day</th><th>Period</th><th>Subject</th><th>Section</th><th>Today</th><th></th></tr></thead><tbody>' +
        slots.map(function (s) {
          var fa = s.faculty_assignments, isToday = s.day_of_week === dow, ok = isToday && marked[s.assignment_id + ':' + s.period];
          return '<tr class="' + (isToday ? 'now' : '') + '"><td class="dim">' + N.DAYS_SHORT[s.day_of_week] + '</td><td class="n">P' + s.period + ' <span class="dim">' + N.periodTime(s.period) + '</span></td>' +
            '<td class="subj">' + esc(fa.subjects.name) + ' <span class="code">' + esc(fa.subjects.code) + '</span></td><td class="dim">' + esc(N.sectionLabel(fa.sections)) + '</td>' +
            '<td>' + (!isToday ? '' : ok ? '<span class="pill ok">Marked</span>' : '<span class="pill muted">Not yet</span>') + '</td>' +
            '<td class="actions">' + (isToday ? '<a class="btn sm' + (ok ? '' : ' primary') + '" href="?a=' + encodeURIComponent(s.assignment_id) + '&period=' + s.period + '&date=' + today + '">' + (ok ? 'Edit' : 'Mark') + '</a>' : '') + '</td></tr>';
        }).join('') + '</tbody></table></div>'
      : '<p class="empty">None of your classes are on the timetable yet. You can still mark one below.</p>';

    // Extra classes, or a day that was missed: any class, any date, any period.
    var opts = assignments.map(function (a) { return '<option value="' + esc(a.id) + '">' + esc(a.subjects.name) + ' · ' + esc(N.sectionLabel(a.sections)) + '</option>'; }).join('');
    app.innerHTML =
      '<section class="card"><div class="card-head"><h2>Your timetable</h2><span class="aside">Today\'s classes are highlighted</span></div>' + table + '</section>' +
      '<section class="card"><div class="card-head"><h2>Mark or correct another class</h2><span class="aside">An extra class, or one from an earlier day</span></div>' +
        '<form id="other" class="form-grid" style="align-items:end;margin:0">' +
          '<label class="field wide">Class<select name="a" required>' + opts + '</select></label>' +
          '<label class="field">Date<input type="date" name="date" value="' + today + '" max="' + today + '" required></label>' +
          '<label class="field">Period<select name="period">' + N.PERIODS.map(function (p) { return '<option value="' + p.n + '">P' + p.n + ' · ' + p.from + '</option>'; }).join('') + '</select></label>' +
          '<button class="btn primary">Open roll</button>' +
        '</form></section>';

    N.$('other').addEventListener('submit', function (e) {
      e.preventDefault();
      var f = e.target;
      location.search = '?a=' + encodeURIComponent(f.elements.a.value) + '&period=' + f.elements.period.value + '&date=' + f.elements.date.value;
    });
  }

  // ---------------------------------------------------------------- one class

  async function markSheet(aid) {
    var period = Number(N.param('period') || 1), date = N.param('date') || today;
    if (!Number.isInteger(period) || period < 1 || period > 8 || !N.isISODate(date)) {
      app.innerHTML = '<div class="card"><p class="msg err">That link has an invalid date or period.</p><a class="btn" href="attendance.html">Back to your classes</a></div>';
      return;
    }
    if (date > today) {
      app.innerHTML = '<div class="card"><p class="msg err">You can\'t mark attendance for a day that hasn\'t happened yet.</p><a class="btn" href="attendance.html">Back to your classes</a></div>';
      return;
    }

    // Row-level security: this comes back empty unless they teach it.
    var a = await must(sb.from('faculty_assignments').select('id, section_id, sections!inner(dept, semester, name), subjects!inner(code, name)').eq('id', aid).maybeSingle());
    if (!a.data) {
      app.innerHTML = '<div class="card"><p class="msg err">Class not found, or it is not yours.</p><a class="btn" href="attendance.html">Back to your classes</a></div>';
      return;
    }
    var cls = a.data;
    var res = await Promise.all([
      must(sb.from('section_students').select('profiles!inner(id, full_name, usn)').eq('section_id', cls.section_id)),
      must(sb.from('attendance_sessions').select('id').eq('assignment_id', aid).eq('held_on', date).eq('period', period).maybeSingle())
    ]);
    var students = (res[0].data || []).map(function (e) { return e.profiles; })
      .sort(function (x, y) { return (x.usn || '').localeCompare(y.usn || ''); });
    var session = res[1].data, absent = new Set();
    if (session) {
      var rec = await must(sb.from('attendance_records').select('student_id').eq('session_id', session.id).eq('status', 'absent'));
      (rec.data || []).forEach(function (x) { absent.add(x.student_id); });
    }

    N.setHead(cls.subjects.name, N.sectionLabel(cls.sections) + ' · Period ' + period + ' (' + N.periodTime(period) + ') · ' + N.fmtDate(date, { weekday: 'long', day: 'numeric', month: 'long' }));

    if (!students.length) {
      app.innerHTML = '<div class="card"><p class="empty">No students are enrolled in ' + esc(N.sectionLabel(cls.sections)) + ' yet.</p><a class="btn" href="attendance.html">Back</a></div>';
      return;
    }

    // "USN only" fits a whole class on a phone; names help early in the term.
    var view = 'usn';
    try { view = localStorage.getItem('nest-roll-view') === 'full' ? 'full' : 'usn'; } catch (e) { /* default */ }
    var saved = !!session, dirty = false;

    function count() {
      N.$('count').innerHTML = '<b>' + (students.length - absent.size) + '</b> present · <b class="' + (absent.size ? 'risk' : '') + '">' + absent.size + '</b> absent';
    }
    function draw() {
      app.innerHTML =
        (saved ? '<div class="banner">Already marked. Changes you save replace what was there, and students see the correction straight away.</div>' : '') +
        '<section class="card">' +
          '<div class="roll-head"><span class="count" id="count" aria-live="polite"></span>' +
            '<div class="row"><div class="seg" role="group" aria-label="Roll display">' +
              '<button type="button" data-view="usn" aria-pressed="' + (view === 'usn') + '">USN only</button>' +
              '<button type="button" data-view="full" aria-pressed="' + (view === 'full') + '">USN &amp; name</button></div>' +
            '<button type="button" class="btn sm" id="allIn">Mark all present</button></div></div>' +
          '<p class="note" style="margin:0 0 14px">Tap a student to mark them absent. Tap again to undo.</p>' +
          '<ul class="roll' + (view === 'full' ? ' full' : '') + '" id="roll">' + students.map(function (s) {
            var ab = absent.has(s.id);
            return '<li><button type="button" data-id="' + esc(s.id) + '" aria-pressed="' + ab + '" title="' + esc(s.full_name) + '" aria-label="' + esc(s.full_name) + ', ' + (ab ? 'absent' : 'present') + '">' +
              '<span class="usn">' + esc(s.usn || '—') + '</span>' + (view === 'full' ? '<span class="nm">' + esc(s.full_name) + '</span>' : '') +
              '<span class="st">' + (ab ? 'Absent' : 'Present') + '</span></button></li>';
          }).join('') + '</ul>' +
          '<div class="save-bar"><button class="btn primary" id="save">' + (saved ? 'Update attendance' : 'Save attendance') + '</button>' +
            '<a class="btn" href="attendance.html">Back</a><p class="msg" id="msg" role="status" style="margin:0"></p></div>' +
        '</section>';
      count();
    }

    draw();

    app.addEventListener('click', function (e) {
      var b = e.target.closest('#roll button');
      if (b) {
        var id = b.getAttribute('data-id'), ab = !absent.has(id);
        if (ab) absent.add(id); else absent.delete(id);
        b.setAttribute('aria-pressed', String(ab));
        b.querySelector('.st').textContent = ab ? 'Absent' : 'Present';
        b.setAttribute('aria-label', b.title + ', ' + (ab ? 'absent' : 'present'));
        dirty = true; count(); N.say(N.$('msg'), '', '');
        return;
      }
      var v = e.target.closest('[data-view]');
      if (v) {
        view = v.getAttribute('data-view');
        try { localStorage.setItem('nest-roll-view', view); } catch (x) { /* not remembered */ }
        draw();
        return;
      }
      if (e.target.closest('#allIn')) { absent.clear(); dirty = true; draw(); return; }
      if (e.target.closest('#save')) save(e.target.closest('#save'));
    });

    // Leaving with unsaved taps would lose them silently.
    addEventListener('beforeunload', function (e) { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

    async function save(btn) {
      var msg = N.$('msg');
      await N.busy(btn, 'Saving…', async function () {
        var s = await sb.from('attendance_sessions')
          .upsert({ assignment_id: aid, held_on: date, period: period, taken_by: me.id }, { onConflict: 'assignment_id,held_on,period' })
          .select('id').single();
        if (s.error) return N.say(msg, 'err', s.error.message);
        var rows = students.map(function (st) {
          return { session_id: s.data.id, student_id: st.id, status: absent.has(st.id) ? 'absent' : 'present' };
        });
        var r = await sb.from('attendance_records').upsert(rows, { onConflict: 'session_id,student_id' });
        if (r.error) return N.say(msg, 'err', r.error.message);
        dirty = false; saved = true;
        N.toast('Saved: ' + (students.length - absent.size) + ' present, ' + absent.size + ' absent');
        N.say(msg, 'good', 'Saved: ' + (students.length - absent.size) + ' present, ' + absent.size + ' absent.');
      });
      if (saved) btn.textContent = 'Update attendance';
    }
  }
})();
