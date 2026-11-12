/* Shared plumbing for the plain-HTML frontend. Needs, in order:
   config.js, the supabase-js CDN script, then this file.
   Security lives in the database (row-level security), not here: the browser
   key is public by design, and every query runs as the signed-in person. */
(function () {
  var cfg = window.NEST_CONFIG;
  if (!cfg) { document.body.innerHTML = '<p style="padding:2rem">Missing web/config.js. Copy config.example.js to config.js and fill it in.</p>'; throw new Error('no config'); }
  var sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY);

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  // The signed-in person with their profile, or a redirect to the login page.
  async function requireRole(role, loginPath) {
    var s = await sb.auth.getSession();
    var user = s.data.session && s.data.session.user;
    if (!user) { location.href = loginPath || '../login.html'; return new Promise(function () {}); }
    var p = await sb.from('profiles').select('full_name, role, usn, dept, email, must_change_password').eq('id', user.id).single();
    var me = Object.assign({ id: user.id }, p.data);
    if (role && me.role !== role && me.role !== 'admin') { document.body.innerHTML = '<p style="padding:2rem">This page is for ' + esc(role) + ' accounts.</p>'; return new Promise(function () {}); }
    return me;
  }

  async function signOut() { await sb.auth.signOut(); location.href = (location.pathname.indexOf('/faculty/') >= 0 ? '../' : '') + 'login.html'; }

  window.NEST = { sb: sb, esc: esc, requireRole: requireRole, signOut: signOut };
})();
