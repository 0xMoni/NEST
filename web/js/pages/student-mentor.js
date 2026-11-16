/* Student mentor page: who the mentor is, how to reach them, and their alerts. */
(async function () {
  'use strict';
  var N = NEST, sb = N.sb, esc = N.esc, must = N.must;
  var me = await N.requireRole('student');
  var app = N.shell(me, { active: 'mentor', title: 'Mentor' });

  async function load() {
    var res = await Promise.all([
      must(sb.from('mentorships').select('profiles!mentorships_mentor_id_fkey(full_name, email, phone, cabin, office_hours, designation)').eq('student_id', me.id).maybeSingle()),
      must(sb.from('mentor_alerts').select('id, kind, urgent, title, message, due_text, created_at, acknowledged_at').eq('student_id', me.id)
        .order('acknowledged_at', { ascending: false, nullsFirst: true }).order('created_at', { ascending: false }))
    ]);
    render(res[0].data && res[0].data.profiles, res[1].data || []);
  }

  function render(mentor, alerts) {
    var open = alerts.filter(function (a) { return !a.acknowledged_at; });
    var done = alerts.filter(function (a) { return a.acknowledged_at; });
    N.setHead(null, open.length ? open.length + ' thing' + (open.length === 1 ? '' : 's') + ' waiting on you.' : 'Nothing outstanding.');

    var card = !mentor
      ? '<section class="card"><p class="empty">No mentor has been assigned to you yet. The HOD sets this.</p></section>'
      : '<section class="card"><div class="row" style="gap:16px;margin-bottom:18px">' +
          '<span class="ini" style="width:48px;height:48px;border-radius:50%;display:grid;place-items:center;font-family:var(--head);font-weight:600;background:var(--gold-soft);color:var(--gold)">' + esc(N.initials(mentor.full_name)) + '</span>' +
          '<div><div class="eyebrow">Your mentor</div><div style="font-family:var(--head);font-weight:600;font-size:20px;margin-top:4px">' + esc(mentor.full_name) + '</div>' +
          (mentor.designation ? '<div class="dim">' + esc(mentor.designation) + '</div>' : '') + '</div></div>' +
          '<dl class="kv">' +
            (mentor.cabin ? '<dt>Where</dt><dd>' + esc(mentor.cabin) + '</dd>' : '') +
            (mentor.office_hours ? '<dt>Office hours</dt><dd>' + esc(mentor.office_hours) + '</dd>' : '') +
            (mentor.email ? '<dt>Email</dt><dd><a class="link" href="mailto:' + esc(mentor.email) + '">' + esc(mentor.email) + '</a></dd>' : '') +
            (mentor.phone ? '<dt>Phone</dt><dd><a class="link" href="tel:' + esc(mentor.phone) + '">' + esc(mentor.phone) + '</a></dd>' : '') +
          '</dl>' +
          (!mentor.cabin && !mentor.office_hours && !mentor.phone ? '<p class="note">Your mentor has not added a cabin or office hours yet.</p>' : '') +
        '</section>';

    function item(a, canAck) {
      return '<li><div class="list-row"><div style="min-width:0;flex:1">' +
          '<div class="row"><span class="dot' + (a.urgent ? ' risk' : '') + '"></span><span class="title-line">' + esc(a.title) + '</span>' +
          (a.urgent ? '<span class="pill risk">Urgent</span>' : '') + '<span class="pill muted">' + (a.kind === 'meet' ? 'Meeting' : 'To do') + '</span></div>' +
          (a.message ? '<p style="margin:8px 0 0;white-space:pre-wrap">' + esc(a.message) + '</p>' : '') +
          '<div class="meta-line">Sent ' + esc(N.fmtDateTime(a.created_at)) + (a.due_text ? ' · Due ' + esc(a.due_text) : '') +
          (a.acknowledged_at ? ' · Acknowledged ' + esc(N.fmtDateTime(a.acknowledged_at)) : '') + '</div>' +
        '</div>' + (canAck ? '<button class="btn sm primary" data-ack="' + esc(a.id) + '">Got it</button>' : '') + '</div></li>';
    }

    app.innerHTML = card +
      '<section class="card"><div class="card-head"><h2>Waiting on you</h2><span class="aside">Stays here until you acknowledge it</span></div>' +
        (open.length ? '<ul class="list">' + open.map(function (a) { return item(a, true); }).join('') + '</ul>' : '<p class="empty">Nothing right now.</p>') +
        '<p class="msg" id="msg" role="status"></p>' +
      '</section>' +
      (done.length ? '<section class="card"><div class="card-head"><h2>Done</h2></div><ul class="list">' + done.map(function (a) { return item(a, false); }).join('') + '</ul></section>' : '');
  }

  // Acknowledging is the only change a student can make to an alert — the
  // database refuses anything else, so the wording stays the mentor's.
  app.addEventListener('click', async function (e) {
    var b = e.target.closest('[data-ack]'); if (!b) return;
    await N.busy(b, 'Saving…', async function () {
      var r = await sb.from('mentor_alerts').update({ acknowledged_at: new Date().toISOString() }).eq('id', b.getAttribute('data-ack'));
      if (r.error) return N.say(N.$('msg'), 'err', r.error.message);
      N.toast('Marked as done');
      var badge = N.$('mentorBadge');
      if (badge) { var n = Number(badge.textContent) - 1; badge.textContent = n; badge.hidden = n <= 0; }
      await load();
    });
  });

  await load();
})();
