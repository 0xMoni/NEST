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
