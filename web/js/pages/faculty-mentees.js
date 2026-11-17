/* Mentees: the students this teacher mentors, their edit requests, alerts,
   and the teacher's own contact card (what mentees see on their Mentor page). */
(async function () {
  'use strict';
  var N = NEST, sb = N.sb, esc = N.esc, must = N.must;
  var me = await N.requireRole('faculty');
  var app = N.shell(me, { active: 'mentees', title: 'Mentees' });
  var SECTION_LABEL = { student: 'Student details', parent: 'Parent details', guardian: 'Guardian details', contact: 'Contact details', academic: 'Academic details', admission: 'Admission details' };

  var mentees, requests, sent, mine, summary;

  async function load() {
    var res = await Promise.all([
      must(sb.from('mentorships').select('student_id, profiles!mentorships_student_id_fkey(id, full_name, usn)').eq('mentor_id', me.id)),
      must(sb.from('profile_edit_requests').select('id, student_id, section, reason, requested_at').eq('status', 'pending').order('requested_at')),
      must(sb.from('mentor_alerts').select('id, student_id, kind, urgent, title, due_text, created_at, acknowledged_at').eq('mentor_id', me.id).order('created_at', { ascending: false }).limit(30)),
      must(sb.from('profiles').select('cabin, office_hours, phone').eq('id', me.id).single())
    ]);
    mentees = (res[0].data || []).map(function (m) { return m.profiles; }).filter(Boolean)
      .sort(function (a, b) { return (a.usn || '').localeCompare(b.usn || ''); });
    var mine_ids = {}; mentees.forEach(function (m) { mine_ids[m.id] = m; });
    requests = (res[1].data || []).filter(function (r) { return mine_ids[r.student_id]; });
    sent = res[2].data || [];
    mine = res[3].data || {};

    // One query for everyone's attendance, grouped here.
    summary = {};
    if (mentees.length) {
      var att = await must(sb.from('v_student_attendance').select('student_id, subject_code, subject_name, held, attended, percentage, short').in('student_id', mentees.map(function (m) { return m.id; })));
      (att.data || []).forEach(function (r) {
        var s = summary[r.student_id] || (summary[r.student_id] = { held: 0, attended: 0, short: [] });
        s.held += Number(r.held); s.attended += Number(r.attended);
        if (r.short) s.short.push({ code: r.subject_code, name: r.subject_name, pct: Number(r.percentage) });
      });
    }
    render();
  }

  function who(id) { var m = mentees.filter(function (x) { return x.id === id; })[0]; return m ? m.full_name + (m.usn ? ' (' + m.usn + ')' : '') : 'A student'; }

  function render() {
    N.setHead(null, mentees.length + ' student' + (mentees.length === 1 ? '' : 's') + ' assigned to you.');
    var pre = N.param('to');

    var table = !mentees.length
      ? '<p class="empty">No students have been assigned to you as mentees yet. The HOD sets this.</p>'
      : '<div class="table-wrap"><table class="data"><thead><tr><th>USN</th><th>Name</th><th>Attendance</th><th>Below 75% in</th><th>Open alerts</th><th></th></tr></thead><tbody>' +
        mentees.map(function (m) { return { m: m, s: summary[m.id] }; })
          .sort(function (a, b) { return ((b.s && b.s.short.length) || 0) - ((a.s && a.s.short.length) || 0); })
          .map(function (x) {
            var m = x.m, s = x.s, p = s ? N.pct(s.attended, s.held) : null, risk = s && s.short.length;
            var open = sent.filter(function (a) { return a.student_id === m.id && !a.acknowledged_at; }).length;
            return '<tr class="' + (risk ? 'risk' : '') + '"><td class="code">' + esc(m.usn || '') + '</td><td class="subj">' + esc(m.full_name) + '</td>' +
              '<td>' + (p == null ? '<span class="dim">No data</span>' : '<div class="pbar"><div class="track mark"><i style="width:' + Math.min(100, p) + '%"></i></div><span class="v">' + p + '%</span></div>') + '</td>' +
              '<td>' + (risk ? '<span class="pill risk">' + s.short.map(function (x) { return '<span title="' + esc(x.name || '') + '">' + esc(x.code) + ' ' + x.pct + '%</span>'; }).join(' · ') + '</span>' : p == null ? '' : '<span class="pill ok">None</span>') + '</td>' +
              '<td class="n">' + (open || '') + '</td>' +
              '<td class="actions"><button class="btn sm" data-alert="' + esc(m.id) + '">Send alert</button></td></tr>';
          }).join('') + '</tbody></table></div>' +
        '<p class="foot-note">Attendance covers every subject your mentees study, not just yours. Students below 75% are listed first.</p>';

    var reqHtml = !requests.length ? '<p class="empty">No requests waiting.</p>'
      : '<ul class="list">' + requests.map(function (r) {
          return '<li><div class="list-row"><div><div class="title-line">' + esc(who(r.student_id)) + '</div>' +
            '<div class="meta-line">Wants to edit <b>' + esc(SECTION_LABEL[r.section] || r.section) + '</b> · asked ' + esc(N.fmtDateTime(r.requested_at)) + '</div>' +
            (r.reason ? '<p style="margin:6px 0 0">“' + esc(r.reason) + '”</p>' : '') + '</div>' +
            '<div class="row"><select data-hours="' + esc(r.id) + '" aria-label="How long to open it for">' +
              '<option value="24">Open for 1 day</option><option value="48" selected>Open for 2 days</option><option value="72">Open for 3 days</option><option value="168">Open for a week</option></select>' +
            '<button class="btn sm primary" data-approve="' + esc(r.id) + '">Approve</button><button class="btn sm danger" data-reject="' + esc(r.id) + '">Decline</button></div></div></li>';
        }).join('') + '</ul>';

    var sentHtml = !sent.length ? '<p class="empty">You haven\'t sent any alerts yet.</p>'
      : '<div class="table-wrap"><table class="data"><thead><tr><th>To</th><th>Alert</th><th>Sent</th><th>Status</th><th></th></tr></thead><tbody>' +
        sent.map(function (a) {
          return '<tr><td>' + esc(who(a.student_id)) + '</td><td><span class="title-line">' + esc(a.title) + '</span>' + (a.urgent ? ' <span class="pill risk">Urgent</span>' : '') +
            '<div class="meta-line">' + (a.kind === 'meet' ? 'Meeting' : 'To do') + (a.due_text ? ' · due ' + esc(a.due_text) : '') + '</div></td>' +
            '<td class="dim">' + esc(N.fmtDateTime(a.created_at)) + '</td>' +
            '<td>' + (a.acknowledged_at ? '<span class="pill ok">Seen ' + esc(N.fmtDate(a.acknowledged_at, { day: 'numeric', month: 'short' })) + '</span>' : '<span class="pill watch">Not yet</span>') + '</td>' +
            '<td class="actions"><button class="btn sm" data-del="' + esc(a.id) + '">Delete</button></td></tr>';
        }).join('') + '</tbody></table></div>';

    app.innerHTML =
      '<section class="card"><div class="card-head"><h2>Your mentees</h2></div>' + table + '</section>' +
      '<section class="card" id="requests"><div class="card-head"><h2>Profile edit requests</h2><span class="aside">Approving opens the section for a while, not for good</span></div>' + reqHtml + '<p class="msg" id="reqMsg" role="status"></p></section>' +
      (mentees.length ?
      '<section class="card" id="alerts"><div class="card-head"><h2>Send an alert</h2><span class="aside">Shows on their dashboard until they acknowledge it</span></div>' +
        '<form id="af" novalidate><div class="form-grid">' +
          '<label class="field">To<select name="to"><option value="all">All my mentees (' + mentees.length + ')</option>' +
            mentees.map(function (m) { return '<option value="' + esc(m.id) + '"' + (m.id === pre ? ' selected' : '') + '>' + esc(m.full_name) + (m.usn ? ' · ' + esc(m.usn) : '') + '</option>'; }).join('') + '</select></label>' +
          '<label class="field">Kind<select name="kind"><option value="task">Something to do</option><option value="meet">Come and see me</option></select></label>' +
          '<label class="field wide">Title<input name="title" maxlength="120" placeholder="Submit your lab record"></label>' +
          '<label class="field wide">Details <span class="hint">optional</span><textarea name="message" maxlength="1000"></textarea></label>' +
          '<label class="field">Due <span class="hint">optional, e.g. Friday 4pm</span><input name="due" maxlength="60"></label>' +
          '<label class="check" style="align-self:end;min-height:44px"><input type="checkbox" name="urgent"> Mark as urgent</label>' +
        '</div><button class="btn primary">Send alert</button><p class="msg" id="aMsg" role="status"></p></form></section>' : '') +
      '<section class="card"><div class="card-head"><h2>Alerts you\'ve sent</h2><span class="aside">Latest 30</span></div>' + sentHtml + '</section>' +
      '<section class="card" id="contact"><div class="card-head"><h2>Your contact card</h2><span class="aside">Mentees see this on their Mentor page</span></div>' +
        '<form id="cf" novalidate><div class="form-grid">' +
          '<label class="field">Cabin<input name="cabin" maxlength="80" placeholder="214, Block B" value="' + esc(mine.cabin || '') + '"></label>' +
          '<label class="field">Office hours<input name="hours" maxlength="120" placeholder="Mon–Wed, 2–4 pm" value="' + esc(mine.office_hours || '') + '"></label>' +
          '<label class="field">Phone<input name="phone" type="tel" maxlength="20" value="' + esc(mine.phone || '') + '"></label>' +
        '</div><button class="btn primary">Save contact card</button><p class="msg" id="cMsg" role="status"></p></form></section>';

    // Links from the home page jump to #requests or #alerts.
    var t = location.hash && document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (t) t.scrollIntoView();
  }

  // ---------------------------------------------------------------- actions

  app.addEventListener('click', async function (e) {
    var b;
    if ((b = e.target.closest('[data-alert]'))) {
      var f = N.$('af'); f.elements.to.value = b.getAttribute('data-alert'); N.$('alerts').scrollIntoView({ behavior: 'smooth' }); f.elements.title.focus({ preventScroll: true });
      return;
    }
    if ((b = e.target.closest('[data-approve], [data-reject]'))) {
      var approve = b.hasAttribute('data-approve'), id = b.getAttribute(approve ? 'data-approve' : 'data-reject');
      var hours = Number(app.querySelector('[data-hours="' + id + '"]').value) || 48;
      await N.busy(b, approve ? 'Approving…' : 'Declining…', async function () {
        var r = await sb.from('profile_edit_requests').update({
          status: approve ? 'approved' : 'rejected',
          decided_by: me.id,
          decided_at: new Date().toISOString(),
          // A window, not a permanent unlock.
          expires_at: approve ? new Date(Date.now() + hours * 3600 * 1000).toISOString() : null
        }).eq('id', id);
        if (r.error) return N.say(N.$('reqMsg'), 'err', r.error.message);
        N.toast(approve ? 'Approved. The section is open for ' + (hours >= 48 ? hours / 24 + ' days' : '1 day') : 'Declined');
        await load();
      });
      return;
    }
    if ((b = e.target.closest('[data-del]'))) {
      if (!confirm('Delete this alert? The student will no longer see it.')) return;
      await N.busy(b, 'Deleting…', async function () {
        var r = await sb.from('mentor_alerts').delete().eq('id', b.getAttribute('data-del'));
        if (r.error) return N.toast(r.error.message);
        N.toast('Alert deleted');
        await load();
      });
    }
  });

  app.addEventListener('submit', async function (e) {
    e.preventDefault();
    var f = e.target, el = f.elements;

    if (f.id === 'af') {
      var msg = N.$('aMsg'), title = el.title.value.trim();
      if (!title) { el.title.focus(); return N.say(msg, 'err', 'Give the alert a title. It is what the student sees first.'); }
      var to = el.to.value === 'all' ? mentees.map(function (m) { return m.id; }) : [el.to.value];
      var rows = to.map(function (sid) {
        return { mentor_id: me.id, student_id: sid, kind: el.kind.value, urgent: el.urgent.checked, title: title,
                 message: el.message.value.trim() || null, due_text: el.due.value.trim() || null };
      });
      await N.busy(f.querySelector('.btn'), 'Sending…', async function () {
        var r = await sb.from('mentor_alerts').insert(rows);
        if (r.error) return N.say(msg, 'err', r.error.code === '42501' ? 'You can only send alerts to your own mentees.' : r.error.message);
        N.toast('Sent to ' + (to.length === 1 ? who(to[0]) : to.length + ' mentees'));
        await load();
      });
      return;
    }

    if (f.id === 'cf') {
      var cm = N.$('cMsg');
      var text = function (k) { return el[k].value.trim() || null; };
      await N.busy(f.querySelector('.btn'), 'Saving…', async function () {
        var r = await sb.from('profiles').update({ cabin: text('cabin'), office_hours: text('hours') }).eq('id', me.id);
        if (r.error) return N.say(cm, 'err', r.error.message);
        mine.cabin = text('cabin'); mine.office_hours = text('hours');
        // Phone goes separately: a database rule written for student profiles
        // also blocks it for faculty, so it can fail on its own while the rest saves.
        if (text('phone') !== (mine.phone || null)) {
          var p = await sb.from('profiles').update({ phone: text('phone') }).eq('id', me.id);
          if (p.error) {
            el.phone.value = mine.phone || '';
            return N.say(cm, 'err', 'Cabin and office hours saved. Your phone number could not be changed yet: a database rule meant for students blocks it. That is fixed in the database step.');
          }
          mine.phone = text('phone');
        }
        N.say(cm, 'good', 'Saved. Your mentees see this now.');
      });
    }
  });

  await load();
})();
