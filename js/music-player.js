/* ============================================================
   DON LOW — Inline Spotify player modal
   Binds .artwork[data-track-id] buttons to an iframe modal so the
   user never leaves /all to listen.
   ============================================================ */

;(function () {
  'use strict';

  var modal = document.getElementById('player-modal');
  if (!modal) return;
  var closeBtn   = modal.querySelector('.player-modal__close');
  var backdrop   = modal.querySelector('.player-modal__backdrop');
  var box        = modal.querySelector('.player-modal__box');
  var playerWrap = document.getElementById('player-modal-wrap');
  if (!playerWrap || !box) return;

  var tracks = [];
  var tracksReady = false;
  var currentTrack = null;
  var opening = false;  // debounce rapid double-clicks

  fetch('/data/tracks.json', { cache: 'no-cache' })
    .then(function (r) { return r.json(); })
    .then(function (data) {
      tracks = Array.isArray(data) ? data : [];
      tracksReady = true;
    })
    .catch(function (err) {
      console.warn('[music-player] tracks.json load failed:', err);
    });

  function findTrack(id) {
    for (var i = 0; i < tracks.length; i++) {
      if (tracks[i].id === id) return tracks[i];
    }
    return null;
  }

  function renderPlayer() {
    playerWrap.innerHTML = '';
    if (!currentTrack || !currentTrack.spotify) return;
    var kind = currentTrack.spotify.kind;
    var id   = currentTrack.spotify.id;
    if (!kind || !id) return;
    var iframe = document.createElement('iframe');
    iframe.src = 'https://open.spotify.com/embed/' + encodeURIComponent(kind) +
                 '/' + encodeURIComponent(id) +
                 '?utm_source=generator&theme=0';
    iframe.setAttribute('loading', 'lazy');
    iframe.setAttribute(
      'allow',
      'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture'
    );
    iframe.setAttribute('title', currentTrack.title || 'Spotify player');
    iframe.height = 352;
    playerWrap.appendChild(iframe);
  }

  function openModal(track) {
    if (opening) return;
    opening = true;
    setTimeout(function () { opening = false; }, 400);
    currentTrack = track;
    renderPlayer();
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    // Focus the close button for keyboard users
    if (closeBtn) { try { closeBtn.focus({ preventScroll: true }); } catch (e) {} }
  }

  function closeModal() {
    modal.setAttribute('aria-hidden', 'true');
    box.style.transform = '';
    box.style.transition = '';
    setTimeout(function () {
      playerWrap.innerHTML = '';
      currentTrack = null;
    }, 400);
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
  }

  // Card listeners — delegated so new cards (if added dynamically) still work.
  document.addEventListener('click', function (e) {
    var card = e.target.closest && e.target.closest('.artwork[data-track-id]');
    if (!card) return;
    e.preventDefault();
    var id = card.getAttribute('data-track-id');
    if (!tracksReady) {
      console.warn('[music-player] tracks.json not loaded yet');
      return;
    }
    var track = findTrack(id);
    if (!track || !track.spotify || !track.spotify.id) {
      console.warn('[music-player] no Spotify data for track "' + id + '"');
      return;
    }
    openModal(track);
  });

  if (closeBtn)  closeBtn.addEventListener('click', closeModal);
  if (backdrop)  backdrop.addEventListener('click', closeModal);

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && modal.getAttribute('aria-hidden') === 'false') {
      closeModal();
    }
  });

  // Swipe-down to dismiss on mobile — only when the touch starts in the
  // top grabber zone (first 60px). Below that we let the iframe handle touches.
  if (matchMedia('(max-width: 767px)').matches) {
    var touchStartY = 0;
    var touchMoveY  = 0;
    var swipeActive = false;

    box.addEventListener('touchstart', function (e) {
      if (modal.getAttribute('aria-hidden') !== 'false') return;
      var boxTop  = box.getBoundingClientRect().top;
      var touchY  = e.touches[0].clientY;
      if (touchY - boxTop < 60) {
        touchStartY = touchY;
        swipeActive = true;
        box.style.transition = 'none';
      }
    }, { passive: true });

    box.addEventListener('touchmove', function (e) {
      if (!swipeActive) return;
      touchMoveY = e.touches[0].clientY - touchStartY;
      if (touchMoveY > 0) {
        box.style.transform = 'translateY(' + touchMoveY + 'px)';
      }
    }, { passive: true });

    box.addEventListener('touchend', function () {
      if (!swipeActive) return;
      box.style.transition = '';
      if (touchMoveY > 80) {
        closeModal();
      } else {
        box.style.transform = '';
      }
      touchStartY = 0;
      touchMoveY  = 0;
      swipeActive = false;
    });
  }
})();
