/* ============================================================
   DON LOW — /support page
   Fetch clips.json, render Netflix-style card grid, open the
   full-video fullscreen modal on click. Plain vanilla.
   ============================================================ */

;(function () {
  'use strict';

  var grid       = document.getElementById('support-grid');
  var modal      = document.getElementById('support-modal');
  var player     = document.getElementById('support-modal-player');
  var modalDj    = document.getElementById('support-modal-dj');
  var modalVenue = document.getElementById('support-modal-venue');
  var closeBtn   = modal && modal.querySelector('.support-page__modal-close');
  var backdrop   = modal && modal.querySelector('.support-page__modal-backdrop');

  if (!grid || !modal || !player) return;

  var PLAY_SVG =
    '<svg viewBox="0 0 24 24" aria-hidden="true">' +
      '<path d="M8 5v14l11-7z"/>' +
    '</svg>';

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function renderGrid(clips) {
    var frag = document.createDocumentFragment();
    clips.forEach(function (clip) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'support-card';
      btn.setAttribute('data-clip-id', clip.id);
      btn.setAttribute('aria-label',
        (clip.dj || 'Clip') + ' — ' + (clip.venue || '') + ' — play video');

      var img = document.createElement('img');
      img.className = 'support-card__thumb';
      img.loading   = 'lazy';
      img.decoding  = 'async';
      img.alt       = '';
      img.src       = clip.thumbnail;
      img.addEventListener('error', function () {
        btn.classList.add('support-card--missing');
      });
      btn.appendChild(img);

      var caption = document.createElement('div');
      caption.className = 'support-card__caption';
      caption.innerHTML =
        '<p class="support-card__dj">'    + escapeHtml(clip.dj)    + '</p>' +
        '<p class="support-card__venue">' + escapeHtml(clip.venue) + '</p>';
      btn.appendChild(caption);

      var play = document.createElement('div');
      play.className = 'support-card__play';
      play.innerHTML = PLAY_SVG;
      btn.appendChild(play);

      btn.addEventListener('click', function () { openModal(clip); });

      frag.appendChild(btn);
    });
    grid.innerHTML = '';
    grid.appendChild(frag);
  }

  function openModal(clip) {
    if (!clip || !clip.video) return;
    modalDj.textContent    = clip.dj    || '';
    modalVenue.textContent = clip.venue || '';

    // Load video (preload was "none" until now)
    player.preload = 'auto';
    player.src = clip.video;
    try { player.load(); } catch (_) {}

    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    // Try autoplay (muted fallback if the browser blocks)
    var tryPlay = player.play();
    if (tryPlay && typeof tryPlay.catch === 'function') {
      tryPlay.catch(function () {
        player.muted = true;
        player.play().catch(function () { /* leave user to press play */ });
      });
    }
  }

  function closeModal() {
    modal.setAttribute('aria-hidden', 'true');
    try { player.pause(); } catch (_) {}
    // Free memory
    player.removeAttribute('src');
    try { player.load(); } catch (_) {}
    player.muted = false;
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
  }

  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (backdrop) backdrop.addEventListener('click', closeModal);

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && modal.getAttribute('aria-hidden') === 'false') {
      closeModal();
    }
  });

  // Swipe-down to dismiss on touch devices
  var touchStartY = 0, touchMoveY = 0, swiping = false;
  modal.addEventListener('touchstart', function (e) {
    if (modal.getAttribute('aria-hidden') !== 'false') return;
    touchStartY = e.touches[0].clientY;
    swiping = true;
  }, { passive: true });
  modal.addEventListener('touchmove', function (e) {
    if (!swiping) return;
    touchMoveY = e.touches[0].clientY - touchStartY;
  }, { passive: true });
  modal.addEventListener('touchend', function () {
    if (swiping && touchMoveY > 80) closeModal();
    swiping = false;
    touchStartY = 0;
    touchMoveY = 0;
  });

  fetch('/data/clips.json', { cache: 'no-cache' })
    .then(function (r) {
      if (!r.ok) throw new Error('clips.json HTTP ' + r.status);
      return r.json();
    })
    .then(function (clips) {
      if (!Array.isArray(clips) || !clips.length) {
        grid.innerHTML = '<p style="color:#999;padding:40px 0;text-align:center;">No clips available yet.</p>';
        return;
      }
      renderGrid(clips);
    })
    .catch(function (err) {
      console.warn('[support-page] clips.json load failed:', err);
      grid.innerHTML = '<p style="color:#A83030;padding:40px 0;text-align:center;">Could not load clips.</p>';
    });
})();
