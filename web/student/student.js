/* Student pages: check the sign-in, then load this student's real data.
   The page stays hidden (see #guard) until this has finished, so nobody sees placeholder data flash by.
   Pages that show alerts define window.NEST_onData to draw them once the data is here. */
(function () {
  var show = function () { var g = document.getElementById('guard'); if (g) g.remove(); };
  window.addEventListener('error', show);

  function when(iso) {
    var d = new Date(iso), n = new Date(), day = function (x) { return new Date(x.getFullYear(), x.getMonth(), x.getDate()); };
    var diff = Math.round((day(n) - day(d)) / 864e5);
    var t = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    if (diff === 0) return 'Today, ' + t;
    if (diff === 1) return 'Yesterday';
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  }
  function stamp(iso) {
    var d = new Date(iso);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ', ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }

  NEST.requireRole('student', '../login.html').then(async function (me) {
    if (window.NEST_DATA) {
      // Row-level security returns only this student's own alerts and mentor.
      var r = await Promise.all([
        NEST.sb.from('mentor_alerts').select('id, kind, urgent, title, message, due_text, created_at, acknowledged_at').order('created_at', { ascending: false }),
        NEST.sb.from('mentorships').select('profiles!mentorships_mentor_id_fkey(full_name)').maybeSingle()
      ]);
      var rows = r[0].data || [];
      NEST_DATA.mentorAlerts = rows.map(function (a) {
        return { id: a.id, kind: a.kind, urgent: a.urgent, t: a.title, m: a.message || '', when: when(a.created_at), due: a.due_text || '' };
      });
      NEST_DATA.acks = {};
      rows.forEach(function (a) { if (a.acknowledged_at) NEST_DATA.acks[a.id] = stamp(a.acknowledged_at); });
      if (r[1].data && r[1].data.profiles) NEST_DATA.mentor = r[1].data.profiles.full_name;
      NEST_DATA.me = me;
      if (window.NEST_onData) window.NEST_onData();
    }
    show();
  });
})();
