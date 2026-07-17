/* ══════════════════════════════════════════════════════════════════════
   Symvolia — Design System runtime helpers ("Alchemica Eterea")
   Lightweight, dependency-free. Currently drives the scroll-progress bar.
   ══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var reduceMotion =
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── Scroll progress indicator ──────────────────────────────────── */
  var bar = document.getElementById('scrollProgressBar');
  if (bar) {
    var ticking = false;

    function updateProgress() {
      var doc = document.documentElement;
      var scrollTop = window.pageYOffset || doc.scrollTop || 0;
      var max = (doc.scrollHeight || 0) - window.innerHeight;
      var pct = max > 0 ? Math.min(1, Math.max(0, scrollTop / max)) : 0;
      bar.style.width = (pct * 100).toFixed(2) + '%';
      ticking = false;
    }

    function onScroll() {
      if (!ticking) {
        window.requestAnimationFrame(updateProgress);
        ticking = true;
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    updateProgress();
  }

  /* ── Generic reveal-on-scroll for opt-in elements ([data-ds-reveal]) ─
     The main site already animates its own sections; this only serves
     future elements that opt in via the data attribute. */
  var revealTargets = document.querySelectorAll('[data-ds-reveal]');
  if (revealTargets.length) {
    if (reduceMotion || !('IntersectionObserver' in window)) {
      revealTargets.forEach(function (el) {
        el.classList.add('ds-fade-in-up');
      });
    } else {
      var io = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              var el = entry.target;
              var delay = parseFloat(el.getAttribute('data-ds-delay')) || 0;
              el.style.animationDelay = delay + 's';
              el.classList.add('ds-fade-in-up');
              io.unobserve(el);
            }
          });
        },
        { threshold: 0.15, rootMargin: '0px 0px -10% 0px' }
      );
      revealTargets.forEach(function (el) {
        io.observe(el);
      });
    }
  }
})();
