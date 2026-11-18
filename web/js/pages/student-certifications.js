/* Student Online certifications: upload a certificate and see its status.
   Moved over from the original mockup (certifications.html).

   NOT CONNECTED YET: the checker in backend/certifications is not wired to the app, so nothing is
   uploaded or verified. A file picked here is only listed on this device and marked for the mentor to check. */
(async function () {
  'use strict';
  var N = NEST, esc = N.esc;
  var me = await N.requireRole('student');
  var app = N.shell(me, { active: 'certifications', title: 'Online certifications', sub: 'Upload a certificate and we file it for your teacher.' });

  var MAX = 5 * 1024 * 1024;
  var KEY = 'nest.certs.' + me.id;
  var certs = [];
  try { certs = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { certs = []; }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(certs)); } catch (e) { /* not remembered */ } }

  var LABEL = { verified: 'VERIFIED', review: 'MENTOR WILL CHECK', rejected: 'REJECTED' };
  function count(st) { return certs.filter(function (c) { return c.status === st; }).length; }

  app.innerHTML =
    '<div class="ct-layout"><div class="ct-stack">' +
      '<section class="card"><div class="card-head"><h2>Upload a certificate</h2></div>' +
        '<label class="ct-drop" id="drop"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/></svg>' +
          '<span class="t">Drop a file here, or choose one</span><span class="s">PDF, PNG or JPG, up to 5 MB</span><span class="btn">Choose file</span>' +
          '<input type="file" id="file" accept=".pdf,image/png,image/jpeg"></label></section>' +
      '<section class="card"><div class="card-head"><h2>Your certificates</h2></div><div id="list" aria-live="polite"></div></section>' +
    '</div>' +
    '<aside class="card ct-panel" aria-label="Summary"><dl class="ct-facts" id="facts"></dl>' +
      '<span class="eyebrow">What happens to a file</span>' +
      '<ol class="ct-how"><li>It is checked to be a real certificate with your name on it.</li><li>We work out which provider it is from.</li><li>It goes into that provider’s folder in your teacher’s Google Drive.</li></ol>' +
      '<p class="note">Not connected yet: for now a file is only listed here and your mentor checks it by hand.</p></aside></div>';

  function render() {
    document.getElementById('list').innerHTML = certs.length ? certs.map(function (c) {
      return '<div class="ct-cert"><div><div class="nm">' + esc(c.file) + '</div><div class="meta">Added ' + esc(c.added) + '</div></div>' +
        '<span class="ct-pill ' + c.status + '">' + LABEL[c.status] + '</span>' +
        (c.reason ? '<div class="why ' + c.status + '">' + esc(c.reason) + '</div>' : '') +
        '<div class="acts"><button class="btn sm" type="button" data-remove="' + esc(c.id) + '">Remove</button></div></div>';
    }).join('') : '<p class="empty">Nothing uploaded yet.</p>';
    document.getElementById('facts').innerHTML =
      '<div><dt>Uploaded</dt><dd>' + certs.length + '</dd></div><div><dt>Verified</dt><dd>' + count('verified') + '</dd></div>' +
      '<div><dt>Waiting for your mentor</dt><dd>' + count('review') + '</dd></div><div><dt>Rejected</dt><dd>' + count('rejected') + '</dd></div>';
  }

  function upload(file) {
    if (!file) return;
    if (!/\.(pdf|png|jpe?g)$/i.test(file.name)) { N.toast('Use a PDF, PNG or JPG file'); return; }
    if (file.size > MAX) { N.toast('That file is over 5 MB'); return; }
    // Honest about what happened: nothing was sent anywhere or checked.
    certs.unshift({ id: 'u' + Date.now(), file: file.name, status: 'review', added: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
      reason: 'Saved on this device only. Automatic checking is not switched on yet, so your mentor will look at it.' });
    save(); render(); N.toast('Added. Your mentor will check it');
  }

  var input = document.getElementById('file'), drop = document.getElementById('drop');
  input.addEventListener('change', function () { upload(input.files[0]); input.value = ''; });
  ['dragenter', 'dragover'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('over'); }); });
  ['dragleave', 'drop'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('over'); }); });
  drop.addEventListener('drop', function (e) { upload(e.dataTransfer.files[0]); });
  document.getElementById('list').addEventListener('click', function (e) {
    var b = e.target.closest('[data-remove]'); if (!b) return;
    certs = certs.filter(function (c) { return c.id !== b.dataset.remove; }); save(); render(); N.toast('Removed');
  });
  render();
})();
