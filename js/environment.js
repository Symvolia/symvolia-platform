/* ══════════════════════════════════════════════════════════════════════
   Symvolia — Living Environment Orchestrator
   Opens the site as one cosmic continuum: eye → veil → ouroboros → CTA → dive.
   Works with main.js via window.Symvolia and custom events from intro-eye.js.
   ══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const reduced =
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Fallback offsets when portal does not run (reduced / error). Portal owns the 8–10s film. */
  const AFTER = {
    awaken: reduced ? 0 : 200,
    tagline: reduced ? 100 : 400,
    cta: reduced ? 400 : 900,
    unlock: reduced ? 400 : 900,
  };

  const html = document.documentElement;
  let orchestrated = false;

  /* ── Cosmic dust ─────────────────────────────────────────────────── */
  function mountCosmicDust() {
    if (reduced) return;

    const wrap = document.createElement('div');
    wrap.className = 'cosmic-dust';
    wrap.setAttribute('aria-hidden', 'true');
    const canvas = document.createElement('canvas');
    wrap.appendChild(canvas);
    document.body.appendChild(wrap);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let W = 0;
    let H = 0;
    let raf = 0;
    const particles = [];
    const COUNT = Math.min(48, Math.floor((window.innerWidth * window.innerHeight) / 28000));

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function seed() {
      particles.length = 0;
      for (let i = 0; i < COUNT; i += 1) {
        particles.push({
          x: Math.random() * W,
          y: Math.random() * H,
          r: 0.4 + Math.random() * 1.4,
          a: 0.04 + Math.random() * 0.14,
          vx: (Math.random() - 0.5) * 0.08,
          vy: -0.02 - Math.random() * 0.06,
          hue: Math.random() < 0.35 ? 'violet' : 'blue',
        });
      }
    }

    function tick() {
      ctx.clearRect(0, 0, W, H);
      for (let i = 0; i < particles.length; i += 1) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        if (p.y < -4) p.y = H + 4;
        if (p.x < -4) p.x = W + 4;
        if (p.x > W + 4) p.x = -4;
        ctx.beginPath();
        ctx.fillStyle =
          p.hue === 'violet'
            ? `rgba(120, 70, 160, ${p.a})`
            : `rgba(90, 120, 180, ${p.a})`;
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(tick);
    }

    resize();
    seed();
    window.addEventListener('resize', () => {
      resize();
      seed();
    }, { passive: true });
    raf = requestAnimationFrame(tick);

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        cancelAnimationFrame(raf);
      } else {
        raf = requestAnimationFrame(tick);
      }
    });
  }

  /* ── Soft section veil ───────────────────────────────────────────── */
  function mountSectionVeil() {
    const veil = document.createElement('div');
    veil.className = 'section-veil';
    veil.setAttribute('aria-hidden', 'true');
    document.body.appendChild(veil);
    return veil;
  }

  const sectionVeil = mountSectionVeil();

  function pulseSectionVeil() {
    if (reduced) return;
    sectionVeil.classList.add('is-on');
    window.setTimeout(() => sectionVeil.classList.remove('is-on'), 480);
  }

  /* ── Opening orchestration ───────────────────────────────────────── */
  function beginJourney() {
    if (orchestrated) return;
    orchestrated = true;

    html.classList.add('is-journey-locked');

    window.setTimeout(() => {
      if (window.Symvolia && typeof window.Symvolia.awaken === 'function') {
        window.Symvolia.awaken({ silent: true });
      }
    }, AFTER.awaken);

    window.setTimeout(() => {
      html.classList.add('is-journey-alive');
    }, AFTER.tagline);

    window.setTimeout(() => {
      html.classList.add('is-journey-cta');
      if (window.Symvolia && typeof window.Symvolia.showEnterCta === 'function') {
        window.Symvolia.showEnterCta();
      }
      html.classList.remove('is-journey-locked');
    }, AFTER.cta);

    window.setTimeout(() => {
      html.classList.remove('is-journey-locked');
    }, AFTER.unlock);
  }

  /* ── Section mood + audio continuity ─────────────────────────────── */
  const MOOD_VOLUMES = {
    bio: 0.7,
    vision: 0.65,
    archive: 0.55,
    contact: 0.6,
  };

  function setMood(id) {
    const mood = MOOD_VOLUMES[id] ? id : 'bio';
    document.body.setAttribute('data-mood', mood);

    if (window.Symvolia && typeof window.Symvolia.setAmbientLevel === 'function') {
      window.Symvolia.setAmbientLevel(MOOD_VOLUMES[mood]);
    }
  }

  function bindSectionMood() {
    const sections = ['bio', 'vision', 'archive', 'contact']
      .map((id) => document.getElementById(id))
      .filter(Boolean);

    if (!sections.length) return;

    if (!('IntersectionObserver' in window) || reduced) {
      setMood('bio');
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0] && visible[0].target.id) {
          setMood(visible[0].target.id);
        }
      },
      { threshold: [0.25, 0.45, 0.6], rootMargin: '-15% 0px -35% 0px' }
    );

    sections.forEach((el) => io.observe(el));
  }

  /* ── Wire nav clicks to soft veil ────────────────────────────────── */
  function bindNavVeil() {
    document.addEventListener(
      'click',
      (e) => {
        const a = e.target.closest && e.target.closest('.main__nav a[href^="#"]');
        if (!a) return;
        pulseSectionVeil();
      },
      true
    );
  }

  /* ── Boot ────────────────────────────────────────────────────────── */
  mountCosmicDust();
  bindSectionMood();
  bindNavVeil();

  window.addEventListener('symvolia:intro-complete', (e) => {
    // Portal already ran awaken / tagline / CTA — only unlock + mark done.
    if (e && e.detail && e.detail.portal) {
      orchestrated = true;
      html.classList.add('is-journey-alive', 'is-journey-cta');
      html.classList.remove('is-journey-locked', 'is-intro');
      return;
    }
    beginJourney();
  });

  // If intro was skipped / reduced / already gone when we load.
  if (!html.classList.contains('is-intro') || reduced) {
    window.setTimeout(beginJourney, reduced ? 50 : 200);
  }

  // Failsafe: never leave the journey locked (portal ≈ 9.6s).
  window.setTimeout(() => {
    if (!orchestrated) beginJourney();
    html.classList.remove('is-journey-locked');
  }, 14000);

  window.SymvoliaEnv = {
    pulseSectionVeil,
    setMood,
    beginJourney,
  };
})();
