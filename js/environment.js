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
  // Returning from the archive page: main.js lands straight in the library,
  // so the opening journey must not run at all.
  const direct = html.classList.contains('is-direct');
  let orchestrated = direct;

  /* ── Cosmic dust ─────────────────────────────────────────────────── */
  function mountCosmicDust() {
    if (reduced) return;

    const wrap = document.createElement('div');
    wrap.className = 'cosmic-dust';
    wrap.setAttribute('aria-hidden', 'true');
    const canvas = document.createElement('canvas');
    wrap.appendChild(canvas);
    document.body.appendChild(wrap);

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let W = 0;
    let H = 0;
    let raf = 0;
    const particles = [];
    const COUNT = Math.min(28, Math.floor((window.innerWidth * window.innerHeight) / 42000));

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
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

    function isDustLive() {
      const stageEl = document.getElementById('stage');
      return !document.hidden
        && document.documentElement.classList.contains('is-home')
        && !document.body.classList.contains('is-entered')
        && !(stageEl && stageEl.classList.contains('is-diving'));
    }

    function stop() {
      if (raf) window.cancelAnimationFrame(raf);
      raf = 0;
      ctx.clearRect(0, 0, W, H);
    }

    function tick() {
      raf = 0;
      if (!isDustLive()) {
        ctx.clearRect(0, 0, W, H);
        return;
      }
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
      raf = window.requestAnimationFrame(tick);
    }

    function start() {
      if (raf || !isDustLive()) return;
      raf = window.requestAnimationFrame(tick);
    }

    function sync() {
      if (isDustLive()) start();
      else stop();
    }

    resize();
    seed();
    window.addEventListener('resize', () => {
      resize();
      seed();
    }, { passive: true });

    document.addEventListener('visibilitychange', sync);

    const mo = new MutationObserver(sync);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    mo.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    const stageEl = document.getElementById('stage');
    if (stageEl) mo.observe(stageEl, { attributes: true, attributeFilter: ['class'] });

    sync();
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
    window.setTimeout(() => sectionVeil.classList.remove('is-on'), 700);
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

  /* ── Boot ────────────────────────────────────────────────────────── */
  mountCosmicDust();
  bindSectionMood();

  window.addEventListener('symvolia:intro-complete', (e) => {
    // Cinematic intro owns Enter → homepage. Do NOT unlock library CTA yet.
    if (e && e.detail && (e.detail.cine || e.detail.portal)) {
      orchestrated = true;
      html.classList.add('is-journey-alive');
      html.classList.remove('is-journey-locked', 'is-journey-cta');
      return;
    }
    beginJourney();
  });

  window.addEventListener('symvolia:home-ready', () => {
    orchestrated = true;
    html.classList.add('is-journey-alive');
    html.classList.remove('is-journey-locked');
    // Library CTA is unlocked by Symvolia.enterHome after settle.
  });

  // If cinematic intro is absent, land on homepage (never library).
  // While is-cine / is-intro, cinematic-intro.js owns ENTER → enterHome.
  if (!direct && !html.classList.contains('is-intro') && !html.classList.contains('is-cine')) {
    window.setTimeout(() => {
      if (window.Symvolia && typeof window.Symvolia.enterHome === 'function') {
        orchestrated = true;
        window.Symvolia.enterHome({ silent: true });
        return;
      }
      beginJourney();
    }, reduced ? 50 : 200);
  }

  // Failsafe: never leave the journey locked — but don't awaken under the cine veil.
  window.setTimeout(() => {
    if (!orchestrated && !html.classList.contains('is-cine') && !html.classList.contains('is-intro')) {
      beginJourney();
    }
    html.classList.remove('is-journey-locked');
  }, 12000);

  window.SymvoliaEnv = {
    pulseSectionVeil,
    setMood,
    beginJourney,
  };
})();
