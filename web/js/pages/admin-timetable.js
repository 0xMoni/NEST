/* HOD timetable: one section's week, a dropdown per period. Choosing a class
   puts it in that slot; choosing "Free" clears it. Each change saves on its own. */
(async function () {
  'use strict';
  var N = NEST, sb = N.sb, esc = N.esc, must = N.must;
  var me = await N.requireRole('admin');
  var app = N.shell(me, { active: 'timetable', title: 'Timetable', sub: 'Pick a section, then a class for each period.' });

  var sr = await must(sb.from('sections').select('id, dept, semester, name').order('dept').order('semester').order('name'));
  var sections = sr.data || [];
  if (!sections.length) {
    app.innerHTML = '<div class="card"><p class="empty">Create a section on the <a class="link" href="structure.html">Structure</a> page first.</p></div>';
    return;
  }
  var active = sections.filter(function (s) { return s.id === N.param('s'); })[0] || sections[0];

  var res = await Promise.all([
    must(sb.from('faculty_assignments').select('id, faculty_id, subjects!inner(code, name), profiles!inner(full_name)').eq('section_id', active.id)),
    must(sb.from('timetable_slots').select('id, day_of_week, period, assignment_id, faculty_assignments!inner(section_id)').eq('faculty_assignments.section_id', active.id))
  ]);
  var classes = (res[0].data || []).sort(function (a, b) { return a.subjects.code.localeCompare(b.subjects.code); });
  var slots = {}; (res[1].data || []).forEach(function (s) { slots[s.day_of_week + ':' + s.period] = s; });
  var byId = {}; classes.forEach(function (c) { byId[c.id] = c; });

  var picker = '<div class="tools"><label class="field" style="min-width:220px">Section<select id="pick">' + sections.map(function (s) {
    return '<option value="' + esc(s.id) + '"' + (s.id === active.id ? ' selected' : '') + '>' + esc(N.sectionLabel(s)) + '</option>';
  }).join('') + '</select></label></div>';

  if (!classes.length) {
    app.innerHTML = picker + '<div class="card"><p class="empty">No one teaches ' + esc(N.sectionLabel(active)) + ' yet. Assign teachers on the <a class="link" href="structure.html">Structure</a> page first.</p></div>';
    wirePicker();
    return;
  }

  var head = '<tr><th class="day"></th>' + N.PERIODS.map(function (p) { return '<th>P' + p.n + '<span class="t">' + p.from + '–' + p.to + '</span></th>'; }).join('') + '</tr>';
  var body = '';
  for (var d = 1; d <= 6; d++) {
    body += '<tr><th class="day" scope="row">' + N.DAYS_SHORT[d] + '</th>' + N.PERIODS.map(function (p) {
      var cur = slots[d + ':' + p.n];
      return '<td><select data-day="' + d + '" data-period="' + p.n + '" aria-label="' + N.DAYS[d] + ' period ' + p.n + '">' +
        '<option value="">Free</option>' + classes.map(function (c) {
          return '<option value="' + esc(c.id) + '"' + (cur && cur.assignment_id === c.id ? ' selected' : '') + '>' + esc(c.subjects.code) + '</option>';
        }).join('') + '</select><div class="who" data-who="' + d + ':' + p.n + '">' + (cur && byId[cur.assignment_id] ? esc(byId[cur.assignment_id].profiles.full_name) : '') + '</div></td>';
    }).join('') + '</tr>';
  }

  app.innerHTML = picker +
    '<section class="card"><div class="card-head"><h2>' + esc(N.sectionLabel(active)) + '</h2><span class="aside">Changes save as you make them</span></div>' +
      '<div class="table-wrap"><table class="tt"><thead>' + head + '</thead><tbody>' + body + '</tbody></table></div>' +
      '<p class="msg" id="msg" role="status"></p>' +
    '</section>' +
    '<section class="card"><div class="card-head"><h2>Classes in this section</h2></div><ul class="list">' + classes.map(function (c) {
      var n = Object.keys(slots).filter(function (k) { return slots[k].assignment_id === c.id; }).length;
      return '<li><div class="list-row"><span><span class="code" style="font-family:var(--head);font-weight:600">' + esc(c.subjects.code) + '</span> ' + esc(c.subjects.name) + ' <span class="dim">· ' + esc(c.profiles.full_name) + '</span></span>' +
        '<span class="dim" data-count="' + esc(c.id) + '">' + n + ' period' + (n === 1 ? '' : 's') + ' a week</span></div></li>';
    }).join('') + '</ul></section>';
  wirePicker();

  function wirePicker() {
    N.$('pick').addEventListener('change', function (e) { location.search = '?s=' + encodeURIComponent(e.target.value); });
  }

  function recount() {
    classes.forEach(function (c) {
      var n = Object.keys(slots).filter(function (k) { return slots[k].assignment_id === c.id; }).length;
      var el = app.querySelector('[data-count="' + c.id + '"]'); if (el) el.textContent = n + ' period' + (n === 1 ? '' : 's') + ' a week';
    });
  }

  // A teacher can't be in two rooms at once: warn if they already teach
  // another section in this slot.
  async function clash(assignmentId, day, period) {
    var c = byId[assignmentId];
    var r = await sb.from('timetable_slots').select('faculty_assignments!inner(faculty_id, section_id, sections!inner(dept, semester, name))')
      .eq('day_of_week', day).eq('period', period).eq('faculty_assignments.faculty_id', c.faculty_id).neq('faculty_assignments.section_id', active.id);
    if (r.error || !r.data || !r.data.length) return null;
    return c.profiles.full_name + ' already teaches ' + N.sectionLabel(r.data[0].faculty_assignments.sections) + ' then.';
  }

  app.addEventListener('change', async function (e) {
    var sel = e.target.closest('select[data-day]'); if (!sel) return;
    var day = Number(sel.getAttribute('data-day')), period = Number(sel.getAttribute('data-period')), key = day + ':' + period;
    var want = sel.value || null, had = slots[key], msg = N.$('msg');
    var prev = had ? had.assignment_id : '';
    if (want) {
      var warn = await clash(want, day, period);
      if (warn && !confirm(warn + ' Put them here anyway?')) { sel.value = prev; return; }
    }
    sel.disabled = true;
    try {
      if (had) {
        var del = await sb.from('timetable_slots').delete().eq('id', had.id);
        if (del.error) { sel.value = prev; return N.say(msg, 'err', del.error.message); }
        delete slots[key];
      }
      if (want) {
        var ins = await sb.from('timetable_slots').insert({ assignment_id: want, day_of_week: day, period: period }).select('id, day_of_week, period, assignment_id').single();
        if (ins.error) {
          sel.value = '';
          return N.say(msg, 'err', ins.error.message + (had ? ' The slot is now free; pick again.' : ''));
        }
        slots[key] = ins.data;
      }
      app.querySelector('[data-who="' + key + '"]').textContent = want ? byId[want].profiles.full_name : '';
      recount();
      N.say(msg, 'good', N.DAYS[day] + ' P' + period + ': ' + (want ? byId[want].subjects.name : 'free') + '. Saved.');
    } finally { sel.disabled = false; }
  });
})();
