/* News & events, for teachers and the HOD: post news or an event to every
   student, one semester or one section, and see what has been posted.
   Students read it on their own News & events page. The rules on
   public.posts decide who sees each post, and that anyone may remove only
   their own (the HOD, any). */
(async function () {
  'use strict';
  var N = NEST, sb = N.sb, esc = N.esc, must = N.must;
  var me = await N.requireRole(['faculty', 'admin']);
  var term = await N.currentTerm();
  var app = N.shell(me, { active: 'news', title: 'News & events', sub: 'Post news or an event for your students.' });

  var KIND = { news: 'News', hackathon: 'Hackathon', workshop: 'Workshop', talk: 'Talk' };
  var sections = (await must(N.inTerm(sb.from('sections').select('id, dept, semester, name'), 'term_id', term)
    .order('dept').order('semester').order('name'))).data || [];
  var secById = {}; sections.forEach(function (s) { secById[s.id] = s; });

  function audience(p) {
    if (p.section_id) return secById[p.section_id] ? N.sectionLabel(secById[p.section_id]) : 'One section (earlier term)';
    if (p.semester) return 'Semester ' + p.semester;
    return 'Every student';
  }

  app.innerHTML =
    '<section class="card"><div class="card-head"><h2>New post</h2></div>' +
      '<form id="post" class="form-grid" novalidate>' +
        '<label class="field">Type<select name="kind">' + Object.keys(KIND).map(function (k) { return '<option value="' + k + '">' + KIND[k] + '</option>'; }).join('') + '</select></label>' +
        '<label class="field">For<select name="audience"><option value="">Every student</option>' +
          [1, 2, 3, 4, 5, 6, 7, 8].map(function (n) { return '<option value="sem:' + n + '">Semester ' + n + '</option>'; }).join('') +
          sections.map(function (s) { return '<option value="sec:' + esc(s.id) + '">' + esc(N.sectionLabel(s)) + '</option>'; }).join('') +
        '</select></label>' +
        '<label class="field" style="grid-column:1/-1">Title<input name="title" maxlength="200" required></label>' +
        '<label class="field" style="grid-column:1/-1">One-line summary <span class="dim">(optional)</span><input name="summary" maxlength="300"></label>' +
        '<label class="field" style="grid-column:1/-1">Details <span class="dim">(optional; a blank line starts a new paragraph)</span><textarea name="body" rows="5" maxlength="10000"></textarea></label>' +
        '<div class="ev-only form-grid" style="grid-column:1/-1;margin:0" hidden>' +
          '<label class="field">Date<input name="event_on" type="date"></label>' +
          '<label class="field">Time <span class="dim">(optional)</span><input name="event_time" maxlength="80" placeholder="2:00–5:00 PM"></label>' +
          '<label class="field">Where <span class="dim">(optional)</span><input name="location" maxlength="120" placeholder="Seminar Hall 2"></label>' +
          '<label class="field">Who can join <span class="dim">(optional)</span><input name="team" maxlength="80" placeholder="Teams of 4"></label>' +
          '<label class="field">Registration closes <span class="dim">(optional)</span><input name="closes" maxlength="120"></label>' +
        '</div>' +
        '<label class="field" style="grid-column:1/-1">Link <span class="dim">(optional, https://…)</span><input name="link" type="url" maxlength="500"></label>' +
        '<div style="grid-column:1/-1"><button class="btn primary">Post</button> <span class="msg" id="msg" role="status"></span></div>' +
      '</form></section>' +
    '<section class="card"><div class="card-head"><h2>Posted</h2><span class="aside" id="count"></span></div><div id="list"><p class="loading">Loading…</p></div></section>';

  var form = N.$('post'), msg = N.$('msg');
  function syncKind() { app.querySelector('.ev-only').hidden = form.elements.kind.value === 'news'; }
  form.elements.kind.addEventListener('change', syncKind);

  async function list() {
    var r = await must(sb.from('posts').select('id, kind, title, summary, event_on, semester, section_id, posted_by, posted_by_name, created_at')
      .order('created_at', { ascending: false }).limit(200));
    var rows = r.data || [];
    N.$('count').textContent = rows.length ? rows.length + ' post' + (rows.length === 1 ? '' : 's') : '';
    N.$('list').innerHTML = rows.length ? '<div class="table-wrap"><table class="data"><thead><tr><th>Posted</th><th>Type</th><th>Title</th><th>For</th><th>By</th><th></th></tr></thead><tbody>' +
      rows.map(function (p) {
        var mine = p.posted_by === me.id || me.role === 'admin';
        return '<tr><td class="dim">' + esc(N.fmtDate(N.localISO(new Date(p.created_at)), { day: 'numeric', month: 'short' })) + '</td>' +
          '<td><span class="pill muted">' + esc(KIND[p.kind] || p.kind) + '</span></td>' +
          '<td>' + esc(p.title) + (p.event_on ? ' <span class="dim">· ' + esc(N.fmtDate(p.event_on, { day: 'numeric', month: 'short' })) + '</span>' : '') + '</td>' +
          '<td>' + esc(audience(p)) + '</td><td>' + esc(p.posted_by_name || '—') + '</td>' +
          '<td class="actions">' + (mine ? '<button class="btn sm danger" data-del="' + esc(p.id) + '">Remove</button>' : '') + '</td></tr>';
      }).join('') + '</tbody></table></div>' : '<p class="empty">Nothing posted yet.</p>';
  }

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    var el = form.elements, kind = el.kind.value, aud = el.audience.value;
    var row = {
      kind: kind, title: el.title.value.trim(), summary: el.summary.value.trim() || null, body: el.body.value.trim() || null,
      link: el.link.value.trim() || null,
      semester: aud.indexOf('sem:') === 0 ? Number(aud.slice(4)) : null,
      section_id: aud.indexOf('sec:') === 0 ? aud.slice(4) : null
    };
    if (kind !== 'news') {
      row.event_on = el.event_on.value || null; row.event_time = el.event_time.value.trim() || null;
      row.location = el.location.value.trim() || null; row.team = el.team.value.trim() || null; row.closes = el.closes.value.trim() || null;
    }
    if (!row.title) return N.say(msg, 'err', 'Give it a title.');
    if (kind !== 'news' && !N.isISODate(row.event_on || '')) return N.say(msg, 'err', 'An event needs a date.');
    if (row.link && !/^https?:\/\//i.test(row.link)) return N.say(msg, 'err', 'The link has to start with https://');
    await N.busy(form.querySelector('.btn'), 'Posting…', async function () {
      var r = await sb.from('posts').insert(row);
      if (r.error) return N.say(msg, 'err', r.error.message);
      form.reset(); syncKind();
      N.say(msg, 'good', 'Posted. ' + audience(row) + ' can see it now.');
      await list();
    });
  });

  app.addEventListener('click', async function (e) {
    var b = e.target.closest('[data-del]'); if (!b) return;
    if (!confirm('Remove this post? Students stop seeing it straight away.')) return;
    await N.busy(b, 'Removing…', async function () {
      var r = await sb.from('posts').delete().eq('id', b.getAttribute('data-del')).select('id');
      if (r.error) return N.toast(r.error.message);
      if (!r.data || !r.data.length) return N.toast('Only the person who posted it, or the HOD, can remove it');
      N.toast('Removed');
      await list();
    });
  });

  await list();
})();
