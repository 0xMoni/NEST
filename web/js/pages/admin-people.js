/* HOD people: everyone with an account. Creating accounts needs the secret
   key, which can never be in a browser page — that arrives with the backend.
   Until then, accounts come from the import and seed scripts. */
(async function () {
  'use strict';
  var N = NEST, sb = N.sb, esc = N.esc, must = N.must;
  var me = await N.requireRole('admin');
  var app = N.shell(me, { active: 'people', title: 'People', sub: 'Everyone with an account.' });

  var res = await Promise.all([
    must(sb.from('profiles').select('id, full_name, role, usn, email, designation, must_change_password').order('role').order('usn', { nullsFirst: false }).order('full_name').range(0, 4999)),
    must(sb.from('section_students').select('student_id, sections!inner(dept, semester, name)').range(0, 4999)),
    must(sb.from('mentorships').select('student_id, profiles!mentorships_mentor_id_fkey(full_name)').range(0, 4999))
  ]);
  var people = res[0].data || [];
  var section = {}; (res[1].data || []).forEach(function (r) { section[r.student_id] = N.sectionLabel(r.sections); });
  var mentor = {}; (res[2].data || []).forEach(function (r) { mentor[r.student_id] = r.profiles ? r.profiles.full_name : ''; });
  var ROLE = { student: ['muted', 'Student'], faculty: ['ok', 'Faculty'], admin: ['risk', 'HOD'] };
  function n(r) { return people.filter(function (p) { return p.role === r; }).length; }

  var role = 'all', q = '';
  app.innerHTML =
    '<section class="stats">' +
      '<div class="stat"><div class="eyebrow">Students</div><div class="stat-value">' + n('student') + '</div></div>' +
      '<div class="stat"><div class="eyebrow">Faculty</div><div class="stat-value">' + n('faculty') + '</div></div>' +
      '<div class="stat"><div class="eyebrow">HOD</div><div class="stat-value">' + n('admin') + '</div></div>' +
    '</section>' +
    '<div class="banner"><b>Adding accounts</b> is not on this page yet. Creating a login needs a secret key that must never be in a web page, so it arrives with the backend. Until then use <code>scripts/import-roster.py</code> (students) and <code>scripts/import-faculty.py</code> (faculty).</div>' +
    '<section class="card"><div class="tools">' +
      '<input id="q" type="search" placeholder="Search name, USN or email" style="flex:1;min-width:220px" aria-label="Search">' +
      '<div class="seg" role="group" aria-label="Role">' + [['all', 'Everyone'], ['student', 'Students'], ['faculty', 'Faculty'], ['admin', 'HOD']].map(function (o) {
        return '<button type="button" data-role="' + o[0] + '" aria-pressed="' + (o[0] === role) + '">' + o[1] + '</button>';
      }).join('') + '</div></div>' +
      '<div id="list"></div></section>';

  function draw() {
    var needle = q.toLowerCase();
    var shown = people.filter(function (p) {
      if (role !== 'all' && p.role !== role) return false;
      if (!needle) return true;
      return [p.full_name, p.usn, p.email].some(function (v) { return v && String(v).toLowerCase().indexOf(needle) >= 0; });
    });
    N.$('list').innerHTML = !shown.length ? '<p class="empty">No one matches.</p>' :
      '<p class="note" style="margin:0 0 10px">' + shown.length + ' shown</p>' +
      '<div class="table-wrap"><table class="data"><thead><tr><th>Name</th><th>Role</th><th>USN</th><th>Email</th><th>Section</th><th>Mentor</th><th>Password</th></tr></thead><tbody>' +
      shown.slice(0, 600).map(function (p) {
        return '<tr><td class="subj">' + esc(p.full_name || '—') + (p.designation ? '<div class="meta-line">' + esc(p.designation) + '</div>' : '') + '</td>' +
          '<td><span class="pill ' + ROLE[p.role][0] + '">' + ROLE[p.role][1] + '</span></td>' +
          '<td class="code">' + esc(p.usn || '') + '</td><td class="dim">' + esc(p.email || '') + '</td>' +
          '<td>' + esc(section[p.id] || (p.role === 'student' ? '—' : '')) + '</td>' +
          '<td class="dim">' + esc(mentor[p.id] || (p.role === 'student' ? '—' : '')) + '</td>' +
          '<td>' + (p.must_change_password ? '<span class="pill watch">Default</span>' : '<span class="pill ok">Own</span>') + '</td></tr>';
      }).join('') + '</tbody></table></div>' +
      (shown.length > 600 ? '<p class="note">Showing the first 600. Search to narrow it down.</p>' : '');
  }
  draw();

  var t;
  N.$('q').addEventListener('input', function (e) { clearTimeout(t); t = setTimeout(function () { q = e.target.value.trim(); draw(); }, 120); });
  app.addEventListener('click', function (e) {
    var b = e.target.closest('[data-role]'); if (!b) return;
    role = b.getAttribute('data-role');
    app.querySelectorAll('[data-role]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
    draw();
  });
})();
