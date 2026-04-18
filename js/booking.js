/* ============================================================
   DON LOW — Booking section
   - Generates the WhatsApp QR in .booking__card--whatsapp once
     the qrcode-generator library has loaded (CDN, deferred).
   - Stagger-reveals each .booking__card on viewport intersection
     (120ms between cards, 600ms per card).
   ============================================================ */

;(function () {
  'use strict';

  var section = document.getElementById('booking-section');
  if (!section) return;

  // ----- WhatsApp QR generation ------------------------------
  var WA_NUMBER = '33603135654';  // +33 6 03 13 56 54 (no spaces, no leading +)
  var WA_MSG    = 'Hi Don Low! I\u2019m reaching out for a booking inquiry.';
  var WA_URL    = 'https://wa.me/' + WA_NUMBER + '?text=' + encodeURIComponent(WA_MSG);

  function makeQR() {
    var target = document.getElementById('booking-qr');
    if (!target) return;
    if (typeof window.qrcode !== 'function') {
      // Library hasn't loaded yet — try again shortly
      setTimeout(makeQR, 120);
      return;
    }
    try {
      // TypeNumber = 0 (auto-fit), error correction level "Q" (25%)
      var qr = window.qrcode(0, 'Q');
      qr.addData(WA_URL);
      qr.make();

      // Render as <img> (data URL, scales cleanly to container)
      // cellSize 6, margin 2 → ~33-41 modules × 6 = ~200-250px base, scaled via CSS
      var img = new Image();
      img.src = qr.createDataURL(6, 2);
      img.alt = 'WhatsApp QR — ' + WA_URL;
      target.innerHTML = '';
      target.appendChild(img);
    } catch (err) {
      console.warn('[booking] QR generation failed', err);
    }
  }

  // Kick off QR generation after load (library is deferred)
  if (document.readyState === 'complete') {
    makeQR();
  } else {
    window.addEventListener('load', makeQR);
  }

  // ----- Stagger reveal of cards -----------------------------
  var cards = section.querySelectorAll('.booking__card');
  if (!cards.length) return;

  function reveal() {
    cards.forEach(function (card, i) {
      setTimeout(function () {
        card.classList.add('booking__card--in');
      }, i * 120);
    });
  }

  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          reveal();
          io.disconnect();
        }
      });
    }, { threshold: 0.2 });
    io.observe(section);
  } else {
    // No IO: just reveal
    reveal();
  }
})();
