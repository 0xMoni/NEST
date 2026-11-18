/* Student News & events: the newsletter, and upcoming hackathons, workshops and talks.
   Moved over from the original mockup (news.html).

   The content below is SAMPLE data. There are no newsletter or event tables yet (an earlier
   migration dropped them), so nothing a teacher posts can show up here until those exist. */
(async function () {
  'use strict';
  var N = NEST, esc = N.esc;
  var me = await N.requireRole('student');
  var app = N.shell(me, { active: 'news', title: 'News & events', sub: 'Newsletters from your teachers, and what is coming up.' });

  var NEWS = [
    { id: 'n1', by: 'Dr. Rahul Menon', subject: 'Deep Learning', when: 'Today', t: 'Extra class on CNNs this Saturday', sum: 'Sat 10 Oct · 10:00 AM · Room 304',
      body: ['We will go through CNN architectures and work through last year’s exam questions. Optional, but recommended before the lab internals.', 'Bring your DL Assignment 3 doubts.'] },
    { id: 'n2', by: 'Prof. Kavya S', subject: 'Software Engg. & Project Mgmt', when: 'Yesterday', t: 'Sprint 2 project reviews next week', sum: 'Review slots 12–14 Oct · sign up with your team',
      body: ['Each team gets a 15-minute slot to demo Sprint 2 and walk through the burndown chart.', 'Team leads: pick a slot by Friday. Teams without a slot will be assigned one.'] },
    { id: 'n3', by: 'Dr. Meera Rao', subject: 'AI & DS department', when: '27 Sep', t: 'September newsletter: student projects and a faculty Q&A', sum: '6 min read',
      body: ['This month: three student projects from the Sem 7 capstone, a Q&A on getting started with research, and the results of the department coding contest.'] }
  ];

  // date: YYYY-MM-DD. link: the event's own page (placeholder URLs).
  var EVENTS = [
    { id: 'o2', k: 'workshop', date: '2026-12-06', t: 'MLOps with Docker & FastAPI', desc: 'Package and serve a model, then deploy it. Hands-on, bring a laptop.', where: 'Seminar Hall 2', time: '2:00–5:00 PM', team: 'Individual', link: 'https://example.com/nest/mlops-workshop' },
    { id: 'o3', k: 'talk', date: '2026-12-09', t: 'LLMs in production: alumni talk', desc: 'An alumnus on what it takes to ship and run LLM features at scale.', where: 'Auditorium', time: '11:10 AM', team: 'Open to Sem 5+', link: 'https://example.com/nest/llm-talk' },
    { id: 'o1', k: 'hackathon', date: '2026-12-16', t: 'Inter-college AI hackathon', desc: 'Build an AI tool for a campus problem in 36 hours. Mentors on site.', where: 'Main auditorium', time: '36 hours, from 9:00 AM', team: 'Teams of 4', close: 'Registrations close Mon 12 Dec', link: 'https://example.com/nest/ai-hackathon' },
    { id: 'o6', k: 'talk', date: '2026-12-21', t: 'Women in tech: panel discussion', desc: 'Engineers and founders on careers, research and building teams.', where: 'Seminar Hall 1', time: '3:00 PM', team: 'Open to all', link: 'https://example.com/nest/women-in-tech' }
  ];

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
          '<div class="from">' + esc(n.by) + ' · ' + esc(n.subject) + '</div></div></li>';
    }).join('') + '</ul>';
  }

  function eventHTML(e) {
    var d = new Date(e.date + 'T00:00:00');
    return '<li><a class="nw-ev" href="' + esc(e.link) + '" target="_blank" rel="noopener">' +
      '<div class="nw-ev-top"><div class="nw-date"><div class="d">' + ('0' + d.getDate()).slice(-2) + '</div><div class="m">' + MONTHS[d.getMonth()] + '</div></div>' +
        '<div><div class="kind">' + esc(e.k) + '</div><div class="ttl">' + esc(e.t) + '</div></div></div>' +
      '<div class="desc">' + esc(e.desc) + '</div>' +
      '<ul class="facts"><li>' + ICON.pin + esc(e.where) + '</li><li>' + ICON.clock + esc(e.time) + '</li><li>' + ICON.team + esc(e.team) + '</li>' +
        (e.close ? '<li class="closing">' + esc(e.close) + '</li>' : '') + '</ul>' +
      '<span class="go">Open event page' + ICON.out + '<span class="sr"> (opens in a new tab)</span></span></a></li>';
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
    app.innerHTML = '<p class="nw-sample">Sample content: posting by teachers is not connected yet.</p>' +
      '<div class="nw-bar"><div class="nw-chips" role="tablist" aria-label="Show" id="chips">' + chips + '</div>' +
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
