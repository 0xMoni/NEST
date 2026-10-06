/* Mock data shared by dashboard.html and news.html. The backend will replace this.
   Newsletters are posted by teachers only (for now). Events link out to their own page. */
var NEST_DATA = {
  news: [
    { id: 'n1', by: 'Dr. Rahul Menon', subject: 'Deep Learning', when: 'Today', t: 'Extra class on CNNs this Saturday',
      sum: 'Sat 10 Oct · 10:00 AM · Room 304',
      body: ['We’ll go through CNN architectures and work through last year’s exam questions. Optional, but recommended before the lab internals.', 'Bring your DL Assignment 3 doubts.'] },
    { id: 'n2', by: 'Prof. Kavya S', subject: 'Software Engg. & Project Mgmt', when: 'Yesterday', t: 'Sprint 2 project reviews next week',
      sum: 'Review slots 12–14 Oct · sign up with your team',
      body: ['Each team gets a 15-minute slot to demo Sprint 2 and walk through the burndown chart.', 'Team leads: pick a slot by Friday. Teams without a slot will be assigned one.'] },
    { id: 'n3', by: 'Dr. Meera Rao', subject: 'AI & DS department', when: '27 Sep', t: 'September newsletter: student projects and a faculty Q&A',
      sum: '6 min read',
      body: ['This month: three student projects from the Sem 7 capstone, a Q&A on getting started with research, and the results of the department coding contest.', 'Want your project featured next month? Send me a short write-up.'] },
    { id: 'n4', by: 'Prof. Divya K', subject: 'Data Visualization Lab', when: '24 Sep', t: 'Bring your own dataset to the next lab',
      sum: 'Any public dataset with 1,000+ rows',
      body: ['For the next two labs you’ll build a dashboard on a dataset of your choice. Pick something you actually care about.'] },
    { id: 'n5', by: 'Prof. Arjun Nair', subject: 'Computer Networks', when: '20 Sep', t: 'Lab record: experiments 6–8 to be signed',
      sum: 'Get them signed before 5 Oct',
      body: ['Bring your CN lab record to the lab or my cabin to get experiments 6–8 signed.'] }
  ],

  // date: YYYY-MM-DD. link: the event's own page (placeholder URLs for now).
  events: [
    { id: 'o2', k: 'workshop', date: '2026-10-06', t: 'MLOps with Docker & FastAPI', desc: 'Package and serve a model, then deploy it. Hands-on, bring a laptop.', where: 'Seminar Hall 2', time: '2:00–5:00 PM', team: 'Individual', link: 'https://example.com/nest/mlops-workshop' },
    { id: 'o3', k: 'talk', date: '2026-10-09', t: 'LLMs in production: alumni talk', desc: 'An alumnus on what it takes to ship and run LLM features at scale.', where: 'Auditorium', time: '11:10 AM', team: 'Open to Sem 5+', link: 'https://example.com/nest/llm-talk' },
    { id: 'o4', k: 'workshop', date: '2026-10-14', t: 'Power BI for data storytelling', desc: 'From raw data to a dashboard people actually read. Two sessions.', where: 'Lab 3', time: '2 sessions, 2:00 PM', team: 'Individual', close: '12 seats left', link: 'https://example.com/nest/power-bi' },
    { id: 'o1', k: 'hackathon', date: '2026-10-16', t: 'Inter-college AI hackathon', desc: 'Build an AI tool for a campus problem in 36 hours. Mentors on site.', where: 'Main auditorium', time: '36 hours, from 9:00 AM', team: 'Teams of 4', close: 'Registrations close Mon 12 Oct', link: 'https://example.com/nest/ai-hackathon' },
    { id: 'o5', k: 'hackathon', date: '2026-10-18', t: 'Campus Build-a-thon: internal round', desc: 'Internal round to pick teams for the national hackathon.', where: 'Block B', time: '9:00 AM–6:00 PM', team: 'Teams of 2–6', link: 'https://example.com/nest/build-a-thon' },
    { id: 'o6', k: 'talk', date: '2026-10-21', t: 'Women in tech: panel discussion', desc: 'Engineers and founders on careers, research and building teams.', where: 'Seminar Hall 1', time: '3:00 PM', team: 'Open to all', link: 'https://example.com/nest/women-in-tech' },
    { id: 'o7', k: 'workshop', date: '2026-10-23', t: 'Git and GitHub for team projects', desc: 'Branches, pull requests and reviews, the way real teams work.', where: 'Lab 1', time: '10:00 AM–1:00 PM', team: 'Individual', link: 'https://example.com/nest/git-workshop' }
  ]
};

// The signed-in student.
NEST_DATA.student = { name: 'Aarav Sharma', roll: '23AD014', usn: '1CR23AD014', branch: 'B.Tech AI & DS · Sem 5 · A' };

// NPTEL courses (from the admin's SPOC sheet).
NEST_DATA.nptel = [
  { id: 'cc', title: 'Cloud Computing', inst: 'IIT Kharagpur', run: 'Jul–Oct 2026', bestOf: 8, nptelId: 'NPTEL26CS43S5523014',
    exam: { applied: true, date: 'Sun 25 Oct', slot: 'Forenoon', centre: 'Bengaluru' },
    weeks: [
      { t: 'Introduction to cloud computing', due: '30 Jul', v: [5, 5], s: 80 },
      { t: 'Cloud computing architecture',    due: '6 Aug',  v: [6, 6], s: 90 },
      { t: 'Service models: IaaS, PaaS, SaaS', due: '13 Aug', v: [5, 5], s: 70 },
      { t: 'Virtualization',                  due: '20 Aug', v: [6, 6], s: 100 },
      { t: 'SLAs and cloud economics',        due: '27 Aug', v: [5, 2], s: null },
      { t: 'Resource management',             due: '3 Sep',  v: [6, 6], s: 85 },
      { t: 'Cloud security I',                due: '10 Sep', v: [5, 5], s: 60 },
      { t: 'Cloud security II',               due: '17 Sep', v: [5, 5], s: 90 },
      { t: 'Fog and edge computing',          due: '24 Sep', v: [6, 6], s: 75 },
      { t: 'Containers and Kubernetes',       due: '1 Oct',  v: [5, 4], s: 80 },
      { t: 'Serverless computing',            due: '8 Oct',  v: [5, 1], s: 'open' },
      { t: 'Case studies',                    due: '15 Oct', v: [4, 0], s: 'up' }
    ] },
  { id: 'dse', title: 'Data Science for Engineers', inst: 'IIT Madras', run: 'Aug–Oct 2026', bestOf: 6, nptelId: 'NPTEL26CS71S5523014',
    exam: { applied: false, closes: '10 Oct' },
    weeks: [
      { t: 'Course intro and R basics', due: '26 Aug', v: [7, 7], s: 100 },
      { t: 'Linear algebra',            due: '2 Sep',  v: [8, 8], s: 80 },
      { t: 'Statistics',                due: '9 Sep',  v: [6, 2], s: null },
      { t: 'Optimization',              due: '16 Sep', v: [7, 7], s: 70 },
      { t: 'Regression',                due: '23 Sep', v: [6, 6], s: 90 },
      { t: 'Classification',            due: '30 Sep', v: [7, 5], s: 60 },
      { t: 'Clustering',                due: '7 Oct',  v: [6, 3], s: 'open' },
      { t: 'Capstone case study',       due: '14 Oct', v: [5, 0], s: 'up' }
    ] }
];
NEST_DATA.mentor = 'Dr. Meera Rao';

// Requests from the mentor, newest first.
NEST_DATA.mentorAlerts = [
  { id: 'a1', kind: 'task', urgent: true, t: 'Register for your NPTEL exam',
    m: 'You haven’t registered for the Data Science for Engineers exam yet. Register and send me the receipt.',
    when: 'Today, 9:40 AM', due: 'Due 10 Oct' },
  { id: 'a2', kind: 'meet', t: 'Meet me about the backprop doubts',
    m: 'Come by my cabin on Wednesday at 3:30 PM and bring your working for DL Assignment 3.',
    when: 'Yesterday', due: 'Wed 7 Oct · 3:30 PM' },
  { id: 'a3', kind: 'task', t: 'SEPM attendance is below 75%',
    m: 'Attend every SEPM class this week. If you need a condonation form, collect it from me.',
    when: '5 Oct' }
];

// NPTEL helpers. Closed weeks = deadline passed (submitted or missed).
NEST_DATA.nptelClosed = function (c) {
  return c.weeks.filter(function (w) { return typeof w.s === 'number' || w.s === null; });
};
// Assignment score out of 25 from closed weeks (missed = 0), best `bestOf` weeks. Future weeks can only raise it.
NEST_DATA.nptelScore = function (c) {
  var top = NEST_DATA.nptelClosed(c).map(function (w) { return w.s || 0; }).sort(function (a, b) { return b - a; }).slice(0, c.bestOf);
  return Math.round(top.reduce(function (a, b) { return a + b; }, 0) / (c.bestOf * 100) * 25 * 10) / 10;
};
// [watched, total] for weeks released so far.
NEST_DATA.nptelVideos = function (c) {
  return c.weeks.filter(function (w) { return w.s !== 'up'; })
    .reduce(function (acc, w) { acc[0] += w.v[1]; acc[1] += w.v[0]; return acc; }, [0, 0]);
};

// Events from today onwards, soonest first.
NEST_DATA.upcoming = function () {
  var today = new Date(); today.setHours(0, 0, 0, 0);
  return NEST_DATA.events
    .filter(function (e) { return new Date(e.date + 'T00:00:00') >= today; })
    .sort(function (a, b) { return a.date < b.date ? -1 : 1; });
};
NEST_DATA.dayMonth = function (iso) {
  var d = new Date(iso + 'T00:00:00');
  return { d: ('0' + d.getDate()).slice(-2), m: ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'][d.getMonth()] };
};
