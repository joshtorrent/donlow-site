/* ============================================================
   DON LOW — World Wide Reach
   - Counters animate from 0 when they enter the viewport
   - Gallery auto-cycles through screenshots (fade), with dot nav
   ============================================================ */

;(function () {
  'use strict';

  // ---------------------------------------------------------------
  // COUNTERS
  // ---------------------------------------------------------------
  var counters = document.querySelectorAll('.counter');

  function formatNumber(val, divideBy, decimals) {
    var out = val / divideBy;
    if (decimals > 0) {
      return out.toFixed(decimals);
    }
    // Integer with no decimals
    return Math.floor(out).toString();
  }

  function animateCounter(el, duration) {
    var valueEl = el.querySelector('.counter__value');
    if (!valueEl) return;

    var target   = parseFloat(valueEl.dataset.target) || 0;
    var divide   = parseFloat(valueEl.dataset.divide) || 1;
    var suffix   = valueEl.dataset.suffix || '';
    var prefix   = valueEl.dataset.prefix || '';
    var decimals = parseInt(valueEl.dataset.decimals) || 0;

    var startTime = null;
    duration = duration || 1800;

    function tick(now) {
      if (startTime === null) startTime = now;
      var t = Math.min(1, (now - startTime) / duration);
      // easeOutExpo
      var eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
      var current = target * eased;
      valueEl.textContent = prefix + formatNumber(current, divide, decimals) + suffix;
      if (t < 1) {
        requestAnimationFrame(tick);
      } else {
        el.classList.add('counter--hit');
      }
    }

    requestAnimationFrame(tick);
  }

  // Trigger counters when they come into view
  if ('IntersectionObserver' in window) {
    var counterObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          animateCounter(entry.target, 2000);
          counterObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.3 });

    counters.forEach(function (c) { counterObserver.observe(c); });
  } else {
    // Fallback: fire all on load
    counters.forEach(function (c) { animateCounter(c, 1500); });
  }

  // ---------------------------------------------------------------
  // SCROLL-PASS SCREENSHOTS — rise continuously as they cross the viewport
  // ---------------------------------------------------------------
  var passImgs = document.querySelectorAll('.pass__img');
  var frameEl  = document.getElementById('frame');
  var rafId    = null;
  var dirty    = false;

  function updatePass() {
    dirty = false;
    if (!passImgs.length || !frameEl) return;
    var viewH = frameEl.clientHeight;
    var frameRect = frameEl.getBoundingClientRect();
    var viewCenter = frameRect.top + viewH / 2;

    passImgs.forEach(function (img) {
      var rect = img.getBoundingClientRect();
      var imgCenter = rect.top + rect.height / 2;
      // Normalize offset: -1 (img center above viewport top) → 0 (centered) → +1 (below viewport bottom)
      var n = (imgCenter - viewCenter) / viewH;
      var clamped = Math.max(-1.2, Math.min(1.2, n));

      // Rise effect: translate Y from +48px (below natural) to -48px (above natural)
      var ty = clamped * 48;

      // Fade: opacity 1 when near center, fades toward edges
      var absN = Math.abs(n);
      var opacity;
      if (absN < 0.35)       opacity = 1;
      else if (absN > 0.9)   opacity = 0;
      else                   opacity = 1 - (absN - 0.35) / 0.55;

      img.style.transform = 'translateY(' + ty + 'px)';
      img.style.opacity = opacity.toFixed(3);
    });
  }

  function requestPassUpdate() {
    if (dirty) return;
    dirty = true;
    rafId = requestAnimationFrame(updatePass);
  }

  if (frameEl && passImgs.length) {
    frameEl.addEventListener('scroll', requestPassUpdate, { passive: true });
    window.addEventListener('resize', requestPassUpdate);
    updatePass(); // initial
  }

  // ---------------------------------------------------------------
  // PROOF TRANSFORM — Spotify → Tours as user scrolls through .proof-wrap
  // ---------------------------------------------------------------
  var proofWrap = document.getElementById('proof-wrap');
  var phaseEls  = document.querySelectorAll('[data-phase]');

  function updateProofPhase() {
    if (!proofWrap || !frameEl) return;
    var rect   = proofWrap.getBoundingClientRect();
    var frameRect = frameEl.getBoundingClientRect();
    var viewH  = frameEl.clientHeight;

    // scrolled = how far into the wrapper we've scrolled, in px
    var scrolled = frameRect.top - rect.top;
    // total distance of sticky scroll inside wrap
    var wrapH = rect.height;
    var stickyRange = wrapH - viewH; // distance sticky stays pinned
    if (stickyRange <= 0) { setPhase('spotify'); return; }

    var progress = Math.min(1, Math.max(0, scrolled / stickyRange));

    // Switch at 55% — a bit past the middle
    var phase = progress > 0.55 ? 'tours' : 'spotify';
    setPhase(phase);
  }

  function setPhase(phase) {
    phaseEls.forEach(function (el) {
      var p = el.dataset.phase;
      var active = (p === phase);
      // Titles use --active class, panels use --active class
      if (el.classList.contains('proof__phase')) {
        el.classList.toggle('proof__phase--active', active);
      } else if (el.classList.contains('proof__panel')) {
        el.classList.toggle('proof__panel--active', active);
      }
    });
  }

  if (proofWrap && frameEl) {
    frameEl.addEventListener('scroll', updateProofPhase, { passive: true });
    window.addEventListener('resize', updateProofPhase);
    updateProofPhase();
  }

})();
