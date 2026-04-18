/* ============================================================
   DON LOW — Booking section
   Stagger-reveals each .booking__link on viewport intersection
   (90ms between items, 500ms each).

   QR generation was dropped when the section moved to a simple
   two-column typography layout — WhatsApp is now just a regular
   link to the wa.me URL.
   ============================================================ */

;(function () {
  'use strict';

  var section = document.getElementById('booking-section');
  if (!section) return;

  var links = section.querySelectorAll('.booking__link');
  if (!links.length) return;

  function reveal() {
    links.forEach(function (el, i) {
      setTimeout(function () {
        el.classList.add('booking__link--in');
      }, i * 90);
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
    reveal();
  }
})();
