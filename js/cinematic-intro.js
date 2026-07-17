/**
 * Symvolia — Cinematic Eye Opening
 * Requiem-weight lids · amber–olive iris · canvas grain
 * ENTER → homepage (sigil), never library
 */
(function () {
  'use strict';

  const delay = (ms) => new Promise((r) => window.setTimeout(r, ms));

  const reduced =
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const root = document.documentElement;
  const body = document.body;
  const cine = document.getElementById('cineIntro');
  if (!cine) return;

  const eye = document.getElementById('cineEye');
  const pupil = document.getElementById('cinePupil');
  const pupilDepth = cine.querySelector('.pupil-depth');
  const vignette = cine.querySelector('.cine__vignette');
  const noiseCanvas = document.getElementById('eyeNoise');
  const mark = cine.querySelector('.cine__mark');
  const letters = Array.from(cine.querySelectorAll('.cine__letter'));
  const tagline = cine.querySelector('.cine__tagline');
  const enterBtn = document.getElementById('cineEnter');
  const wipe = document.getElementById('cineWipe');
  const cursor = document.getElementById('cineCursor');

  const timeline = {
    phases: [],
    currentPhase: 0,
    playing: false,
    skipped: false,
    destroyed: false,
    _willChange: [],
    _noiseRaf: 0,

    play() {
      if (this.playing || this.destroyed) return this._run();
      this.playing = true;
      return this._run();
    },

    pause() {
      this.playing = false;
    },

    destroy() {
      this.destroyed = true;
      this.playing = false;
      if (this._noiseRaf) cancelAnimationFrame(this._noiseRaf);
      this._clearWillChange();
      cleanup();
    },

    async _run() {
      try {
        await phase0();
        if (this.destroyed) return;
        if (reduced) {
          await reducedPath();
          return;
        }
        await phase1();
        if (this.skipped || this.destroyed) return;
        phase2();
        await phase3();
        if (this.skipped || this.destroyed) return;
        await phase4();
      } catch (err) {
        console.error('[SymvoliaCine]', err);
        await jumpToPhase4();
      }
    },

    _markWillChange(el, props) {
      if (!el) return;
      el.style.willChange = props;
      this._willChange.push(el);
    },

    _clearWillChange() {
      this._willChange.forEach((el) => {
        try {
          el.style.willChange = 'auto';
        } catch (_) {
          /* */
        }
      });
      this._willChange = [];
    },
  };

  function show(el) {
    if (!el) return;
    el.classList.add('is-shown');
    el.style.visibility = 'visible';
  }

  function animateTo(el, { opacity, transform, duration, easing, delayMs }) {
    return new Promise((resolve) => {
      if (!el) return resolve();
      show(el);
      timeline._markWillChange(el, 'transform, opacity');
      const d = delayMs || 0;
      window.setTimeout(() => {
        el.style.transition = `opacity ${duration}ms ${easing}, transform ${duration}ms ${easing}`;
        requestAnimationFrame(() => {
          if (opacity != null) el.style.opacity = String(opacity);
          if (transform != null) el.style.transform = transform;
        });
        window.setTimeout(() => resolve(), duration + 32);
      }, d);
    });
  }

  /* ── Film grain (canvas) ── */
  function initNoise() {
    if (!noiseCanvas || reduced) return;
    const ctx = noiseCanvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let w = 0;
    let h = 0;
    let frame = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      w = Math.ceil(window.innerWidth / 2);
      h = Math.ceil(window.innerHeight / 2);
      noiseCanvas.width = w;
      noiseCanvas.height = h;
      noiseCanvas.style.width = '100%';
      noiseCanvas.style.height = '100%';
      void dpr;
    };

    resize();
    window.addEventListener('resize', resize, { passive: true });

    const tick = () => {
      if (timeline.destroyed) return;
      frame += 1;
      // Update every 3rd frame — organic flicker, cheaper
      if (frame % 3 === 0) {
        const img = ctx.createImageData(w, h);
        const data = img.data;
        for (let i = 0; i < data.length; i += 4) {
          const v = (Math.random() * 255) | 0;
          data[i] = v;
          data[i + 1] = v;
          data[i + 2] = v;
          data[i + 3] = 28 + ((Math.random() * 20) | 0);
        }
        ctx.putImageData(img, 0, 0);
      }
      timeline._noiseRaf = requestAnimationFrame(tick);
    };

    timeline._noiseRaf = requestAnimationFrame(tick);
  }

  /* ── Phase 0 — preload ── */
  async function phase0() {
    timeline.currentPhase = 0;
    root.classList.add('is-cine', 'loading');
    body.style.overflow = 'hidden';

    const assets = ['assets/logo.png', 'assets/logo.svg', 'assets/logo-sigil.png'];
    await Promise.all(
      assets.map(
        (src) =>
          new Promise((resolve) => {
            const img = new Image();
            img.onload = img.onerror = () => resolve();
            img.src = src;
          })
      )
    );

    if (document.readyState !== 'complete') {
      await new Promise((resolve) => window.addEventListener('load', resolve, { once: true }));
    }
    await delay(80);
    root.classList.remove('loading');
    show(cine);
    cine.style.opacity = '1';
    cine.style.visibility = 'visible';
    initNoise();
    await delay(480);
  }

  /* ── Phase 1 — eye birth (Requiem) ── */
  async function phase1() {
    timeline.currentPhase = 1;
    show(eye);
    eye.style.opacity = '1';
    eye.style.visibility = 'visible';
    timeline._markWillChange(eye, 'opacity');

    // Darkness first — lids still shut, iris barely there
    await delay(200);

    // Lids part with mass; iris brightens in parallel
    eye.classList.add('is-open');

    // Pupil still dilated while lids open
    await delay(1100);
    if (timeline.skipped) return;

    // Light hits — pupil contracts
    eye.classList.add('is-pupil-ready');

    await delay(1000);
    if (timeline.skipped) return;

    if (vignette) {
      show(vignette);
      vignette.style.transition = 'opacity 1100ms var(--ease-organic)';
      vignette.style.opacity = '1';
    }

    // Hold on the open eye
    await delay(400);
  }

  /* ── Phase 2 — living breath ── */
  function phase2() {
    timeline.currentPhase = 2;
    if (reduced || timeline.skipped) return;
    eye.classList.add('is-breathing', 'is-iris-breathing', 'is-pupil-breathing');
  }

  /* ── Phase 3 — brand ── */
  async function phase3() {
    timeline.currentPhase = 3;
    if (timeline.skipped) return;

    const wordmark = cine.querySelector('.cine__wordmark');
    if (wordmark) {
      wordmark.style.letterSpacing = '0.3em';
      wordmark.style.textIndent = '0.3em';
      wordmark.style.transition =
        'letter-spacing 900ms var(--ease-organic), text-indent 900ms var(--ease-organic)';
      requestAnimationFrame(() => {
        wordmark.style.letterSpacing = '0.42em';
        wordmark.style.textIndent = '0.42em';
      });
    }

    await animateTo(mark, {
      opacity: 1,
      transform: 'translate3d(0, 0, 0)',
      duration: 900,
      easing: 'var(--ease-organic)',
      delayMs: 0,
    });
    if (timeline.skipped) return;

    const letterTasks = letters.map((letter, i) =>
      animateTo(letter, {
        opacity: 1,
        transform: 'translate3d(0, 0, 0)',
        duration: 700,
        easing: 'var(--ease-organic)',
        delayMs: 600 + i * 60,
      })
    );
    await Promise.all(letterTasks);
    if (timeline.skipped) return;

    await animateTo(tagline, {
      opacity: 1,
      transform: 'translate3d(0, 0, 0)',
      duration: 800,
      easing: 'var(--ease-organic)',
      delayMs: 100,
    });
  }

  /* ── Phase 4 — enter ── */
  let phase4Done = false;

  async function phase4() {
    if (phase4Done) return;
    phase4Done = true;
    timeline.currentPhase = 4;
    unlockSkip = false;
    if (!enterBtn) return;

    show(enterBtn);
    timeline._markWillChange(enterBtn, 'transform, opacity');
    enterBtn.style.transition =
      'opacity 700ms var(--ease-micro-spring), transform 700ms var(--ease-micro-spring)';
    requestAnimationFrame(() => {
      enterBtn.style.opacity = '1';
      enterBtn.style.transform = 'translate3d(-50%, 0, 0) scale(1)';
    });
    await delay(700);
    enterBtn.classList.add('is-visible');
    enterBtn.style.willChange = 'auto';

    try {
      window.dispatchEvent(new CustomEvent('symvolia:intro-complete', { detail: { cine: true } }));
    } catch (_) {
      /* */
    }
  }

  async function jumpToPhase4() {
    if (timeline.skipped) return;
    timeline.skipped = true;
    timeline.currentPhase = 4;

    show(eye);
    eye.style.opacity = '1';
    eye.style.visibility = 'visible';
    eye.classList.add('is-open', 'is-pupil-ready');
    eye.classList.remove('is-closing');

    if (vignette) {
      show(vignette);
      vignette.style.opacity = '1';
    }

    [mark, ...letters, tagline].forEach((el) => {
      if (!el) return;
      show(el);
      el.style.transition = 'opacity 280ms var(--ease-organic), transform 280ms var(--ease-organic)';
      el.style.opacity = '1';
      el.style.transform = 'translate3d(0, 0, 0)';
    });

    phase2();
    await delay(200);
    await phase4();
  }

  async function reducedPath() {
    cine.classList.add('cine--static');
    show(eye);
    eye.style.opacity = '1';
    eye.classList.add('is-open', 'is-pupil-ready');
    [mark, ...letters, tagline, vignette].forEach((el) => {
      if (!el) return;
      show(el);
      el.style.opacity = '1';
      el.style.transform = 'none';
    });
    await phase4();
  }

  /* ── Phase 5 — ENTER → homepage ── */
  async function phase5() {
    timeline.currentPhase = 5;
    unlockSkip = false;
    if (enterBtn) enterBtn.disabled = true;

    if (enterBtn) {
      enterBtn.classList.remove('is-visible');
      enterBtn.style.transition = 'opacity 150ms ease-in, transform 150ms ease-in';
      enterBtn.style.opacity = '0';
      enterBtn.style.transform = 'translate3d(-50%, 0, 0) scale(0.9)';
    }

    const textOut = async (el, wait) => {
      if (!el) return;
      await delay(wait);
      el.style.transition = 'opacity 300ms ease-in, transform 300ms ease-in';
      el.style.opacity = '0';
      el.style.transform = 'translate3d(0, -8px, 0)';
    };
    textOut(tagline, 0);
    const rev = letters.slice().reverse();
    rev.forEach((letter, i) => textOut(letter, 40 + i * 40));
    textOut(mark, 40 + rev.length * 40);

    await delay(200);
    eye.classList.remove('is-breathing', 'is-iris-breathing', 'is-pupil-breathing', 'is-open', 'is-pupil-ready');
    eye.classList.add('is-closing');

    await delay(320);
    if (wipe) {
      wipe.style.opacity = '1';
      wipe.style.transition = 'transform 600ms var(--ease-standard)';
      requestAnimationFrame(() => {
        wipe.style.transform = 'scale(40)';
      });
    }

    await delay(400);

    const stage = document.getElementById('stage');
    const main = document.getElementById('main');

    if (main) {
      main.hidden = true;
      main.classList.remove('is-visible');
    }
    if (stage) {
      stage.hidden = false;
      stage.removeAttribute('aria-hidden');
      stage.classList.remove('is-diving', 'is-leaving');
    }

    window.scrollTo(0, 0);
    try {
      if (history.replaceState) history.replaceState(null, '', '#home');
    } catch (_) {
      /* */
    }

    root.classList.remove('is-cine', 'is-intro');
    root.classList.add('is-home', 'is-journey-alive', 'is-journey-cta');
    body.style.overflow = '';
    body.classList.remove('is-entered');
    if (cursor) cursor.style.opacity = '0';

    if (window.Symvolia) {
      if (typeof window.Symvolia.awaken === 'function') {
        window.Symvolia.awaken({ silent: true });
      }
      if (typeof window.Symvolia.showEnterCta === 'function') {
        window.Symvolia.showEnterCta();
      }
      if (typeof window.Symvolia.startStageAmbient === 'function') {
        window.Symvolia.startStageAmbient();
      }
    }

    if (stage) {
      stage.classList.add('stage--home-enter');
      requestAnimationFrame(() => {
        stage.classList.add('stage--home-visible');
      });
    }

    try {
      window.dispatchEvent(new CustomEvent('symvolia:home-ready'));
    } catch (_) {
      /* */
    }

    await delay(500);
    cine.classList.add('is-done');
    timeline.destroy();
    window.setTimeout(() => {
      if (cine && cine.parentNode) cine.parentNode.removeChild(cine);
    }, 200);
  }

  function bindCursor() {
    if (!cursor || reduced) return;
    if (window.matchMedia('(pointer: coarse)').matches) return;
    cursor.style.opacity = '1';
    const move = (e) => {
      cursor.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
    };
    window.addEventListener('pointermove', move, { passive: true });
    timeline._cursorMove = move;
  }

  let unlockSkip = true;

  function onSkipKey(e) {
    if (!unlockSkip || timeline.skipped || timeline.currentPhase >= 4) return;
    if (e.code === 'Space' || e.key === ' ') {
      e.preventDefault();
      jumpToPhase4();
    }
  }

  function onSkipClick(e) {
    if (!unlockSkip || timeline.skipped || timeline.currentPhase >= 4) return;
    if (e.target && e.target.closest && e.target.closest('#cineEnter')) return;
    jumpToPhase4();
  }

  function cleanup() {
    document.removeEventListener('keydown', onSkipKey, true);
    cine.removeEventListener('click', onSkipClick);
    if (timeline._cursorMove) {
      window.removeEventListener('pointermove', timeline._cursorMove);
    }
    timeline._clearWillChange();
  }

  if (enterBtn) {
    enterBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (timeline.currentPhase < 4) return;
      phase5();
    });
  }

  document.addEventListener('keydown', onSkipKey, true);
  cine.addEventListener('click', onSkipClick);
  bindCursor();

  window.setTimeout(() => {
    if (timeline.currentPhase < 4 && !timeline.destroyed) jumpToPhase4();
  }, 9000);

  // silence unused refs (kept for future pupil r tweaks)
  void pupil;
  void pupilDepth;

  window.SymvoliaCine = timeline;
  timeline.play();
})();
