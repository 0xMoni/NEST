/* Attendance to Excel (.xlsx), downloaded or saved to the teacher's own
   Google Drive. Loaded after api.js on the pages that offer it.

   The numbers come from two database functions, attendance_register() and
   section_attendance_summary(), not from table queries here. Two reasons:
   the API returns at most 1000 rows per request (one class's term is ~3000
   attendance rows, so a sheet built from plain queries would stop short), and
   subject teachers can't read students' profiles, only the class roster.
   The functions run as the signed-in person, so row-level security still
   decides what ends up in the sheet.

   Drive needs a Google OAuth client id in config.js (GOOGLE_CLIENT_ID); see
   docs/google-drive-setup.md. Without one the Drive button says what is
   missing and Download still works. Scope is drive.file: NEST can only see
   files it created, never the rest of the teacher's Drive. Sheets go into a
   "NEST reports" folder. The Excel library and Google's sign-in script load
   only when a button is pressed. */
(function () {
  'use strict';
  var N = window.NEST;

  var XLSX_URL = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
  var XLSX_SRI = 'sha384-EnyY0/GSHQGSxSgMwaIPzSESbqoOLSexfnSMN2AP+39Ckmn92stwABZynq1JyzdT';
  var GIS_URL = 'https://accounts.google.com/gsi/client';
  var SCOPE = 'https://www.googleapis.com/auth/drive.file';
  var XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  var MIN = 75;   // the department's minimum, per subject

  // ---------------------------------------------------------------- loading

  var loaded = {};
  function loadScript(src, integrity) {
    if (loaded[src]) return loaded[src];
    return (loaded[src] = new Promise(function (ok, fail) {
      var s = document.createElement('script');
      s.src = src; s.async = true;
      if (integrity) { s.integrity = integrity; s.crossOrigin = 'anonymous'; }
      s.onload = ok;
      s.onerror = function () { delete loaded[src]; fail(new Error('Could not load ' + src.split('/')[2] + '. Check your connection and try again.')); };
      document.head.appendChild(s);
    }));
  }
  function xlsx() { return loadScript(XLSX_URL, XLSX_SRI).then(function () { return window.XLSX; }); }

  async function rpc(name, args) {
    var r = await N.sb.rpc(name, args);
    if (r.error) throw new Error(r.error.message);
    return r.data;
  }

  // ---------------------------------------------------------------- sheets

  // 2026-11-02 -> 02-11-2026, the way the college writes dates.
  function dmy(iso) { return iso ? iso.slice(8, 10) + '-' + iso.slice(5, 7) + '-' + iso.slice(0, 4) : ''; }
  function status(p) { return p == null ? 'No classes' : p < MIN ? 'Short' : 'OK'; }
  function range(from, to) {
    return from && to ? dmy(from) + ' to ' + dmy(to) : from ? 'from ' + dmy(from) : to ? 'up to ' + dmy(to) : 'whole term';
  }
  // Excel forbids : \ / ? * [ ] in sheet names and caps them at 31 characters.
  function sheetName(s, taken) {
    var base = String(s).replace(/[:\\/?*[\]]/g, ' ').trim().slice(0, 31) || 'Sheet', name = base, i = 2;
    while (taken[name.toLowerCase()]) name = base.slice(0, 28) + ' (' + i++ + ')';
    taken[name.toLowerCase()] = true;
    return name;
  }
  function fileName(parts) { return parts.join('_').replace(/[^\w.-]+/g, '_') + '.xlsx'; }

  /** A sheet from rows of values. head: index of the header row (gets Excel's
   *  filter buttons); widths: column widths in characters. Percentages stay
   *  numbers so Excel can sort and average them. */
  function sheet(X, rows, head, widths) {
    var ws = X.utils.aoa_to_sheet(rows);
    ws['!cols'] = widths.map(function (w) { return { wch: w }; });
    ws['!autofilter'] = { ref: X.utils.encode_range({ s: { r: head, c: 0 }, e: { r: rows.length - 1, c: rows[head].length - 1 } }) };
    return ws;
  }

  /** Every student against every class held: P, A, or blank if they weren't on the roll that day. */
  function registerSheet(X, reg) {
    var c = reg.class;
    var rows = [
      [c.subject_code + ' · ' + c.subject_name + ' · ' + c.section],
      ['Teacher: ' + (c.faculty_name || '—') + '   ·   ' + range(reg.from, reg.to) + '   ·   P = present, A = absent, blank = not on the roll that day   ·   exported ' + dmy(N.localISO())],
      [],
      ['USN', 'Name'].concat(reg.sessions.map(function (s) { return dmy(s.held_on) + ' P' + s.period; }), ['Held', 'Attended', '%', 'Status'])
    ];
    reg.students.forEach(function (s) {
      rows.push([s.usn || '', s.name].concat(s.marks.map(function (m) { return m || ''; }), [s.held, s.attended, s.percentage, status(s.percentage)]));
    });
    if (!reg.students.length) rows.push(['No students are enrolled in this section.']);
    return sheet(X, rows, 3, [14, 26].concat(reg.sessions.map(function () { return 11; }), [7, 9, 7, 10]));
  }

  /** One class, in Prithika's layout: the class report page gives a single
   *  summary sheet, the attendance page a single date-by-date register.
   *  kind: 'summary' | 'register'. from/to are optional (whole term if empty). */
  async function classWorkbook(assignmentId, kind, from, to) {
    var res = await Promise.all([xlsx(), rpc('attendance_register', { p_assignment_id: assignmentId, p_from: from || null, p_to: to || null })]);
    var X = res[0], reg = res[1], c = reg.class, wb = X.utils.book_new();
    var label = c.subject_name + ' · ' + c.section + (from || to ? ' · ' + range(from, to) : '');
    var rows, widths, sheetTitle, base;

    if (kind === 'register') {
      rows = [[label], [], ['USN', 'Name'].concat(reg.sessions.map(function (s) { return s.held_on + ' P' + s.period; }), ['Held', 'Attended', '%'])];
      reg.students.forEach(function (s) {
        rows.push([s.usn || '', s.name].concat(s.marks.map(function (m) { return m || ''; }), [s.held, s.attended, s.percentage == null ? '' : s.percentage]));
      });
      widths = [14, 28].concat(reg.sessions.map(function () { return 11; }), [7, 9, 7]);
      sheetTitle = 'Register'; base = 'Attendance ' + c.subject_code + ' ' + c.section;
    } else {
      rows = [[label + ' · classes held: ' + reg.sessions.length], [], ['USN', 'Name', 'Held', 'Attended', 'Percentage', 'Status']];
      reg.students.forEach(function (s) {
        var p = s.percentage;
        // One miss away: fine now, but one more absence takes them below the minimum.
        var edge = s.held > 0 && p >= MIN && (s.attended / (s.held + 1)) * 100 < MIN;
        rows.push([s.usn || '', s.name, s.held, s.attended, p == null ? '' : p,
          p == null ? 'No classes yet' : p < MIN ? 'Below ' + MIN + '%' : edge ? 'One miss away' : 'Fine']);
      });
      widths = [14, 28, 8, 10, 12, 16];
      sheetTitle = 'Class report'; base = 'Class report ' + c.subject_code + ' ' + c.section;
    }

    var ws = X.utils.aoa_to_sheet(rows);
    ws['!cols'] = widths.map(function (w) { return { wch: w }; });
    X.utils.book_append_sheet(wb, ws, sheetTitle);
    return {
      X: X, wb: wb,
      name: base.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-') + (from || to ? '-' + (from || 'start') + '-to-' + (to || 'today') : '') + '-' + N.localISO() + '.xlsx',
      note: reg.students.length + ' students, ' + reg.sessions.length + ' classes'
    };
  }

  /** A whole section (HOD): every subject side by side, a list of the
   *  classes, then one register sheet per subject. */
  async function sectionWorkbook(sectionId) {
    var res = await Promise.all([xlsx(), rpc('section_attendance_summary', { p_section_id: sectionId })]);
    var X = res[0], sum = res[1];
    var regs = await Promise.all(sum.classes.map(function (c) { return rpc('attendance_register', { p_assignment_id: c.assignment_id }); }));
    var wb = X.utils.book_new(), taken = { summary: true, classes: true };

    var rows = [
      [sum.section.label + ' — attendance by subject (%)'],
      ['Whole term   ·   minimum ' + MIN + '% in every subject   ·   exported ' + dmy(N.localISO())],
      [],
      ['USN', 'Name'].concat(sum.classes.map(function (c) { return c.subject_code; }), ['Overall %', 'Short in'])
    ];
    sum.students.forEach(function (s) {
      var shortIn = [];
      var cells = s.subjects.map(function (x, i) {
        if (x && x.percentage < MIN) shortIn.push(sum.classes[i].subject_code);
        return x ? x.percentage : '';
      });
      rows.push([s.usn || '', s.name].concat(cells, [s.percentage, shortIn.join(', ')]));
    });
    X.utils.book_append_sheet(wb, sheet(X, rows, 3, [14, 26].concat(sum.classes.map(function () { return 9; }), [10, 22])), 'Summary');

    var cls = [['Code', 'Subject', 'Teacher', 'Classes held']].concat(sum.classes.map(function (c) {
      return [c.subject_code, c.subject_name, c.faculty_name || '', c.held];
    }));
    X.utils.book_append_sheet(wb, sheet(X, cls, 0, [10, 32, 26, 12]), 'Classes');
    regs.forEach(function (reg) { X.utils.book_append_sheet(wb, registerSheet(X, reg), sheetName(reg.class.subject_code, taken)); });

    return { X: X, wb: wb, name: fileName(['Attendance', sum.section.label, N.localISO()]), note: sum.students.length + ' students, ' + sum.classes.length + ' subjects' };
  }

  // ---------------------------------------------------------------- download

  function download(buf, name) {
    var url = URL.createObjectURL(new Blob([buf], { type: XLSX_MIME }));
    var a = document.createElement('a'); a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }

  // ---------------------------------------------------------------- Google Drive

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

  // ---------------------------------------------------------------- buttons

  /** Puts "Download Excel" and "Save to Google Drive" into `host`.
   *  makeFile: async () => one of the workbooks above, called on click so the
   *  file is current. It may throw a plain Error to show the person a message. */
  function buttons(host, me, makeFile) {
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
          var f = await makeFile();
          var buf = f.X.write(f.wb, { bookType: 'xlsx', type: 'array', compression: true });
          if (!toDrive) { download(buf, f.name); N.toast('Downloaded: ' + f.note); return; }
          var saved = await saveToDrive(buf, f.name, me.email);
          msg.innerHTML = 'Saved to Drive: <a class="link" href="' + N.esc(saved.webViewLink) + '" target="_blank" rel="noopener">' + N.esc(saved.name) + '</a>';
          msg.className = 'msg good';
        } catch (err) { N.say(msg, 'err', err.message); }
      });
    });
  }

  N.exportXlsx = { buttons: buttons, classWorkbook: classWorkbook, sectionWorkbook: sectionWorkbook };
})();
