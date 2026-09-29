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

  // rows: array of arrays. Excel opens UTF-8 CSV with a BOM directly.
  function downloadCSV(filename, rows) {
    var csv = rows.map(function (r) {
      return r.map(function (c) { c = String(c); return /[",\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c; }).join(',');
    }).join('\r\n');
    var blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  initTheme();
  drawSwirl();
  return { store: store, esc: esc, toast: toast, downloadCSV: downloadCSV };
})();
