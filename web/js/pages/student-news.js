/* Student News & events: the newsletter, and upcoming hackathons, workshops and talks.
   Moved over from the original mockup (news.html).

   Posts come from public.posts: teachers and the HOD write them on their own News & events
   page. "Read" marks are per device. */
(async function () {
  'use strict';
  var N = NEST, esc = N.esc;
  var me = await N.requireRole('student');
  var app = N.shell(me, { active: 'news', title: 'News & events', sub: 'Newsletters from your teachers, and what is coming up.' });

  // Posts meant for this student: everyone's, their semester's, their section's.
  // Row-level security does the choosing.
  var res = await N.must(N.sb.from('posts')
    .select('id, kind, title, summary, body, event_on, event_time, location, team, closes, link, posted_by_name, created_at')
    .order('created_at', { ascending: false }).limit(200));
  var posts = res.data || [];

  function when(ts) {
    var d = new Date(ts), t = new Date(); t.setHours(0, 0, 0, 0);
    var days = Math.round((t - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 864e5);
    return days <= 0 ? 'Today' : days === 1 ? 'Yesterday' : N.fmtDate(N.localISO(d), { day: 'numeric', month: 'short' });
  }
  function paras(text) { return String(text || '').split(/\n\s*\n/).map(function (p) { return p.trim(); }).filter(Boolean); }

  var NEWS = posts.filter(function (p) { return p.kind === 'news'; }).map(function (p) {
    return { id: p.id, by: p.posted_by_name || 'Your department', when: when(p.created_at), t: p.title, sum: p.summary || '', body: paras(p.body) };
  });
  var EVENTS = posts.filter(function (p) { return p.kind !== 'news' && p.event_on; }).map(function (p) {
    return { id: p.id, k: p.kind, date: p.event_on, t: p.title, desc: p.summary || paras(p.body)[0] || '', where: p.location || '', time: p.event_time || '',
      team: p.team || '', close: p.closes || '', link: p.link || '' };
  });

  var VIEWS = [['newsletter', 'Newsletter'], ['hackathon', 'Hackathons'], ['workshop', 'Workshops'], ['talk', 'Talks']];
  var MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

  // Only events from today onwards, soonest first.
  var today = new Date(); today.setHours(0, 0, 0, 0);
  var events = EVENTS.filter(function (e) { return new Date(e.date + 'T00:00:00') >= today; })
    .sort(function (a, b) { return a.date < b.date ? -1 : 1; });

  // "Read" marks are per device for now.
  var readMap = {};
  try { readMap = JSON.parse(localStorage.getItem('nest.newsRead') || '{}'); } catch (e) { readMap = {}; }
  function saveRead() { try { localStorage.setItem('nest.newsRead', JSON.stringify(readMap)); } catch (e) { /* not remembered */ } }

  var view = 'newsletter', openItem = null;
  var h = location.hash.slice(1);
  if (VIEWS.some(function (v) { return v[0] === h; })) view = h;

  var ICON = {
    pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    team: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0M16 4a3 3 0 0 1 0 6M21 20a6 6 0 0 0-4-5.6"/></svg>',
    out: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>',
    chev: '<svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg>'
  };

  function count(id) {
    if (id === 'newsletter') return NEWS.filter(function (n) { return !readMap[n.id]; }).length;
    return events.filter(function (e) { return e.k === id; }).length;
  }

  function newsHTML() {
    if (!NEWS.length) return '<div class="nw-empty">No news yet. Posts from your teachers and the HOD appear here.</div>';
    return '<ul class="nw-news card">' + NEWS.map(function (n) {
      var open = openItem === n.id;
      return '<li class="' + (readMap[n.id] ? 'nw-read' : '') + '">' +
        '<button class="nw-item" type="button" data-n="' + n.id + '" aria-expanded="' + open + '" aria-controls="b-' + n.id + '">' +
          '<span class="nw-dot" aria-hidden="true"></span>' +
          '<span><span class="src">' + esc(n.by) + ' · ' + esc(n.when) + '</span>' +
          '<span class="ttl">' + esc(n.t) + (readMap[n.id] ? '' : '<span class="sr"> (unread)</span>') + '</span><span class="sum">' + esc(n.sum) + '</span></span>' +
          ICON.chev + '</button>' +
        '<div class="nw-body" id="b-' + n.id + '"' + (open ? '' : ' hidden') + '>' +
          n.body.map(function (p) { return '<p>' + esc(p) + '</p>'; }).join('') +
          '<div class="from">' + esc(n.by) + '</div></div></li>';
    }).join('') + '</ul>';
  }

  function eventHTML(e) {
    var d = new Date(e.date + 'T00:00:00');
    var open = e.link ? '<a class="nw-ev" href="' + esc(e.link) + '" target="_blank" rel="noopener">' : '<div class="nw-ev">';
    return '<li>' + open +
      '<div class="nw-ev-top"><div class="nw-date"><div class="d">' + ('0' + d.getDate()).slice(-2) + '</div><div class="m">' + MONTHS[d.getMonth()] + '</div></div>' +
        '<div><div class="kind">' + esc(e.k) + '</div><div class="ttl">' + esc(e.t) + '</div></div></div>' +
      '<div class="desc">' + esc(e.desc) + '</div>' +
      '<ul class="facts">' + (e.where ? '<li>' + ICON.pin + esc(e.where) + '</li>' : '') + (e.time ? '<li>' + ICON.clock + esc(e.time) + '</li>' : '') +
        (e.team ? '<li>' + ICON.team + esc(e.team) + '</li>' : '') +
        (e.close ? '<li class="closing">' + esc(e.close) + '</li>' : '') + '</ul>' +
      (e.link ? '<span class="go">Open event page' + ICON.out + '<span class="sr"> (opens in a new tab)</span></span></a></li>' : '</div></li>');
  }

  function render() {
    var chips = VIEWS.map(function (v) {
      var c = count(v[0]);
      return '<button class="nw-chip" role="tab" type="button" id="chip-' + v[0] + '" data-v="' + v[0] + '" aria-selected="' + (v[0] === view) + '" tabindex="' + (v[0] === view ? 0 : -1) + '">' +
        v[1] + (c ? '<span class="c">' + c + '</span>' : '') + '</button>';
    }).join('');
    var body;
    if (view === 'newsletter') body = newsHTML();
    else {
      var list = events.filter(function (e) { return e.k === view; });
      body = list.length ? '<ul class="nw-events">' + list.map(eventHTML).join('') + '</ul>' : '<div class="nw-empty">Nothing coming up here yet.</div>';
    }
    app.innerHTML = '<div class="nw-bar"><div class="nw-chips" role="tablist" aria-label="Show" id="chips">' + chips + '</div>' +
      '<button class="nw-link" type="button" id="markAll"' + (view !== 'newsletter' || !count('newsletter') ? ' hidden' : '') + '>Mark all as read</button></div>' +
      '<section role="tabpanel" aria-labelledby="chip-' + view + '" id="view">' + body + '</section>';
  }

  app.addEventListener('click', function (e) {
    var chip = e.target.closest('.nw-chip');
    if (chip) { view = chip.dataset.v; history.replaceState(null, '', '#' + view); render(); return; }
    if (e.target.closest('#markAll')) { NEWS.forEach(function (n) { readMap[n.id] = true; }); saveRead(); render(); N.toast('All marked as read'); return; }
    var item = e.target.closest('.nw-item');
    if (item) {
      var id = item.dataset.n;
      openItem = openItem === id ? null : id;
      if (!readMap[id]) { readMap[id] = true; saveRead(); }
      render(); var again = app.querySelector('.nw-item[data-n="' + id + '"]'); if (again) again.focus();
    }
  });
  app.addEventListener('keydown', function (e) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft' || !e.target.closest('.nw-chip')) return;
    var i = VIEWS.findIndex(function (v) { return v[0] === view; });
    view = VIEWS[(i + (e.key === 'ArrowRight' ? 1 : -1) + VIEWS.length) % VIEWS.length][0];
    e.preventDefault(); history.replaceState(null, '', '#' + view); render();
    document.getElementById('chip-' + view).focus();
  });

  render();
})();
