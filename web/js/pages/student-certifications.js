/* Student Online certifications: upload a certificate, and see whether your
   mentor has verified it.

   The file goes to the private `certificates` bucket in Supabase Storage,
   under a folder named after the student; a row in public.certificates says
   what it is and where it stands. The mentor verifies or rejects it on their
   Mentees page. The automatic checker in backend/certifications is not wired
   in yet, so every certificate is checked by a person. */
(async function () {
  'use strict';
  var N = NEST, sb = N.sb, esc = N.esc, must = N.must;
  var me = await N.requireRole('student');
  var app = N.shell(me, { active: 'certifications', title: 'Online certifications', sub: 'Upload a certificate and your mentor checks it.' });

  var MAX = 5 * 1024 * 1024;
  var BUCKET = 'certificates';
  var LABEL = { verified: 'VERIFIED', pending: 'WITH YOUR MENTOR', rejected: 'REJECTED' };
  var STATUS_CLASS = { verified: 'verified', pending: 'review', rejected: 'rejected' };
  var certs = [];

  app.innerHTML =
    '<div class="ct-layout"><div class="ct-stack">' +
      '<section class="card"><div class="card-head"><h2>Upload a certificate</h2></div>' +
        '<form id="meta" class="form-grid" style="margin:0 0 14px" novalidate>' +
          '<label class="field" style="grid-column:1/-1">What is it<input name="title" maxlength="200" placeholder="NPTEL: Introduction to Machine Learning"></label>' +
          '<label class="field">Provider <span class="dim">(optional)</span><input name="provider" maxlength="120" placeholder="NPTEL, Coursera, …"></label>' +
          '<label class="field">Issued on <span class="dim">(optional)</span><input name="issued_on" type="date"></label>' +
        '</form>' +
        '<label class="ct-drop" id="drop"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/></svg>' +
          '<span class="t">Drop the file here, or choose one</span><span class="s">PDF, PNG or JPG, up to 5 MB</span><span class="btn">Choose file</span>' +
          '<input type="file" id="file" accept=".pdf,image/png,image/jpeg"></label>' +
        '<p class="msg" id="msg" role="status"></p></section>' +
      '<section class="card"><div class="card-head"><h2>Your certificates</h2></div><div id="list" aria-live="polite"><p class="loading">Loading…</p></div></section>' +
    '</div>' +
    '<aside class="card ct-panel" aria-label="Summary"><dl class="ct-facts" id="facts"></dl>' +
      '<span class="eyebrow">What happens to a file</span>' +
      '<ol class="ct-how"><li>It is stored privately: only you, your mentor and the HOD can open it.</li><li>Your mentor checks it and marks it verified, or tells you what is wrong.</li><li>A verified certificate shows on your record.</li></ol>' +
      '<p class="note">You can withdraw a certificate until your mentor has checked it.</p></aside></div>';

  var msg = N.$('msg');

  function count(st) { return certs.filter(function (c) { return c.status === st; }).length; }

  function render() {
    N.$('list').innerHTML = certs.length ? certs.map(function (c) {
      var why = c.status === 'rejected' ? (c.note || 'Rejected.') : c.status === 'pending' ? 'Waiting for your mentor to check it.' : '';
      return '<div class="ct-cert"><div><div class="nm">' + esc(c.title) + '</div><div class="meta">' +
          esc([c.provider, c.issued_on ? 'issued ' + N.fmtDate(c.issued_on) : null, 'added ' + N.fmtDate(N.localISO(new Date(c.created_at)))].filter(Boolean).join(' · ')) + '</div></div>' +
        '<span class="ct-pill ' + STATUS_CLASS[c.status] + '">' + LABEL[c.status] + '</span>' +
        (why ? '<div class="why ' + STATUS_CLASS[c.status] + '">' + esc(why) + '</div>' : '') +
        '<div class="acts"><button class="btn sm" type="button" data-open="' + esc(c.file_path) + '">Open</button>' +
          (c.status === 'pending' ? ' <button class="btn sm" type="button" data-remove="' + esc(c.id) + '">Withdraw</button>' : '') + '</div></div>';
    }).join('') : '<p class="empty">Nothing uploaded yet.</p>';
    N.$('facts').innerHTML =
      '<div><dt>Uploaded</dt><dd>' + certs.length + '</dd></div><div><dt>Verified</dt><dd>' + count('verified') + '</dd></div>' +
      '<div><dt>With your mentor</dt><dd>' + count('pending') + '</dd></div><div><dt>Rejected</dt><dd>' + count('rejected') + '</dd></div>';
  }

  async function load() {
    var r = await must(sb.from('certificates').select('id, title, provider, issued_on, file_path, file_name, status, note, created_at')
      .eq('student_id', me.id).order('created_at', { ascending: false }));
    certs = r.data || [];
    render();
  }

  function safeName(name) { return name.replace(/[^A-Za-z0-9._-]+/g, '_').slice(-80); }

  var uploading = false;
  async function upload(file) {
    if (!file || uploading) return;
    var f = N.$('meta').elements;
    var title = f.title.value.trim() || file.name.replace(/\.[^.]+$/, '');
    if (!/\.(pdf|png|jpe?g)$/i.test(file.name)) return N.say(msg, 'err', 'Use a PDF, PNG or JPG file.');
    if (file.size > MAX) return N.say(msg, 'err', 'That file is over 5 MB.');
    uploading = true; N.say(msg, '', 'Uploading…');
    try {
      var path = me.id + '/' + Date.now() + '-' + safeName(file.name);
      var up = await sb.storage.from(BUCKET).upload(path, file, { contentType: file.type || undefined, upsert: false });
      if (up.error) return N.say(msg, 'err', 'Upload failed: ' + up.error.message);
      var r = await sb.from('certificates').insert({
        title: title, provider: f.provider.value.trim() || null, issued_on: f.issued_on.value || null,
        file_path: path, file_name: file.name
      });
      if (r.error) {
        await sb.storage.from(BUCKET).remove([path]);   // don't leave a file nobody can see listed
        return N.say(msg, 'err', r.error.message);
      }
      N.$('meta').reset();
      N.say(msg, 'good', 'Uploaded. Your mentor will check it.');
      await load();
    } finally { uploading = false; }
  }

  var input = N.$('file'), drop = N.$('drop');
  input.addEventListener('change', function () { upload(input.files[0]); input.value = ''; });
  ['dragenter', 'dragover'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('over'); }); });
  ['dragleave', 'drop'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('over'); }); });
  drop.addEventListener('drop', function (e) { upload(e.dataTransfer.files[0]); });

  N.$('list').addEventListener('click', async function (e) {
    var o = e.target.closest('[data-open]');
    if (o) {
      // a window opened now, before the await, is not blocked as a pop-up
      var w = window.open('', '_blank');
      var s = await sb.storage.from(BUCKET).createSignedUrl(o.getAttribute('data-open'), 300);
      if (s.error) { if (w) w.close(); return N.toast('Could not open it: ' + s.error.message); }
      if (w) w.location = s.data.signedUrl; else location.href = s.data.signedUrl;
      return;
    }
    var b = e.target.closest('[data-remove]'); if (!b) return;
    var c = certs.find(function (x) { return x.id === b.getAttribute('data-remove'); });
    if (!c || !confirm('Withdraw "' + c.title + '"?')) return;
    await N.busy(b, 'Withdrawing…', async function () {
      var r = await sb.from('certificates').delete().eq('id', c.id).select('id');
      if (r.error) return N.toast(r.error.message);
      if (!r.data || !r.data.length) return N.toast('Your mentor has already checked it, so it stays on your record');
      await sb.storage.from(BUCKET).remove([c.file_path]);
      N.toast('Withdrawn');
      await load();
    });
  });

  await load();
})();
