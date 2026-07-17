/**
 * Symvolia — Cinematic Intro Timeline
 * One continuous breath. Promise phases, transform/opacity only.
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
  const iris = cine.querySelector('.eye__iris');
  const pupil = cine.querySelector('.eye__pupil');
  const ambient = cine.querySelector('.cine__ambient');
  const vignette = cine.querySelector('.cine__vignette');
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
        try { el.style.willChange = 'auto'; } catch (_) { /* */ }
      });
      this._willChange = [];
    },
  };

  function show(el) {
    if (!el) return;
    el.classList.add('is-shown');
    el.style.visibility = 'visible';
  }

  function setOpacityTransform(el, opacity, transform) {
    if (!el) return;
    el.style.opacity = String(opacity);
    if (transform != null) el.style.transform = transform;
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
        window.setTimeout(() => {
          el.style.willChange = 'auto';
          resolve();
        }, duration + 32);
      }, d);
    });
  }

  /* ── Phase 0 — preload ── */
  async function phase0() {
    timeline.currentPhase = 0;
    root.classList.add('is-cine', 'loading');
    body.style.overflow = 'hidden';

    const assets = [
      'assets/logo.png',
      'assets/logo.svg',
      'assets/logo-sigil.png',
    ];
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

    // Wait for full window load (fonts + remaining)
    if (document.readyState !== 'complete') {
      await new Promise((resolve) => window.addEventListener('load', resolve, { once: true }));
    }
    await delay(80);
    root.classList.remove('loading');
    show(cine);
    cine.style.opacity = '1';
    cine.style.visibility = 'visible';
    await delay(420); // remainder of 0–500ms preload feel
  }

  /* ── Phase 1 — eye birth ── */
  async function phase1() {
    timeline.currentPhase = 1;
    show(eye);
    eye.style.opacity = '1';
    eye.style.visibility = 'visible';
    timeline._markWillChange(eye, 'transform, opacity');
    timeline._markWillChange(iris, 'transform, opacity');
    timeline._markWillChange(pupil, 'transform');
    timeline._markWillChange(ambient, 'transform, opacity');

    // Lids open (CSS classes with staggered delay)
    eye.classList.add('is-open');

    // Ambient glow
    if (ambient) {
      ambient.style.transition = 'transform 1200ms var(--ease-organic), opacity 1200ms var(--ease-organic)';
      requestAnimationFrame(() => {
        ambient.style.opacity = '1';
        ambient.style.transform = 'scale(18)';
      });
    }

    // Iris expand — delay 800ms after lids start
    await delay(800);
    if (timeline.skipped) return;
    if (iris) {
      iris.style.transition =
        'transform 1200ms var(--ease-spring), opacity 900ms var(--ease-organic)';
      requestAnimationFrame(() => {
        iris.style.opacity = '1';
        iris.style.transform = 'translate(-50%, -50%) scale(1)';
      });
    }

    // Pupil contracts when iris ~80% (800+960≈1760 from lids; from iris start: 960ms)
    await delay(960);
    if (timeline.skipped) return;
    if (pupil) {
      pupil.style.transition = 'transform 600ms var(--ease-standard), width 600ms var(--ease-standard), height 600ms var(--ease-standard)';
      requestAnimationFrame(() => {
        pupil.style.width = '35%';
        pupil.style.height = '35%';
        pupil.style.transform = 'translate(-50%, -50%) scale(1)';
      });
    }

    // Finish eye-open window (~2800 from load start of phase1; lids 1800 + lead)
    await delay(640);
    if (vignette) {
      show(vignette);
      vignette.style.transition = 'opacity 900ms var(--ease-organic)';
      vignette.style.opacity = '1';
    }
  }

  /* ── Phase 2 — breathing ── */
  function phase2() {
    timeline.currentPhase = 2;
    if (reduced || timeline.skipped) return;
    eye.classList.add('is-breathing', 'is-iris-breathing', 'is-pupil-breathing');
  }

  /* ── Phase 3 — logo & text ── */
  async function phase3() {
    timeline.currentPhase = 3;
    if (timeline.skipped) return;

    const wordmark = cine.querySelector('.cine__wordmark');
    if (wordmark) {
      wordmark.style.letterSpacing = '0.3em';
      wordmark.style.textIndent = '0.3em';
      wordmark.style.transition = 'letter-spacing 900ms var(--ease-organic), text-indent 900ms var(--ease-organic)';
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

  /* ── Phase 4 — enter button ── */
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
    } catch (_) { /* */ }
  }

  async function jumpToPhase4() {
    if (timeline.skipped) return;
    timeline.skipped = true;
    timeline.currentPhase = 4;

    // Snap eye open
    show(eye);
    eye.style.opacity = '1';
    eye.style.visibility = 'visible';
    eye.classList.add('is-open');
    eye.classList.remove('is-closing');
    if (iris) {
      iris.style.transition = 'none';
      iris.style.opacity = '1';
      iris.style.transform = 'translate(-50%, -50%) scale(1)';
    }
    if (pupil) {
      pupil.style.transition = 'none';
      pupil.style.width = '35%';
      pupil.style.height = '35%';
    }
    if (ambient) {
      ambient.style.opacity = '1';
      ambient.style.transform = 'scale(18)';
    }
    if (vignette) {
      show(vignette);
      vignette.style.opacity = '1';
    }

    // Show brand instantly (soft fade 280ms)
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
    eye.classList.add('is-open');
    if (iris) {
      iris.style.opacity = '1';
      iris.style.transform = 'translate(-50%, -50%) scale(1)';
    }
    if (pupil) {
      pupil.style.width = '35%';
      pupil.style.height = '35%';
    }
    [mark, ...letters, tagline, vignette].forEach((el) => {
      if (!el) return;
      show(el);
      el.style.opacity = '1';
      el.style.transform = 'none';
    });
    await phase4();
  }

  /* ── Phase 5 — enter transition ── */
  async function phase5() {
    timeline.currentPhase = 5;
    unlockSkip = false;
    if (enterBtn) enterBtn.disabled = true;

    // Step 1 — button out
    if (enterBtn) {
      enterBtn.classList.remove('is-visible');
      enterBtn.style.transition = 'opacity 150ms ease-in, transform 150ms ease-in';
      enterBtn.style.opacity = '0';
      enterBtn.style.transform = 'translate3d(-50%, 0, 0) scale(0.9)';
    }

    // Step 2 — text reverse stagger
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

    // Step 3 — eye closes + pupil dilates
    await delay(200);
    eye.classList.remove('is-breathing', 'is-iris-breathing', 'is-pupil-breathing', 'is-open');
    eye.classList.add('is-closing');
    if (pupil) {
      pupil.style.transition = 'width 400ms var(--ease-close), height 400ms var(--ease-close), transform 400ms var(--ease-close)';
      pupil.style.width = '70%';
      pupil.style.height = '70%';
    }
    if (ambient) {
      ambient.style.transition = 'opacity 400ms var(--ease-close)';
      ambient.style.opacity = '0';
    }

    // Step 4 — iris wipe
    await delay(300);
    if (wipe) {
      wipe.style.opacity = '1';
      wipe.style.transition = 'transform 600ms var(--ease-standard)';
      requestAnimationFrame(() => {
        wipe.style.transform = 'scale(40)';
      });
    }

    await delay(400);

    // Step 5 — handoff under the wipe
    if (window.Symvolia) {
      if (typeof window.Symvolia.awaken === 'function') {
        window.Symvolia.awaken({ silent: true });
      }
      if (typeof window.Symvolia.enterSite === 'function') {
        window.Symvolia.enterSite('bio');
      }
    }

    root.classList.remove('is-cine', 'is-intro');
    body.style.overflow = '';
    if (cursor) cursor.style.opacity = '0';

    const main = document.getElementById('main');
    if (main) {
      main.classList.add('is-visible');
    }

    await delay(400);
    cine.classList.add('is-done');
    timeline.destroy();
    window.setTimeout(() => {
      if (cine && cine.parentNode) cine.parentNode.removeChild(cine);
    }, 120);
  }

  /* ── Cursor ── */
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

  /* ── Skip ── */
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

  // Noscript-like safety: if something stalls, reveal enter
  window.setTimeout(() => {
    if (timeline.currentPhase < 4 && !timeline.destroyed) jumpToPhase4();
  }, 9000);

  window.SymvoliaCine = timeline;
  timeline.play();
})();
