/* What the sign-in pages share: the theme toggle, the woven background, and
   the alert box. Loaded after api.js on login, forgot, reset and change
   password — all of which use css/login.css and the same markup. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var root = document.documentElement;

  function isDark() { return NEST.theme() === 'dark'; }
  function paintToggle() {
    var b = $('theme'); if (!b) return;
    b.innerHTML = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' +
      (isDark() ? '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.6v2.2M12 19.2v2.2M21.4 12h-2.2M4.8 12H2.6M18.6 5.4 17 7M7 17l-1.6 1.6M18.6 18.6 17 17M7 7 5.4 5.4"/>'
                : '<path d="M20.5 14.6A8.5 8.5 0 0 1 9.4 3.5a8.5 8.5 0 1 0 11.1 11.1Z"/>') + '</svg>';
    b.setAttribute('aria-label', isDark() ? 'Switch to light theme' : 'Switch to dark theme');
  }

  /* ---- woven background (same drawing as the main app) ---- */
  function seeded(seed) { var a = seed | 0; return function () { a = (a + 0x6d2b79f5) | 0; var t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function drawWeave() {
    var cv = $('weave'), brand = $('brand'); if (!cv || !brand) return;
    var ctx = cv.getContext('2d'); if (!ctx) return;
    var dpr = Math.min(window.devicePixelRatio || 1, 2), r = brand.getBoundingClientRect();
    var size = Math.ceil(Math.max(r.width, r.height) * 1.6) || 900;
    cv.width = size * dpr; cv.height = size * dpr; cv.style.width = cv.style.height = size + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, size, size);
    var cs = getComputedStyle(root), rgb = cs.getPropertyValue('--weave').trim(), base = parseFloat(cs.getPropertyValue('--weave-alpha')) || 0.3;
    var rnd = seeded(20260929), cx = size / 2, cy = size / 2; ctx.lineCap = 'round';
    function strand(count, minR, spanR, wBase, wVar, aMin, aVar, bowScale, steps) {
      for (var i = 0; i < count; i++) {
        var start = rnd() * Math.PI * 2, radius = minR + rnd() * spanR, span = 0.45 + rnd() * 1.7, bow = (rnd() - 0.5) * size * bowScale;
        ctx.beginPath(); ctx.lineWidth = wBase + rnd() * wVar; ctx.strokeStyle = 'rgba(' + rgb + ',' + (base * (aMin + rnd() * aVar)) + ')';
        for (var s = 0; s <= steps; s++) {
          var t = s / steps, th = start + span * t, rr = radius + Math.sin(t * Math.PI) * bow, x = cx + Math.cos(th) * rr, y = cy + Math.sin(th) * rr * 0.86;
          if (s) ctx.lineTo(x, y); else ctx.moveTo(x, y);
        }
        ctx.stroke();
      }
    }
    strand(240, size * 0.14, size * 0.34, 0.45, 1.45, 0.28, 0.72, 0.055, 30);
    strand(70, 0, size * 0.15, 0.35, 0.85, 0.14, 0.28, 0.04, 24);
  }

  var t = $('theme');
  if (t) t.addEventListener('click', function () { NEST.setTheme(isDark() ? 'light' : 'dark'); paintToggle(); drawWeave(); });
  var rt; addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(drawWeave, 180); });
  paintToggle();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(drawWeave);
  drawWeave();

  /* ---- alert box ---- */
  function show(text, ok) {
    var box = $('alert'); if (!box) return;
    $('alertText').textContent = text;
    box.classList.toggle('ok', !!ok);
    box.hidden = false;
  }
  function hide() { var box = $('alert'); if (box) box.hidden = true; }
  function fail(text, field) {
    show(text, false);
    if (field) { field.setAttribute('aria-invalid', 'true'); field.focus(); }
    var w = $('wrap'); if (w) { w.classList.remove('shake'); void w.offsetWidth; w.classList.add('shake'); }
  }
  // Typing again clears the complaint.
  Array.prototype.forEach.call(document.querySelectorAll('.control input'), function (i) {
    i.addEventListener('input', function () { i.removeAttribute('aria-invalid'); hide(); });
  });
  // Show/hide for every password box that has a reveal button beside it.
  Array.prototype.forEach.call(document.querySelectorAll('.reveal'), function (b) {
    var input = b.parentNode.querySelector('input');
    b.addEventListener('click', function () {
      var show = input.type === 'password'; input.type = show ? 'text' : 'password';
      b.textContent = show ? 'Hide' : 'Show'; b.setAttribute('aria-label', show ? 'Hide password' : 'Show password'); input.focus();
    });
  });

  window.AUTH = { show: show, hide: hide, fail: fail };
})();
