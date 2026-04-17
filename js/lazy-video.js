/* ============================================================
   DON LOW — Lazy video loader
   Preloads + plays any <video data-lazy-video> when it enters the
   viewport (rootMargin 300px — ready before user arrives).
   Pauses when it leaves viewport to save battery / CPU / bandwidth.
   Never swaps the video for an image — the <poster> covers the
   micro-delay before first frame paint.
   ============================================================ */

;(function () {
  'use strict';

  var videos = document.querySelectorAll('video[data-lazy-video]');
  if (!videos.length) return;

  // Observer root: if the frame is the scroll container (frame--scroll),
  // observe relative to it. Otherwise fall back to the viewport (body scroll).
  var frame = document.getElementById('frame');
  var frameIsScroller = false;
  if (frame) {
    var style = window.getComputedStyle(frame);
    if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
      frameIsScroller = true;
    }
  }

  function play(video) {
    try {
      video.muted = true;
      video.setAttribute('muted', '');
      if (video.preload !== 'auto') video.preload = 'auto';
      // Ensure source is loaded (iOS Safari sometimes needs explicit load())
      if (video.readyState === 0) {
        try { video.load(); } catch (e) {}
      }
      var p = video.play();
      if (p && typeof p.catch === 'function') p.catch(function () {});
    } catch (e) {}
  }

  function pause(video) {
    try {
      if (!video.paused) video.pause();
    } catch (e) {}
  }

  if (!('IntersectionObserver' in window)) {
    // Fallback: just load and play all videos immediately
    videos.forEach(play);
    return;
  }

  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) play(entry.target);
      else                      pause(entry.target);
    });
  }, {
    root: frameIsScroller ? frame : null,
    rootMargin: '300px 0px',
    threshold: 0.01
  });

  videos.forEach(function (v) { observer.observe(v); });

  // Re-kick on visibility change (tab refocus) to resume paused videos
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) return;
    videos.forEach(function (v) {
      var rect = v.getBoundingClientRect();
      var viewportH = window.innerHeight || document.documentElement.clientHeight;
      var inView = rect.bottom > -300 && rect.top < viewportH + 300;
      if (inView && v.paused) play(v);
    });
  });
})();
