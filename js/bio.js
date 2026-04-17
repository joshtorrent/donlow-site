/* ============================================================
   DON LOW — Bio page
   Scroll-synced word reveal + mask fade-in on load
   ============================================================ */

;(function () {
  'use strict';

  var frame      = document.getElementById('frame');
  var heroMask   = document.getElementById('bio-hero-mask');
  var paragraph  = document.getElementById('bio-paragraph');
  var words      = paragraph ? paragraph.querySelectorAll('.bio-word') : [];
  var scrollProgress = 0;

  // --- Mask fade-in on load ---------------------------------
  if (heroMask) {
    if (heroMask.complete && heroMask.naturalWidth > 0) {
      requestAnimationFrame(function () {
        heroMask.classList.add('bio-hero-mask--visible');
      });
    } else {
      heroMask.addEventListener('load', function () {
        heroMask.classList.add('bio-hero-mask--visible');
      }, { once: true });
    }
  }

  // --- Scroll tracking --------------------------------------
  function updateScrollProgress() {
    if (!frame) return;
    var maxScroll = frame.scrollHeight - frame.clientHeight;
    if (maxScroll <= 0) { scrollProgress = 0; return; }
    scrollProgress = Math.min(1, Math.max(0, frame.scrollTop / maxScroll));
  }

  frame.addEventListener('scroll', function () {
    updateScrollProgress();
    updateWordReveal();
  }, { passive: true });

  // --- Word reveal -----------------------------------------
  function updateWordReveal() {
    if (!words.length) return;

    // Reveal words between 5% and 95% scroll
    var startAt = 0.05;
    var endAt   = 0.95;
    var range   = endAt - startAt;

    var local = (scrollProgress - startAt) / range;
    local = Math.min(1, Math.max(0, local));

    var toShow = Math.floor(local * words.length);
    for (var i = 0; i < words.length; i++) {
      if (i < toShow) {
        if (!words[i].classList.contains('bio-word--visible'))
          words[i].classList.add('bio-word--visible');
      } else {
        if (words[i].classList.contains('bio-word--visible'))
          words[i].classList.remove('bio-word--visible');
      }
    }
  }

  updateScrollProgress();
  updateWordReveal();

})();
