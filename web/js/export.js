/* Excel export for teacher pages: build an .xlsx in the browser, then either
   download it or save it to the teacher's own Google Drive.

   Drive needs a Google OAuth client id in config.js (GOOGLE_CLIENT_ID). Without
   one the "Save to Google Drive" button explains what is missing and Download still works.
   The scope is drive.file: NEST can only see files it created itself, never the rest
   of the teacher's Drive. The sheet goes into a "NEST reports" folder, and the Google
   sign-in is pre-filled with the teacher's NEST email. */
(function () {
  'use strict';
  var N = window.NEST;
  var XLSX_URL = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
  var GIS_URL = 'https://accounts.google.com/gsi/client';
  var SCOPE = 'https://www.googleapis.com/auth/drive.file';
  var XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

  var loaded = {};
  function loadScript(src) {
    if (loaded[src]) return loaded[src];
    return (loaded[src] = new Promise(function (ok, fail) {
      var s = document.createElement('script');
      s.src = src; s.async = true; s.onload = ok;
      s.onerror = function () { delete loaded[src]; fail(new Error('Could not load ' + src.split('/')[2] + '. Check your connection.')); };
      document.head.appendChild(s);
    }));
  }

  /** rows: array of arrays. Returns an ArrayBuffer holding the .xlsx. */
  async function build(sheetName, rows, widths) {
    await loadScript(XLSX_URL);
    var ws = XLSX.utils.aoa_to_sheet(rows);
    if (widths) ws['!cols'] = widths.map(function (w) { return { wch: w }; });
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName.replace(/[\\\/?*\[\]:]/g, ' ').slice(0, 31));
    return XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  }

  function fileName(base) { return base.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-') + '-' + N.localISO() + '.xlsx'; }

  function download(buf, name) {
    var url = URL.createObjectURL(new Blob([buf], { type: XLSX_MIME }));
    var a = document.createElement('a'); a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }

  var token = null, tokenExp = 0;
  async function driveToken(email) {
    var cid = window.NEST_CONFIG && window.NEST_CONFIG.GOOGLE_CLIENT_ID;
    if (!cid) throw new Error('Google Drive is not set up yet. Add GOOGLE_CLIENT_ID to web/config.js (see docs/google-drive-setup.md). Download still works.');
    if (token && Date.now() < tokenExp) return token;
    await loadScript(GIS_URL);
    return new Promise(function (ok, fail) {
      var client = google.accounts.oauth2.initTokenClient({
        client_id: cid, scope: SCOPE, login_hint: email || undefined,
        callback: function (r) {
          if (r.error) return fail(new Error(r.error === 'access_denied' ? 'Drive access was not allowed.' : 'Google sign-in failed: ' + r.error));
          token = r.access_token; tokenExp = Date.now() + (Number(r.expires_in) - 60) * 1000; ok(token);
        },
        error_callback: function (e) { fail(new Error(e && e.type === 'popup_closed' ? 'The Google window was closed.' : 'Google sign-in failed.')); }
      });
      client.requestAccessToken();
    });
  }

  async function drive(path, tok, opts) {
    var r = await fetch('https://www.googleapis.com' + path, Object.assign({ headers: { Authorization: 'Bearer ' + tok } }, opts));
    if (!r.ok) { token = null; throw new Error('Google Drive said no (' + r.status + '). Try again.'); }
    return r.json();
  }

  async function folderId(tok) {
    var q = encodeURIComponent("name='NEST reports' and mimeType='application/vnd.google-apps.folder' and trashed=false");
    var f = await drive('/drive/v3/files?q=' + q + '&fields=files(id)', tok);
    if (f.files && f.files.length) return f.files[0].id;
    var c = await drive('/drive/v3/files?fields=id', tok, {
      method: 'POST', headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'NEST reports', mimeType: 'application/vnd.google-apps.folder' })
    });
    return c.id;
  }

  async function saveToDrive(buf, name, email) {
    var tok = await driveToken(email);
    var parent = await folderId(tok);
    var b = 'nest' + Date.now();
    var meta = JSON.stringify({ name: name, parents: [parent] });
    var body = new Blob(['--' + b + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + meta + '\r\n--' + b + '\r\nContent-Type: ' + XLSX_MIME + '\r\n\r\n', buf, '\r\n--' + b + '--']);
    return drive('/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink', tok, {
      method: 'POST', headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'multipart/related; boundary=' + b }, body: body
    });
  }

  /** Puts "Download Excel" and "Save to Google Drive" buttons into `host`.
   *  getData: async () => ({ title, sheet, rows, widths }), called on click so the file is current. */
  function buttons(host, me, getData) {
    host.innerHTML = '<button type="button" class="btn sm" data-x="dl">Download Excel</button> ' +
      '<button type="button" class="btn sm" data-x="drive">Save to Google Drive</button>' +
      '<span class="msg" data-x="msg" role="status" style="margin-left:8px"></span>';
    var msg = host.querySelector('[data-x=msg]');
    host.addEventListener('click', async function (e) {
      var b = e.target.closest('[data-x=dl], [data-x=drive]'); if (!b) return;
      var toDrive = b.getAttribute('data-x') === 'drive';
      await N.busy(b, toDrive ? 'Saving…' : 'Preparing…', async function () {
        try {
          N.say(msg, '', '');
          var d = await getData(), buf = await build(d.sheet || 'Sheet1', d.rows, d.widths), name = fileName(d.title);
          if (!toDrive) { download(buf, name); N.toast('Downloaded ' + name); return; }
          var f = await saveToDrive(buf, name, me.email);
          msg.innerHTML = 'Saved to Drive: <a class="link" href="' + N.esc(f.webViewLink) + '" target="_blank" rel="noopener">' + N.esc(f.name) + '</a>';
          msg.className = 'msg good';
        } catch (err) { N.say(msg, 'err', err.message); }
      });
    });
  }

  N.exportXlsx = { buttons: buttons };
})();
