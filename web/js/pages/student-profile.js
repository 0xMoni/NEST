/* Student profile: six sections, each locked until the mentor opens a window.
   The lock itself is a database trigger (enforce_profile_locks); this page
   only shows its state and asks. The field lists below must match the
   trigger — if a field moves between sections there, move it here too. */
(async function () {
  'use strict';
  var N = NEST, sb = N.sb, esc = N.esc, must = N.must;
  var me = await N.requireRole('student');
  var app = N.shell(me, { active: 'profile', title: 'Profile', sub: 'Most of this is locked. Your mentor can open a section when something needs changing.' });

  var SECTIONS = [
    { id: 'student', label: 'Student details', desc: 'Personal information as on your records.', fields: [
      ['dob', 'Date of birth', 'date'], ['blood_group', 'Blood group'], ['phone', 'Phone', 'tel'], ['personal_email', 'Personal email', 'email']] },
    { id: 'parent', label: 'Parent details', desc: 'Parents or legal guardians on record.', fields: [
      ['father_name', "Father's name"], ['father_phone', "Father's phone", 'tel'], ['mother_name', "Mother's name"], ['mother_phone', "Mother's phone", 'tel']] },
    { id: 'guardian', label: 'Guardian details', desc: 'Local guardian, if you live away from your parents.', fields: [
      ['guardian_name', 'Name'], ['guardian_relation', 'Relation'], ['guardian_phone', 'Phone', 'tel']] },
    { id: 'contact', label: 'Contact details', desc: 'How the college reaches you.', fields: [
      ['address', 'Address'], ['city', 'City'], ['pincode', 'PIN code']] },
    { id: 'academic', label: 'Academic details', desc: 'Managed by the college office.', office: true, fields: [
      ['usn', 'USN'], ['dept', 'Department'], ['semester', 'Semester']] },
    { id: 'admission', label: 'Admission details', desc: 'Admission date and category.', fields: [
      ['admission_date', 'Admission date', 'date'], ['admission_quota', 'Category']] }
  ];
  var ALL = []; SECTIONS.forEach(function (s) { s.fields.forEach(function (f) { ALL.push(f[0]); }); });

  var profile, latest, mentor;

  async function load() {
    var res = await Promise.all([
      must(sb.from('profiles').select(ALL.join(',')).eq('id', me.id).single()),
      must(sb.from('profile_edit_requests').select('id, section, status, reason, expires_at, requested_at').eq('student_id', me.id).order('requested_at', { ascending: false })),
      must(sb.from('mentorships').select('profiles!mentorships_mentor_id_fkey(full_name)').eq('student_id', me.id).maybeSingle())
    ]);
    profile = res[0].data;
    latest = {};
    (res[1].data || []).forEach(function (r) { if (!latest[r.section]) latest[r.section] = r; }); // newest per section wins
    mentor = res[2].data && res[2].data.profiles ? res[2].data.profiles.full_name : null;
    render();
  }

  function stateOf(s) {
    var r = latest[s.id];
    if (s.office) return 'office';
    if (r && r.status === 'approved' && r.expires_at && new Date(r.expires_at) > new Date()) return 'unlocked';
    if (r && r.status === 'pending') return 'pending';
    return 'locked';
  }
  var PILL = { office: ['muted', 'College office'], unlocked: ['ok', 'Open for edits'], pending: ['watch', 'Awaiting mentor'], locked: ['muted', 'Locked'] };

  function card(s) {
    var st = stateOf(s), r = latest[s.id], editable = st === 'unlocked';
    var foot = '';
    if (st === 'office') foot = '<p class="note">The college office maintains these. Ask them if something is wrong.</p>';
    else if (st === 'unlocked') foot = '<div class="row"><button class="btn primary" data-save="' + s.id + '">Save changes</button>' +
      '<span class="dim">Open until ' + esc(N.fmtDateTime(r.expires_at)) + '</span></div>';
    else if (st === 'pending') foot = '<div class="row"><span class="dim">Asked ' + esc(N.fmtDateTime(r.requested_at)) + '. You can edit once ' + esc(mentor || 'your mentor') + ' approves.</span>' +
      '<span class="spacer"></span><button class="btn sm" data-withdraw="' + esc(r.id) + '">Withdraw request</button></div>';
    else foot = (r && r.status === 'rejected' ? '<p class="note" style="margin-top:0">Your last request was declined.</p>' : '') +
      (r && r.status === 'approved' ? '<p class="note" style="margin-top:0">The edit window your mentor opened has closed.</p>' : '') +
      (mentor
        ? '<div class="row" data-ask-row="' + s.id + '"><span class="dim">Locked. Ask ' + esc(mentor) + ' to allow changes.</span><span class="spacer"></span><button class="btn sm" data-ask="' + s.id + '">Request edit access</button></div>'
        : '<p class="note">Locked. You have no mentor assigned yet, so there is no one to ask.</p>');

    return '<section class="card lock ' + st + '" id="sec-' + s.id + '">' +
      '<div class="card-head"><div><h2>' + esc(s.label) + '</h2><p class="note" style="margin:4px 0 0">' + esc(s.desc) + '</p></div>' +
        '<span class="pill ' + PILL[st][0] + '">' + PILL[st][1] + '</span></div>' +
      '<div class="form-grid">' + s.fields.map(function (f) {
        var v = profile[f[0]] == null ? '' : String(profile[f[0]]);
        return '<label class="field">' + esc(f[1]) + '<input name="' + f[0] + '" type="' + (f[2] || 'text') + '" value="' + esc(v) + '"' + (editable ? '' : ' disabled') + '></label>';
      }).join('') + '</div>' +
      '<div class="foot">' + foot + '<p class="msg" role="status"></p></div></section>';
  }

  function render() {
    app.innerHTML = '<div class="cards">' + SECTIONS.map(card).join('') + '</div>' +
      '<p class="foot-note">Your password is on the <a class="link" href="' + esc(N.url('account.html')) + '">Account</a> page. You don\'t need your mentor for that.</p>';
  }

  function msgIn(id) { return N.$('sec-' + id).querySelector('.msg'); }

  app.addEventListener('click', async function (e) {
    var b;
    // Ask: swap the button for a short reason box.
    if ((b = e.target.closest('[data-ask]'))) {
      var id = b.getAttribute('data-ask'), row = b.parentNode;
      row.outerHTML = '<form class="row" data-send="' + id + '" style="align-items:flex-end">' +
        '<label class="field" style="flex:1;min-width:220px">What needs changing?<input name="reason" maxlength="300" placeholder="Moved house, new address"></label>' +
        '<button class="btn primary">Send request</button><button type="button" class="btn" data-cancel>Cancel</button></form>';
      N.$('sec-' + id).querySelector('[data-send] input').focus();
      return;
    }
    if (e.target.closest('[data-cancel]')) return render();

    if ((b = e.target.closest('[data-withdraw]'))) {
      var wid = b.getAttribute('data-withdraw');
      await N.busy(b, 'Withdrawing…', async function () {
        var r = await sb.from('profile_edit_requests').delete().eq('id', wid);
        if (r.error) return N.say(b.closest('.card').querySelector('.msg'), 'err', r.error.message);
        N.toast('Request withdrawn');
        await load();
      });
      return;
    }

    if ((b = e.target.closest('[data-save]'))) {
      var sid = b.getAttribute('data-save'), sec = SECTIONS.filter(function (s) { return s.id === sid; })[0];
      // Only ever send this section's own fields.
      var patch = {};
      sec.fields.forEach(function (f) {
        var v = N.$('sec-' + sid).querySelector('[name="' + f[0] + '"]').value.trim();
        patch[f[0]] = v || null;
      });
      await N.busy(b, 'Saving…', async function () {
        var r = await sb.from('profiles').update(patch).eq('id', me.id);
        // The trigger explains a lock in plain words, so its message is shown as is.
        if (r.error) return N.say(msgIn(sid), 'err', r.error.message);
        N.say(msgIn(sid), 'good', 'Saved.');
        Object.keys(patch).forEach(function (k) { profile[k] = patch[k]; });
      });
    }
  });

  app.addEventListener('submit', async function (e) {
    var f = e.target.closest('[data-send]'); if (!f) return;
    e.preventDefault();
    var sid = f.getAttribute('data-send'), btn = f.querySelector('.btn.primary');
    await N.busy(btn, 'Sending…', async function () {
      var r = await sb.from('profile_edit_requests').insert({ student_id: me.id, section: sid, reason: f.elements.reason.value.trim() || null });
      if (r.error) return N.say(msgIn(sid), 'err', r.error.code === '23505' ? 'You already have a request open for this section.' : r.error.message);
      N.toast('Request sent to ' + (mentor || 'your mentor'));
      await load();
    });
  });

  await load();
})();
