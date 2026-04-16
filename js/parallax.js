/* ============================================================
   DON LOW — EPK v2
   - Loader: waits for all assets, then staggered reveal
   - Parallax: mouse (desktop) + gyroscope (mobile)
   - Idle breathing: subtle continuous float on non-video layers
   - Masque video: plays once, stops on last frame
   ============================================================ */

;(function () {
  'use strict';

  var layers    = document.querySelectorAll('.layer');
  var frame     = document.getElementById('frame');
  var loader    = document.getElementById('loader');
  var maskVideo = document.getElementById('layer-mask-video');
  var maskImg   = document.getElementById('layer-mask-img');
  var nav       = document.querySelector('.nav');
  var stats     = document.querySelector('.stats');
  var scrollHint = document.querySelector('.scroll-hint');

  if (!layers.length || !frame) return;

  // === CONFIG ===
  var MAX_SHIFT     = 25;   // px — parallax max translation
  var IDLE_AMP      = 3;    // px — idle breathing amplitude base
  var IDLE_SPEED    = 0.4;  // base speed multiplier (slow drift)
  var REVEAL_DELAY  = 80;   // ms between each layer reveal

  // === STATE ===
  var mouseX   = 0, mouseY   = 0;
  var tiltX    = 0, tiltY    = 0;
  var useGyro  = false;
  var revealed = false;
  var startTime = Date.now();

  // ----------------------------------------------------------
  // LOADER — wait for all images + video, then reveal
  // ----------------------------------------------------------
  function waitForAssets() {
    var promises = [];

    // Wait for all layer images
    layers.forEach(function (el) {
      if (el.tagName === 'IMG') {
        if (el.complete && el.naturalWidth > 0) return;
        promises.push(new Promise(function (resolve) {
          el.addEventListener('load', resolve, { once: true });
          el.addEventListener('error', resolve, { once: true });
        }));
      }
    });

    // Wait for masque video to be ready (or timeout)
    if (maskVideo) {
      promises.push(new Promise(function (resolve) {
        if (maskVideo.readyState >= 3) { resolve(); return; }
        maskVideo.addEventListener('canplaythrough', resolve, { once: true });
        maskVideo.addEventListener('error', resolve, { once: true });
        // Timeout: don't block forever on video
        setTimeout(resolve, 5000);
      }));
    }

    // Safety timeout — reveal after 6s max
    var timeout = new Promise(function (resolve) { setTimeout(resolve, 6000); });

    return Promise.race([
      Promise.all(promises),
      timeout
    ]);
  }

  function reveal() {
    if (revealed) return;
    revealed = true;

    // Sort layers: back (10) to front (1) for staggered reveal
    var sorted = Array.from(layers).sort(function (a, b) {
      return (parseInt(b.dataset.layer) || 0) - (parseInt(a.dataset.layer) || 0);
    });

    sorted.forEach(function (el, i) {
      setTimeout(function () {
        el.classList.add('layer--visible');
      }, i * REVEAL_DELAY);
    });

    // Reveal UI after all layers
    var uiDelay = sorted.length * REVEAL_DELAY + 200;
    setTimeout(function () {
      if (nav)        nav.classList.add('nav--visible');
      if (stats)      stats.classList.add('stats--visible');
      if (scrollHint) scrollHint.classList.add('scroll-hint--visible');
    }, uiDelay);

    // Fade out loader
    setTimeout(function () {
      if (loader) loader.classList.add('loader--hidden');
    }, 100);

    // Play masque video once (after reveal settles)
    var videoDelay = uiDelay + 400;
    setTimeout(function () {
      startMaskVideo();
    }, videoDelay);
  }

  waitForAssets().then(reveal);

  // ----------------------------------------------------------
  // MASQUE VIDEO — play once, stop on last frame
  // ----------------------------------------------------------
  function startMaskVideo() {
    if (!maskVideo || !maskImg) return;

    // Show video, hide PNG
    maskImg.style.display   = 'none';
    maskVideo.style.display = 'block';
    maskVideo.classList.add('layer--visible');

    // Play once — no loop attribute in HTML
    maskVideo.play().catch(function () {
      // Autoplay blocked: show PNG fallback
      maskImg.style.display   = 'block';
      maskVideo.style.display = 'none';
    });

    // On ended: video stays on last frame (default behavior)
  }

  // ----------------------------------------------------------
  // MOUSE (desktop)
  // ----------------------------------------------------------
  frame.addEventListener('mousemove', function (e) {
    if (useGyro) return;
    var rect = frame.getBoundingClientRect();
    mouseX = ((e.clientX - rect.left) / rect.width  - 0.5) * 2;
    mouseY = ((e.clientY - rect.top)  / rect.height - 0.5) * 2;
  });

  frame.addEventListener('mouseleave', function () {
    mouseX = 0;
    mouseY = 0;
  });

  // ----------------------------------------------------------
  // GYROSCOPE (mobile)
  // ----------------------------------------------------------
  function handleOrientation(e) {
    useGyro = true;
    var beta  = Math.max(-30, Math.min(30, e.beta  || 0));
    var gamma = Math.max(-30, Math.min(30, e.gamma || 0));
    tiltX = gamma / 30;
    tiltY = beta  / 30;
  }

  function initGyro() {
    if (typeof DeviceOrientationEvent !== 'undefined' &&
        typeof DeviceOrientationEvent.requestPermission === 'function') {
      DeviceOrientationEvent.requestPermission()
        .then(function (state) {
          if (state === 'granted')
            window.addEventListener('deviceorientation', handleOrientation);
        })
        .catch(function () {});
    } else {
      window.addEventListener('deviceorientation', handleOrientation);
    }
  }

  if ('ontouchstart' in window) {
    document.addEventListener('touchstart', function onTouch() {
      initGyro();
      document.removeEventListener('touchstart', onTouch);
    }, { once: true });
  }

  // ----------------------------------------------------------
  // ANIMATION LOOP — parallax + idle breathing
  // ----------------------------------------------------------
  function animate() {
    var nx = useGyro ? tiltX : mouseX;
    var ny = useGyro ? tiltY : mouseY;
    var t  = (Date.now() - startTime) / 1000; // seconds elapsed

    layers.forEach(function (el) {
      var depth = parseFloat(el.dataset.parallax) || 0;
      var layerNum = parseInt(el.dataset.layer) || 0;
      var isVideo = el.tagName === 'VIDEO';

      // Parallax shift (mouse or gyro)
      var px = nx * MAX_SHIFT * depth * -1;
      var py = ny * MAX_SHIFT * depth * -1;

      // Idle breathing (skip video layer)
      var ix = 0, iy = 0;
      if (!isVideo) {
        // Each layer gets a unique phase offset based on its layer number
        var phase = layerNum * 0.7;
        var speed = IDLE_SPEED * (0.6 + depth);
        var amp   = IDLE_AMP * depth;
        ix = Math.sin(t * speed + phase)       * amp;
        iy = Math.cos(t * speed * 0.7 + phase) * amp * 0.6;
      }

      el.style.transform =
        'translate3d(' + (px + ix) + 'px, ' + (py + iy) + 'px, 0)';
    });

    requestAnimationFrame(animate);
  }

  requestAnimationFrame(animate);

})();
