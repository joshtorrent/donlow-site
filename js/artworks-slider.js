/* ============================================================
   DON LOW — Artworks horizontal slider
   Each card's --s (scale) is driven by its horizontal distance
   from the slider's center. --y (levitation) is a sine wave
   with a per-index phase for organic motion.
   ============================================================ */

;(function () {
  'use strict';

  var track = document.getElementById('artworks-track');
  var slider = track && track.parentElement; // .artworks (scroll container)
  if (!track || !slider) return;

  var cards = Array.prototype.slice.call(track.querySelectorAll('.artwork'));
  if (!cards.length) return;

  // Scale: min at edges, max at center
  var S_MIN  = 0.78;
  var S_MAX  = 1.08;
  // Levitation: amplitude + slow frequency, per-card phase offset
  var LEV_AMP = 10;    // px
  var LEV_HZ  = 0.25;  // cycles per second
  var LEV_PHASE_STEP = 0.7; // radians between adjacent cards

  var scrollRaf = null;
  var startTime = performance.now();

  function updateScales() {
    scrollRaf = null;
    var rect = slider.getBoundingClientRect();
    var centerX = rect.left + rect.width / 2;
    var halfW   = rect.width / 2;

    for (var i = 0; i < cards.length; i++) {
      var card = cards[i];
      var r = card.getBoundingClientRect();
      var cardCenter = r.left + r.width / 2;
      var dist = Math.abs(cardCenter - centerX);
      // Normalize: 0 = at center, 1 = at/past edge
      var n = Math.min(1, dist / halfW);
      var s = S_MAX - (S_MAX - S_MIN) * n;
      card.style.setProperty('--s', s.toFixed(3));
    }
  }

  function requestScaleUpdate() {
    if (scrollRaf !== null) return;
    scrollRaf = requestAnimationFrame(updateScales);
  }

  function levitationLoop(now) {
    var t = (now - startTime) / 1000;
    for (var i = 0; i < cards.length; i++) {
      var phase = i * LEV_PHASE_STEP;
      var y = Math.sin(t * LEV_HZ * 2 * Math.PI + phase) * LEV_AMP;
      cards[i].style.setProperty('--y', y.toFixed(2) + 'px');
    }
    requestAnimationFrame(levitationLoop);
  }

  // Initial center: scroll track so the middle card is at slider center
  function centerInitial() {
    var midIndex = Math.floor(cards.length / 2);
    var card = cards[midIndex];
    if (!card) return;
    var cardRect = card.getBoundingClientRect();
    var sliderRect = slider.getBoundingClientRect();
    var cardCenter = card.offsetLeft + card.offsetWidth / 2;
    var target = cardCenter - sliderRect.width / 2;
    slider.scrollLeft = Math.max(0, target);
  }

  slider.addEventListener('scroll', requestScaleUpdate, { passive: true });
  window.addEventListener('resize', requestScaleUpdate);

  // ---------------------------------------------------------------
  // AUTO-SCROLL — gentle continuous drift, ping-pong at ends
  // ---------------------------------------------------------------
  var AUTO_SPEED = 28;        // px/s
  var RESUME_DELAY = 2500;    // ms after user interaction before resuming

  var autoOn    = true;
  var inView    = true;
  var autoRaf   = null;
  var autoDir   = 1;           // 1 = forward, -1 = reverse
  var lastTick  = null;
  var accum     = 0;           // fractional accumulator
  var resumeT   = null;

  function autoLoop(now) {
    if (!autoOn || !inView) { autoRaf = null; return; }
    if (lastTick === null) lastTick = now;
    var dt = now - lastTick;
    lastTick = now;

    accum += (AUTO_SPEED * dt / 1000) * autoDir;
    if (Math.abs(accum) >= 1) {
      var step = Math.trunc(accum);
      slider.scrollLeft += step;
      accum -= step;
    }

    var max = slider.scrollWidth - slider.clientWidth;
    if (slider.scrollLeft >= max - 1 && autoDir > 0) autoDir = -1;
    if (slider.scrollLeft <= 0       && autoDir < 0) autoDir = 1;

    autoRaf = requestAnimationFrame(autoLoop);
  }

  function startAuto() {
    if (autoRaf !== null) return;
    lastTick = null;
    accum = 0;
    autoRaf = requestAnimationFrame(autoLoop);
  }

  function pauseAuto() {
    autoOn = false;
    if (autoRaf !== null) { cancelAnimationFrame(autoRaf); autoRaf = null; }
    if (resumeT) clearTimeout(resumeT);
    resumeT = setTimeout(function () {
      autoOn = true;
      startAuto();
    }, RESUME_DELAY);
  }

  // User interaction pauses auto-scroll briefly
  ['touchstart', 'wheel', 'pointerdown', 'mousedown'].forEach(function (ev) {
    slider.addEventListener(ev, pauseAuto, { passive: true });
  });

  // Stop auto-scroll entirely when slider is off-screen (battery saver)
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        inView = e.isIntersecting;
        if (inView && autoOn) startAuto();
      });
    }, { threshold: 0.05 });
    io.observe(slider);
  }

  // Kick everything off when layout is stable
  function start() {
    centerInitial();
    updateScales();
    requestAnimationFrame(levitationLoop);
    startAuto();
  }
  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start);
})();
