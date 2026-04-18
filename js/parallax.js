/* ============================================================
   DON LOW — EPK v2
   - Loader: "WELCOME TO THE JUNGLE" + BPM 70→170 tied to real asset
     loading. Letter-stagger reveal. Title pulses at current BPM.
   - Hero: staggered layer reveal once loader exits.
   - Parallax: mouse (desktop) + gyroscope (mobile).
   - Scroll-out: each layer exits toward its data-exit edge with a
     per-layer speed scaled by data-parallax (foreground exits fast,
     background slow). Parallax + scroll-out compose cleanly.
   - Idle breathing: subtle continuous float on non-video layers.
   - Masque video: plays once, stops on last frame.
   ============================================================ */

;(function () {
  'use strict';

  var layers     = document.querySelectorAll('.layer');
  var frame      = document.getElementById('frame');
  var loader     = document.getElementById('loader');
  var maskVideo  = document.getElementById('layer-mask-video');
  var maskImg    = document.getElementById('layer-mask-img');
  var nav        = document.querySelector('.nav');
  var stats      = document.querySelector('.stats');
  var scrollHint = document.querySelector('.scroll-hint');
  var heroSection = document.querySelector('.hero-section');

  if (!layers.length || !frame) return;

  // === CONFIG ===
  var MAX_SHIFT     = 25;     // px — parallax max translation
  var IDLE_AMP      = 3;      // px — idle breathing amplitude base
  var IDLE_SPEED    = 0.4;    // base speed multiplier (slow drift)
  var REVEAL_DELAY  = 0;      // ms between each layer reveal (0 = all at once,
                              // avoids the "out-of-order composition" flash
                              // as the loader fades and layers appear staggered)
  var LOADER_MIN_MS = 1800;   // minimum visible time, even if assets load faster
  var BPM_MIN       = 70;
  var BPM_MAX       = 170;
  var BPM_LERP      = 0.08;   // per-frame catch-up factor for displayed BPM
  var LOADER_EXIT_MS = 600;   // matches CSS transition on .loader

  // === STATE ===
  var mouseX   = 0, mouseY   = 0;
  var tiltX    = 0, tiltY    = 0;
  var useGyro  = false;
  var revealed = false;
  var startTime = Date.now();

  // Loader state
  var loaderTitle    = document.getElementById('loader-title');
  var loaderBpmVal   = document.getElementById('loader-bpm-val');
  var loaderBarFill  = document.getElementById('loader-bar-fill');
  var assetsProgress = 0;         // 0..1 actual load progress
  var bpmTarget      = BPM_MIN;   // derived from assetsProgress + minTime
  var bpmDisplayed   = BPM_MIN;   // lerped toward bpmTarget each frame
  var loaderStartTime = performance.now();
  var assetsReady    = false;
  var loaderDone     = false;
  var lastWrittenBpm = -1;       // avoid redundant DOM writes on pulse/bar

  // Scroll-out state
  var scrollOutProgress = 0;  // 0..1 — how far the hero has scrolled out
  var scrollOutPending  = false;

  // ----------------------------------------------------------
  // LOADER — split each word into letters, animate stagger IN
  // ----------------------------------------------------------
  function buildLoaderTitle() {
    if (!loaderTitle) return;
    var words = loaderTitle.querySelectorAll('.loader__word');
    var letterIndex = 0;
    var STAGGER_MS = 60;
    words.forEach(function (wordEl) {
      var text = wordEl.getAttribute('data-word') || wordEl.textContent || '';
      wordEl.textContent = '';
      for (var i = 0; i < text.length; i++) {
        var ch = text.charAt(i);
        var span = document.createElement('span');
        span.className = 'loader__letter';
        // Use non-breaking space so the letter still has width when animating
        span.textContent = ch === ' ' ? '\u00A0' : ch;
        span.style.transitionDelay = (letterIndex * STAGGER_MS) + 'ms';
        wordEl.appendChild(span);
        letterIndex++;
      }
    });
    // Next frame: trigger the IN animation
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        loaderTitle.querySelectorAll('.loader__letter').forEach(function (l) {
          l.classList.add('loader__letter--in');
        });
      });
    });
  }

  // ----------------------------------------------------------
  // LOADER — real asset progress tracker
  // Counts hero images + mask video. Each load/error increments.
  // ----------------------------------------------------------
  function trackAssetProgress() {
    var items = [];
    layers.forEach(function (el) {
      if (el.tagName === 'IMG') items.push(el);
    });
    if (maskVideo) items.push(maskVideo);

    var total = items.length || 1;
    var done  = 0;
    var markDone = function () {
      done++;
      assetsProgress = Math.min(1, done / total);
      if (done >= total) assetsReady = true;
    };

    items.forEach(function (el) {
      if (el.tagName === 'IMG') {
        if (el.complete && el.naturalWidth > 0) { markDone(); return; }
        el.addEventListener('load',  markDone, { once: true });
        el.addEventListener('error', markDone, { once: true });
      } else if (el.tagName === 'VIDEO') {
        if (el.readyState >= 3) { markDone(); return; }
        var onReady = function () { markDone(); };
        el.addEventListener('canplaythrough', onReady, { once: true });
        el.addEventListener('loadeddata',     onReady, { once: true });
        el.addEventListener('error',          onReady, { once: true });
        // Hard ceiling: don't block forever on a slow video
        setTimeout(function () { if (!assetsReady) markDone(); }, 5000);
      }
    });

    // Safety timeout — mark ready after 6s max
    setTimeout(function () { assetsReady = true; assetsProgress = 1; }, 6000);
  }

  // ----------------------------------------------------------
  // LOADER — per-frame tick: update BPM target, lerp display,
  //          write bar width, recompute pulse interval.
  // ----------------------------------------------------------
  function loaderTick() {
    if (loaderDone) return;

    var elapsed = performance.now() - loaderStartTime;
    var timeProgress = Math.min(1, elapsed / LOADER_MIN_MS);

    // Target BPM: the more advanced of (asset progress, time progress).
    // This guarantees that even if assets are cached (instant), the BPM
    // still climbs smoothly to 170 over the minimum 1800ms.
    var combined = Math.max(assetsProgress, timeProgress);
    bpmTarget = BPM_MIN + (BPM_MAX - BPM_MIN) * combined;

    // Smooth catch-up toward target
    bpmDisplayed += (bpmTarget - bpmDisplayed) * BPM_LERP;

    // Write to DOM only when int BPM changes — prevents per-frame layout
    // thrash and avoids restarting the CSS pulse animation every tick.
    var bpmInt = Math.round(bpmDisplayed);
    if (bpmInt !== lastWrittenBpm) {
      lastWrittenBpm = bpmInt;
      if (loaderBpmVal) loaderBpmVal.textContent = bpmInt;
      if (loaderTitle) {
        loaderTitle.style.setProperty('--loader-pulse-dur', (60000 / bpmInt) + 'ms');
      }
    }
    // Bar fill is cheap (single style write, no reflow beyond paint) — update smooth.
    if (loaderBarFill) {
      var pct = ((bpmDisplayed - BPM_MIN) / (BPM_MAX - BPM_MIN)) * 100;
      loaderBarFill.style.width = Math.max(0, Math.min(100, pct)) + '%';
    }

    // Ready to exit? assets loaded AND minimum time elapsed AND BPM effectively at max
    if (assetsReady && elapsed >= LOADER_MIN_MS && bpmDisplayed >= BPM_MAX - 1) {
      loaderDone = true;
      // Short pause pulsing at 170, then exit
      setTimeout(exitLoader, 200);
      return;
    }

    requestAnimationFrame(loaderTick);
  }

  function exitLoader() {
    if (!loader) { reveal(); return; }
    // Start layer reveal DURING loader exit (no dead time)
    reveal();
    loader.classList.add('loader--hidden');
    setTimeout(function () {
      if (loader && loader.parentNode) loader.parentNode.removeChild(loader);
    }, LOADER_EXIT_MS + 100);
  }

  function reveal() {
    if (revealed) return;
    revealed = true;

    // Decide layer 6: video if ready, PNG fallback otherwise
    var videoReady = maskVideo && maskVideo.readyState >= 2;
    if (videoReady) {
      if (maskImg)   maskImg.style.display = 'none';
      if (maskVideo) maskVideo.style.display = 'block';
    } else {
      if (maskVideo) maskVideo.style.display = 'none';
      if (maskImg)   maskImg.style.display = 'block';
    }

    // Filter out the hidden layer from reveal
    var visibleLayers = Array.from(layers).filter(function (el) {
      return el.style.display !== 'none';
    });

    // Sort layers: back (10) to front (1) for staggered reveal
    var sorted = visibleLayers.sort(function (a, b) {
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

    // Play video immediately if ready (not after delay)
    if (videoReady) {
      var layer6Index = sorted.findIndex(function (el) {
        return parseInt(el.dataset.layer) === 6;
      });
      var playDelay = (layer6Index >= 0 ? layer6Index : 0) * REVEAL_DELAY + 200;
      setTimeout(function () {
        maskVideo.play().catch(function () {
          // Autoplay blocked: swap to PNG fallback
          maskVideo.style.display = 'none';
          if (maskImg) {
            maskImg.style.display = 'block';
            maskImg.classList.add('layer--visible');
          }
        });
      }, playDelay);
    }
  }

  // Kick off loader: build letters, track assets, start tick
  buildLoaderTitle();
  trackAssetProgress();
  requestAnimationFrame(loaderTick);

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
  // SCROLL-OUT — detect scroller (frame vs window) + throttle via rAF
  // ----------------------------------------------------------
  // Which element actually scrolls? On the /all preview, `.frame` is
  // overflow-y:auto (desktop portrait frame). Fallback to window.
  var scroller = window;
  if (frame) {
    var fStyle = window.getComputedStyle(frame);
    if (fStyle.overflowY === 'auto' || fStyle.overflowY === 'scroll') {
      scroller = frame;
    }
  }

  function readScrollProgress() {
    scrollOutPending = false;
    if (!heroSection) return;
    var heroH;
    var scrolled;
    if (scroller === window) {
      var rect = heroSection.getBoundingClientRect();
      heroH = rect.height || window.innerHeight;
      scrolled = -rect.top;
    } else {
      heroH = heroSection.offsetHeight || scroller.clientHeight;
      scrolled = scroller.scrollTop;
    }
    var raw = heroH > 0 ? scrolled / heroH : 0;
    scrollOutProgress = Math.max(0, Math.min(1, raw));
  }

  function onScroll() {
    if (scrollOutPending) return;
    scrollOutPending = true;
    requestAnimationFrame(readScrollProgress);
  }

  if (scroller === window) {
    window.addEventListener('scroll', onScroll, { passive: true });
  } else {
    scroller.addEventListener('scroll', onScroll, { passive: true });
  }
  window.addEventListener('resize', onScroll);

  // Exit vector lookup (unit vectors per direction).
  // Distance multiplier = 1.2 × viewport dimension, so layers fully clear.
  var EXIT_VEC = {
    'left':         [-1,  0],
    'right':        [ 1,  0],
    'top':          [ 0, -1],
    'bottom':       [ 0,  1],
    'top-left':     [-0.9, -0.9],
    'top-right':    [ 0.9, -0.9],
    'bottom-left':  [-0.9,  0.9],
    'bottom-right': [ 0.9,  0.9]
  };

  // ----------------------------------------------------------
  // ANIMATION LOOP — parallax + idle breathing + scroll-out
  // ----------------------------------------------------------
  function animate() {
    var nx = useGyro ? tiltX : mouseX;
    var ny = useGyro ? tiltY : mouseY;
    var t  = (Date.now() - startTime) / 1000; // seconds elapsed

    // Eased scroll-out progress: earlier departure, softer end
    var p = scrollOutProgress > 0 ? Math.pow(scrollOutProgress, 0.85) : 0;

    // Viewport size (used for exit distance)
    var vw = window.innerWidth  || document.documentElement.clientWidth  || 360;
    var vh = window.innerHeight || document.documentElement.clientHeight || 640;

    layers.forEach(function (el) {
      var depth    = parseFloat(el.dataset.parallax) || 0;
      var layerNum = parseInt(el.dataset.layer) || 0;
      var isVideo  = el.tagName === 'VIDEO';
      var exitDir  = el.dataset.exit || 'top';

      // --- Parallax shift (mouse or gyro)
      var px = nx * MAX_SHIFT * depth * -1;
      var py = ny * MAX_SHIFT * depth * -1;

      // --- Idle breathing (skip video layer)
      var ix = 0, iy = 0;
      if (!isVideo) {
        var phase = layerNum * 0.7;
        var speed = IDLE_SPEED * (0.6 + depth);
        var amp   = IDLE_AMP * depth;
        ix = Math.sin(t * speed + phase)       * amp;
        iy = Math.cos(t * speed * 0.7 + phase) * amp * 0.6;
      }

      // --- Scroll-out: foreground (high depth) exits fastest.
      // speedFactor scales by depth so layer 1 (1.3) leaves ~2× faster than layer 10 (0.2).
      var speedFactor = 0.55 + depth * 0.75;
      var vec = EXIT_VEC[exitDir] || EXIT_VEC['top'];
      var distX = vec[0] * vw * 1.2;
      var distY = vec[1] * vh * 1.2;
      var sx = distX * p * speedFactor;
      var sy = distY * p * speedFactor;

      // --- Scale + opacity during scroll-out (accent depth)
      var scale = 1 + (0.15 * p * (isVideo ? 0.3 : depth));

      el.style.transform =
        'translate3d(' + (px + ix + sx) + 'px, ' + (py + iy + sy) + 'px, 0) ' +
        'scale(' + scale.toFixed(3) + ')';

      // Only touch opacity when scroll-out is active — otherwise leave it
      // to the CSS reveal transition (.layer--visible). Clearing inline
      // opacity lets CSS take over again once scroll-out returns to 0.
      if (p > 0.001) {
        var opacity = 1 - Math.min(1, p * 1.1) * 0.6; // fades to 0.4 at full scroll
        el.style.opacity = opacity.toFixed(3);
      } else if (el.style.opacity !== '') {
        el.style.opacity = '';
      }
    });

    requestAnimationFrame(animate);
  }

  requestAnimationFrame(animate);

})();
