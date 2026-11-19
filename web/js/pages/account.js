/* Account: who you are, and changing your own password. Every role. */
(async function () {
  'use strict';
  var N = NEST, sb = N.sb, esc = N.esc, must = N.must;
  var me = await N.requireRole(null);
  var term = await N.currentTerm();   // pages show the current term's sections
  var app = N.shell(me, { active: 'account', title: 'Account', sub: 'Your details, and your password.' });
  var ROLE = { student: 'Student', faculty: 'Faculty', admin: 'HOD' };

  var rows = [['Name', esc(me.full_name)], ['Role', '<span class="pill ' + (me.role === 'admin' ? 'risk' : me.role === 'faculty' ? 'ok' : 'muted') + '">' + ROLE[me.role] + '</span>'], ['Email', esc(me.email || '—')]];

  if (me.role === 'student') {
    var res = await Promise.all([
      must(N.inTerm(sb.from('section_students').select('sections!inner(dept, semester, name)').eq('student_id', me.id), 'sections.term_id', term)),
      must(sb.from('v_my_mentor').select('full_name').maybeSingle())
    ]);
    var secs = (res[0].data || []).map(function (r) { return N.sectionLabel(r.sections); });
    var mentor = res[1].data;
    rows.push(['USN', esc(me.usn || '—')], ['Section', esc(secs.join(', ') || 'Not enrolled yet')], ['Mentor', esc(mentor ? mentor.full_name : 'Not assigned yet')]);
  } else if (me.role === 'faculty') {
    var r2 = await Promise.all([
      must(N.inTerm(sb.from('faculty_assignments').select('sections!inner(dept, semester, name), subjects!inner(code, name)').eq('faculty_id', me.id), 'sections.term_id', term)),
      must(sb.from('mentorships').select('student_id', { count: 'exact', head: true }).eq('mentor_id', me.id))
    ]);
    var teaches = (r2[0].data || []).map(function (a) { return esc(a.subjects.name) + ' <span class="dim">' + esc(a.subjects.code) + ' · ' + esc(N.sectionLabel(a.sections)) + '</span>'; });
    rows.push(['Teaches', teaches.length ? teaches.join('<br>') : 'No classes assigned yet'], ['Mentees', String(r2[1].count || 0)]);
  }

  app.innerHTML =
    '<div class="grid2">' +
      '<section class="card"><div class="card-head"><h2>Details</h2></div>' +
        '<dl class="kv">' + rows.map(function (r) { return '<dt>' + r[0] + '</dt><dd>' + r[1] + '</dd>'; }).join('') + '</dl>' +
        (me.role === 'student' ? '<p class="note">Personal and family details are on your <a class="link" href="' + esc(N.url('student/profile.html')) + '">Profile</a>.</p>' : '') +
        '<p class="note">Something wrong here? The college office (HOD) manages names, roles and email addresses.</p>' +
      '</section>' +
      '<section class="card"><div class="card-head"><h2>Change password</h2></div>' +
        '<p class="note" style="margin:0 0 16px">This one is yours alone. You do not need anyone\'s permission to change it.</p>' +
        '<form id="pw" novalidate>' +
          '<div class="form-grid">' +
            '<label class="field">New password<input type="password" id="pw1" autocomplete="new-password" minlength="6" required></label>' +
            '<label class="field">Type it again<input type="password" id="pw2" autocomplete="new-password" minlength="6" required></label>' +
          '</div>' +
          '<button class="btn primary" id="pwGo">Change password</button>' +
          '<p class="msg" id="pwMsg" role="status"></p>' +
        '</form>' +
      '</section>' +
    '</div>';

  N.$('pw').addEventListener('submit', async function (e) {
    e.preventDefault();
    var a = N.$('pw1').value, b = N.$('pw2').value, msg = N.$('pwMsg');
    if (a.length < 6) return N.say(msg, 'err', 'Use at least 6 characters.');
    if (a !== b) return N.say(msg, 'err', "Those two don't match.");
    if (a === '123456') return N.say(msg, 'err', "That's the default everyone starts with. Pick something else.");
    await N.busy(N.$('pwGo'), 'Saving…', async function () {
      var r = await sb.auth.updateUser({ password: a });
      if (r.error) return N.say(msg, 'err', r.error.message);
      await sb.from('profiles').update({ must_change_password: false }).eq('id', me.id);
      N.$('pw').reset();
      N.say(msg, 'good', 'Password changed. Use the new one next time you sign in.');
    });
  });
})();
