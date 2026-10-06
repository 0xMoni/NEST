/* Shared behaviour for NEST inner pages: theme toggle, sidebar swirl, toast, CSV export. */
var NEST = (function () {
  var store = {
    get: function (k, d) { try { var v = localStorage.getItem('nest.' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem('nest.' + k, JSON.stringify(v)); } catch (e) {} }
  };

  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); }

  var toastT;
  function toast(msg) {
    var t = document.getElementById('toast'); if (!t) return;
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(function () { t.classList.remove('show'); }, 2000);
  }

  function initTheme() {
    var btn = document.getElementById('themeBtn');
    var theme = store.get('theme', 'dark');
    function apply(t) {
      if (t === 'light') document.documentElement.setAttribute('data-theme', 'light');
      else document.documentElement.removeAttribute('data-theme');
      if (btn) btn.setAttribute('aria-label', t === 'light' ? 'Switch to dark theme' : 'Switch to light theme');
    }
    apply(theme);
    if (btn) btn.addEventListener('click', function () { theme = theme === 'light' ? 'dark' : 'light'; apply(theme); store.set('theme', theme); });
  }

  function drawSwirl() {
    var svg = document.getElementById('swirl'); if (!svg) return;
    var cx = 40, cy = 760, out = '', seed = 7;
    svg.setAttribute('viewBox', '0 0 260 900');
    svg.setAttribute('preserveAspectRatio', 'xMinYMax slice');
    function rnd() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }
    for (var i = 0; i < 46; i++) {
      var r = 30 + i * 6 + rnd() * 10, a0 = rnd() * Math.PI * 2, a1 = a0 + 0.6 + rnd() * 1.6, ry = r * .82;
      out += '<path d="M' + (cx + r * Math.cos(a0)).toFixed(1) + ' ' + (cy + ry * Math.sin(a0)).toFixed(1) + ' A' + r.toFixed(1) + ' ' + ry.toFixed(1) + ' 0 0 1 ' + (cx + r * Math.cos(a1)).toFixed(1) + ' ' + (cy + ry * Math.sin(a1)).toFixed(1) + '" fill="none" stroke="rgba(207,169,98,' + (0.06 + rnd() * 0.18).toFixed(2) + ')" stroke-width="' + (0.5 + rnd() * 0.7).toFixed(2) + '"/>';
    }
    svg.innerHTML = out;
  }

  /* ---------- PDF export (always light, whatever the page theme) ---------- */
  var LIBS = [
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js'
  ];
  var libsReady;
  function loadScript(src) {
    return new Promise(function (ok, fail) {
      var s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = fail;
      document.head.appendChild(s);
    });
  }
  function loadPDFLibs() {
    if (!libsReady) libsReady = loadScript(LIBS[0]).then(function () { return loadScript(LIBS[1]); });
    return libsReady;
  }
  // The built-in PDF fonts only cover basic Latin, so swap typographic characters for plain ones.
  function plain(v) {
    return String(v).replace(/[·•]/g, '-').replace(/[–—]/g, '-').replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
      .replace(/▲\s?/g, '').replace(/▼\s?/g, '').replace(/&amp;/g, '&');
  }

  var C = { text: [22, 23, 26], muted: [92, 95, 102], faint: [131, 133, 140], gold: [138, 101, 34],
    line: [229, 224, 213], fill: [246, 244, 239], risk: [180, 69, 42], watch: [134, 102, 12], ok: [47, 122, 67] };

  /* opts: { filename, title, subtitle, stats: [{label, value, note, tone}],
             sections: [{ heading, note, head: [..], body: [[..]], tones: [row tone|null], toneCols: [col idx], widths: {col: pt} }] }
     tone: 'risk' | 'watch' | 'ok' | 'muted' */
  function exportPDF(opts) {
    toast('Preparing PDF…');
    return loadPDFLibs().then(function () {
      var doc = new window.jspdf.jsPDF({ unit: 'pt', format: 'a4' });
      var W = doc.internal.pageSize.getWidth(), M = 40, y = M;

      // header
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor.apply(doc, C.gold);
      doc.text('N E S T', M, y);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor.apply(doc, C.faint);
      doc.text('NURTURING EDUCATION & STUDENT TRACKING', M + 44, y);
      y += 30;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(22); doc.setTextColor.apply(doc, C.text);
      doc.text(plain(opts.title), M, y);
      y += 18;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor.apply(doc, C.muted);
      doc.text(plain(opts.subtitle), M, y);
      y += 14;
      doc.setDrawColor.apply(doc, C.text); doc.setLineWidth(0.8); doc.line(M, y, W - M, y);
      y += 20;

      // stat boxes
      if (opts.stats && opts.stats.length) {
        var gap = 10, n = opts.stats.length, bw = (W - 2 * M - gap * (n - 1)) / n, bh = 74;
        opts.stats.forEach(function (s, i) {
          var x = M + i * (bw + gap), tone = C[s.tone] || C.text;
          doc.setDrawColor.apply(doc, s.tone === 'risk' ? C.risk : C.line); doc.setLineWidth(0.7);
          doc.setFillColor.apply(doc, s.tone === 'risk' ? [251, 240, 236] : [255, 255, 255]);
          doc.roundedRect(x, y, bw, bh, 5, 5, 'FD');
          doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor.apply(doc, s.tone === 'risk' ? C.risk : C.muted);
          doc.text(plain(s.label).toUpperCase(), x + 10, y + 16);
          // small values (names) may wrap to two lines; big numbers stay on one
          doc.setFontSize(s.small ? 10.5 : 18); doc.setTextColor.apply(doc, tone);
          doc.text(doc.splitTextToSize(plain(s.value), bw - 20).slice(0, s.small ? 2 : 1), x + 10, y + (s.small ? 33 : 40));
          if (s.note) {
            doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor.apply(doc, s.tone === 'risk' ? C.risk : C.muted);
            doc.text(doc.splitTextToSize(plain(s.note), bw - 20)[0], x + 10, y + bh - 10);
          }
        });
        y += bh + 24;
      }

      // tables
      opts.sections.forEach(function (sec) {
        if (y > doc.internal.pageSize.getHeight() - 120) { doc.addPage(); y = M; }
        doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor.apply(doc, C.text);
        doc.text(plain(sec.heading), M, y);
        if (sec.note) {
          doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor.apply(doc, C.muted);
          doc.text(plain(sec.note), W - M, y, { align: 'right' });
        }
        var colStyles = {};
        Object.keys(sec.widths || {}).forEach(function (k) { colStyles[k] = { cellWidth: sec.widths[k] }; });
        doc.autoTable({
          startY: y + 8, margin: { left: M, right: M },
          head: [sec.head.map(plain)], body: sec.body.map(function (r) { return r.map(plain); }),
          theme: 'plain',
          styles: { font: 'helvetica', fontSize: 9, textColor: C.text, cellPadding: { top: 6, bottom: 6, left: 6, right: 6 }, lineColor: C.line, lineWidth: { bottom: 0.5 } },
          headStyles: { fontStyle: 'bold', fontSize: 7.5, textColor: C.muted, fillColor: C.fill, lineWidth: { bottom: 0.8 }, lineColor: C.text },
          columnStyles: colStyles,
          didParseCell: function (d) {
            if (d.section !== 'body') return;
            var tone = sec.tones && sec.tones[d.row.index];
            if (tone === 'muted') d.cell.styles.textColor = C.faint;
            else if (tone && (sec.toneCols || []).indexOf(d.column.index) >= 0) { d.cell.styles.textColor = C[tone]; d.cell.styles.fontStyle = 'bold'; }
          }
        });
        y = doc.lastAutoTable.finalY + 28;
      });

      // footer on every page
      var pages = doc.internal.getNumberOfPages(), H = doc.internal.pageSize.getHeight();
      var stamp = 'Generated ' + new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
      for (var p = 1; p <= pages; p++) {
        doc.setPage(p);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor.apply(doc, C.faint);
        doc.text('NEST - Aarav Sharma - 23AD014 - ' + stamp, M, H - 24);
        doc.text('Page ' + p + ' of ' + pages, W - M, H - 24, { align: 'right' });
      }
      doc.save(opts.filename);
      toast('PDF downloaded');
    }).catch(function () {
      // offline: fall back to the browser's print dialog (print styles are light too)
      libsReady = null;
      toast('Couldn’t load the PDF tool, opening print instead');
      setTimeout(function () { window.print(); }, 400);
    });
  }

  // Pending mentor alerts, written by mentor.html (3 until the student has opened it).
  function updateMentorBadge(n) {
    if (n === undefined) n = store.get('mentorPending', 3);
    Array.prototype.forEach.call(document.querySelectorAll('[data-mentor-badge]'), function (b) {
      b.textContent = n; b.hidden = !n;
      b.setAttribute('aria-label', n + ' pending alert' + (n === 1 ? '' : 's'));
    });
  }

  initTheme();
  drawSwirl();
  updateMentorBadge();
  return { store: store, esc: esc, toast: toast, exportPDF: exportPDF, updateMentorBadge: updateMentorBadge };
})();
