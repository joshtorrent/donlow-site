/* ============================================================
   DON LOW — Parallax + Gyroscope
   Each layer moves at a different speed based on data-parallax.
   Mouse on desktop, DeviceOrientation on mobile.
   ============================================================ */

;(function () {
  'use strict';

  const layers = document.querySelectorAll('.layer');
  const frame  = document.getElementById('frame');
  if (!layers.length || !frame) return;

  // --- CONFIG ---
  const MAX_SHIFT = 25;  // px — max translation at edges

  // --- STATE ---
  let mouseX = 0;
  let mouseY = 0;
  let tiltX  = 0;   // gyroscope beta mapped to [-1, 1]
  let tiltY  = 0;   // gyroscope gamma mapped to [-1, 1]
  let useGyro = false;
  let rafId   = null;

  // ----------------------------------------------------------
  // MOUSE (desktop)
  // ----------------------------------------------------------
  frame.addEventListener('mousemove', function (e) {
    if (useGyro) return;
    const rect = frame.getBoundingClientRect();
    mouseX = ((e.clientX - rect.left) / rect.width  - 0.5) * 2; // -1 → 1
    mouseY = ((e.clientY - rect.top)  / rect.height - 0.5) * 2;
  });

  // Reset on mouse leave
  frame.addEventListener('mouseleave', function () {
    mouseX = 0;
    mouseY = 0;
  });

  // ----------------------------------------------------------
  // GYROSCOPE (mobile)
  // ----------------------------------------------------------
  function handleOrientation(e) {
    useGyro = true;
    // beta  = front-back tilt (-180 → 180), clamp to ±30
    // gamma = left-right tilt (-90 → 90), clamp to ±30
    const beta  = Math.max(-30, Math.min(30, e.beta  || 0));
    const gamma = Math.max(-30, Math.min(30, e.gamma || 0));
    tiltX = gamma / 30;  // -1 → 1
    tiltY = beta  / 30;
  }

  // Request permission on iOS 13+
  function initGyro() {
    if (typeof DeviceOrientationEvent !== 'undefined' &&
        typeof DeviceOrientationEvent.requestPermission === 'function') {
      DeviceOrientationEvent.requestPermission()
        .then(function (state) {
          if (state === 'granted') {
            window.addEventListener('deviceorientation', handleOrientation);
          }
        })
        .catch(console.warn);
    } else {
      window.addEventListener('deviceorientation', handleOrientation);
    }
  }

  // Auto-init gyro on touch devices
  if ('ontouchstart' in window) {
    // Some browsers need a user gesture first
    document.addEventListener('touchstart', function onTouch() {
      initGyro();
      document.removeEventListener('touchstart', onTouch);
    }, { once: true });
  }

  // ----------------------------------------------------------
  // ANIMATION LOOP
  // ----------------------------------------------------------
  function animate() {
    const nx = useGyro ? tiltX : mouseX;
    const ny = useGyro ? tiltY : mouseY;

    layers.forEach(function (el) {
      const depth = parseFloat(el.dataset.parallax) || 0;
      const dx = nx * MAX_SHIFT * depth * -1;
      const dy = ny * MAX_SHIFT * depth * -1;
      el.style.transform = 'translate3d(' + dx + 'px, ' + dy + 'px, 0)';
    });

    rafId = requestAnimationFrame(animate);
  }

  // Start loop
  rafId = requestAnimationFrame(animate);

  // ----------------------------------------------------------
  // MASK VIDEO SWAP
  // ----------------------------------------------------------
  // If masque-video.mp4 loads successfully, hide the PNG fallback
  var maskVideo = document.getElementById('layer-mask-video');
  var maskImg   = document.getElementById('layer-mask-img');
  if (maskVideo && maskImg) {
    maskVideo.addEventListener('canplaythrough', function () {
      maskImg.style.display   = 'none';
      maskVideo.style.display = 'block';
    }, { once: true });
    // Start trying to load
    maskVideo.load();
  }

})();
