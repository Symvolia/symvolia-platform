/**
 * Sound Archive — Dark Sun idle, then the particle-sun film after the click.
 * The archive surfaces over the film; the old camera-pan is not used.
 */
(function () {
  'use strict';

  const root = document.getElementById('darkSun');
  const world = document.getElementById('darkSunWorld');
  const gate = document.getElementById('darkSunGate');
  const video = document.getElementById('archiveFlow');
  const flowLabel = document.getElementById('archiveFlowLabel');

  if (!root || !world || !gate) return;

  const DISC_X = 0.5;
  const DISC_Y = 0.5;
  const DISC_D = 0.111;

  const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let opened = false;
  let resizeTimer = 0;

  function view() {
    return { w: root.clientWidth, h: root.clientHeight };
  }

  function worldSize() {
    return { w: world.offsetWidth, h: world.offsetHeight };
  }

  function sunZoom() {
    const { w } = worldSize();
    const { w: vw, h: vh } = view();
    const discPx = DISC_D * w;
    const target = Math.max(120, Math.min(vw * 0.28, vh * 0.22, 210));
    return Math.max(0.85, Math.min(2.4, target / Math.max(discPx, 1)));
  }

  function cameraTo(nx, ny, zoom, yFrac) {
    const { w, h } = worldSize();
    const { w: vw, h: vh } = view();
    const tx = vw / 2 - nx * w * zoom;
    const ty = vh * yFrac - ny * h * zoom;
    world.style.transform = `translate3d(${tx}px, ${ty}px, 0) scale(${zoom})`;
  }

  function frameSun() {
    cameraTo(DISC_X, DISC_Y, sunZoom(), 0.5);
  }

  function revealArchive() {
    root.classList.add('is-descended');
    document.documentElement.classList.add('is-archive-open');
    document.body.classList.add('is-archive-open');
    if (flowLabel) {
      flowLabel.classList.remove('is-visible');
      flowLabel.hidden = true;
    }
    window.scrollTo(0, 0);
  }

  function openArchive() {
    if (opened) return;
    opened = true;
    root.classList.add('is-flowing');
    gate.setAttribute('aria-expanded', 'true');
    gate.setAttribute('tabindex', '-1');

    if (window.SymvoliaArchiveFlow) {
      window.SymvoliaArchiveFlow.play(video, { onReveal: revealArchive });
      return;
    }

    revealArchive();
  }

  function shouldOpenNow() {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('landed') === '1') return 'landed';
      if (params.get('play') === '1' || params.get('enter') === '1') return 'play';
    } catch (err) { /* ignore */ }
    const hash = window.location.hash;
    if (hash && hash !== '#') return 'landed';
    return '';
  }

  function bind() {
    gate.addEventListener('click', (e) => {
      e.preventDefault();
      openArchive();
    });

    gate.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      openArchive();
    });

    window.addEventListener('resize', () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        if (!opened) frameSun();
      }, 80);
    });
  }

  bind();

  function start() {
    world.style.transition = 'none';
    frameSun();
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        if (!reduced()) world.style.transition = '';

        const mode = shouldOpenNow();
        if (mode === 'landed') {
          opened = true;
          root.classList.add('is-flowing', 'is-descended');
          document.documentElement.classList.add('is-archive-open');
          document.body.classList.add('is-archive-open');
          gate.setAttribute('aria-expanded', 'true');
          gate.setAttribute('tabindex', '-1');
          if (window.SymvoliaArchiveFlow && video && !reduced()) {
            window.SymvoliaArchiveFlow.play(video, {
              revealAt: 0,
              onReveal: revealArchive,
            });
          } else {
            revealArchive();
          }
        } else if (mode === 'play') {
          openArchive();
        }
      });
    });
  }

  const img = world.querySelector('.dark-sun__img');
  if (img && !img.complete) {
    img.addEventListener('load', start, { once: true });
    img.addEventListener('error', start, { once: true });
  } else {
    start();
  }
})();
