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
  // GALLERY CYCLING
  // ---------------------------------------------------------------
  var slides = document.querySelectorAll('.gallery__slide');
  var dots   = document.querySelectorAll('.gallery__dot');
  var current = 0;
  var interval = null;
  var INTERVAL_MS = 4000;

  function goTo(i) {
    slides[current].classList.remove('gallery__slide--active');
    dots[current] && dots[current].classList.remove('gallery__dot--active');
    current = (i + slides.length) % slides.length;
    slides[current].classList.add('gallery__slide--active');
    dots[current] && dots[current].classList.add('gallery__dot--active');
  }

  function tickGallery() {
    goTo(current + 1);
  }

  function startAuto() {
    stopAuto();
    interval = setInterval(tickGallery, INTERVAL_MS);
  }
  function stopAuto() {
    if (interval) { clearInterval(interval); interval = null; }
  }

  dots.forEach(function (dot) {
    dot.addEventListener('click', function () {
      var i = parseInt(dot.dataset.i) || 0;
      goTo(i);
      startAuto(); // reset timer
    });
  });

  if (slides.length) startAuto();

  // Pause cycling when tab hidden
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stopAuto();
    else startAuto();
  });

})();
