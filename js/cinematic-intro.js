/**
 * Symvolia — Cinematic Eye Opening
 * One continuous breath → ENTER → homepage
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

  // Direct entry (returning from the archive page): the film has no business here.
  if (root.classList.contains('is-direct')) {
    if (cine.parentNode) cine.parentNode.removeChild(cine);
    root.classList.remove('loading');
    return;
  }

  const eye = document.getElementById('cineEye');
  const vignette = cine.querySelector('.cine__vignette');
  const noiseCanvas = document.getElementById('eyeNoise');
  const mark = cine.querySelector('.cine__mark');
  void mark; // kept in DOM, hidden — homepage seal is the pupil
  const letters = Array.from(cine.querySelectorAll('.cine__letter'));
  const tagline = cine.querySelector('.cine__tagline');
  const enterBtn = document.getElementById('cineEnter');
  const wipe = document.getElementById('cineWipe');
  const cursor = document.getElementById('cineCursor');

  let entered = false;
  let unlockSkip = false;

  const timeline = {
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
        await phaseFlow();
        if (this.skipped || this.destroyed) return;
        await phaseEnterReady();
      } catch (err) {
        console.error('[SymvoliaCine]', err);
        await jumpToReady();
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
        window.setTimeout(() => resolve(), duration + 40);
      }, d);
    });
  }

  function initNoise() {
    if (!noiseCanvas || reduced) return;
    const ctx = noiseCanvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let w = 0;
    let h = 0;
    let frame = 0;

    const resize = () => {
      w = Math.max(1, Math.ceil(window.innerWidth / 2.5));
      h = Math.max(1, Math.ceil(window.innerHeight / 2.5));
      noiseCanvas.width = w;
      noiseCanvas.height = h;
      noiseCanvas.style.width = '100%';
      noiseCanvas.style.height = '100%';
    };

    resize();
    window.addEventListener('resize', resize, { passive: true });

    const tick = () => {
      if (timeline.destroyed) return;
      frame += 1;
      if (frame % 4 === 0) {
        const img = ctx.createImageData(w, h);
        const data = img.data;
        for (let i = 0; i < data.length; i += 4) {
          const v = (Math.random() * 255) | 0;
          data[i] = v;
          data[i + 1] = v;
          data[i + 2] = v;
          data[i + 3] = 22 + ((Math.random() * 18) | 0);
        }
        ctx.putImageData(img, 0, 0);
      }
      timeline._noiseRaf = requestAnimationFrame(tick);
    };

    timeline._noiseRaf = requestAnimationFrame(tick);
  }

  /* ── Phase 0 — preload into void ── */
  async function phase0() {
    timeline.currentPhase = 0;
    root.classList.add('is-cine', 'loading');
    body.style.overflow = 'hidden';

    await Promise.all(
      ['assets/logo.png', 'assets/logo.svg', 'assets/logo-sigil.png', 'assets/logo-seal.png'].map(
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

    await delay(60);
    root.classList.remove('loading');
    show(cine);
    cine.classList.add('is-shown');
    initNoise();
    await delay(520);
  }

  /**
   * Continuous eye birth — one fluid arc, no hard cuts.
   * Lids + iris + pupil + grain + vignette + settle overlap.
   */
  async function phaseFlow() {
    timeline.currentPhase = 1;
    unlockSkip = true;

    show(eye);
    await delay(180);
    if (timeline.skipped) return;

    // Lids part — reveal the painted eye
    eye.classList.add('is-open');
    cine.classList.add('is-grain');

    // After lids open: seal fades from pupil center
    await delay(2000);
    if (timeline.skipped) return;
    eye.classList.add('is-seal');

    // Soft vignette as world settles into view
    await delay(900);
    if (timeline.skipped) return;
    if (vignette) {
      show(vignette);
      vignette.classList.add('is-shown');
    }

    // Hold on the open eye + seal
    await delay(800);
    if (timeline.skipped) return;

    // Pull back — make space for the word
    eye.classList.add('is-settled', 'is-breathing');
    timeline.currentPhase = 2;

    await delay(900);
    if (timeline.skipped) return;

    // Brand rises into the cleared space (wordmark under centered pupil)
    timeline.currentPhase = 3;
    cine.classList.add('is-brand');

    await Promise.all(
      letters.map((letter, i) =>
        animateTo(letter, {
          opacity: 1,
          transform: 'translate3d(0, 0, 0)',
          duration: 680,
          easing: 'var(--ease-soft)',
          delayMs: 80 + i * 55,
        })
      )
    );
    if (timeline.skipped) return;

    await animateTo(tagline, {
      opacity: 1,
      transform: 'translate3d(0, 0, 0)',
      duration: 780,
      easing: 'var(--ease-soft)',
      delayMs: 60,
    });
  }

  async function phaseEnterReady() {
    if (timeline.currentPhase >= 4 && enterBtn && enterBtn.classList.contains('is-visible')) {
      return;
    }
    timeline.currentPhase = 4;
    unlockSkip = false;
    if (!enterBtn) return;

    show(enterBtn);
    requestAnimationFrame(() => {
      enterBtn.classList.add('is-visible');
    });
    await delay(820);

    try {
      window.dispatchEvent(new CustomEvent('symvolia:intro-complete', { detail: { cine: true } }));
    } catch (_) {
      /* */
    }
  }

  async function jumpToReady() {
    if (timeline.skipped) return;
    timeline.skipped = true;
    unlockSkip = false;

    show(eye);
    eye.classList.add('is-open', 'is-seal', 'is-settled', 'is-breathing');
    cine.classList.add('is-grain', 'is-brand', 'is-shown');
    if (vignette) {
      show(vignette);
      vignette.classList.add('is-shown');
    }

    [...letters, tagline].forEach((el) => {
      if (!el) return;
      show(el);
      el.style.transition = 'opacity 320ms var(--ease-soft), transform 320ms var(--ease-soft)';
      el.style.opacity = '1';
      el.style.transform = 'translate3d(0, 0, 0)';
    });

    await delay(280);
    await phaseEnterReady();
  }

  async function reducedPath() {
    cine.classList.add('cine--static', 'is-shown', 'is-brand', 'is-grain');
    show(eye);
    eye.classList.add('is-open', 'is-seal', 'is-settled');
    if (vignette) {
      show(vignette);
      vignette.classList.add('is-shown');
    }
    [...letters, tagline].forEach((el) => {
      if (!el) return;
      show(el);
      el.style.opacity = '1';
      el.style.transform = 'none';
    });
    await phaseEnterReady();
  }

  /* ── ENTER → homepage (seamless void match) ── */
  async function phase5() {
    if (entered || timeline.currentPhase < 4) return;
    entered = true;
    timeline.currentPhase = 5;
    unlockSkip = false;
    if (enterBtn) enterBtn.disabled = true;

    if (enterBtn) {
      enterBtn.classList.remove('is-visible');
      enterBtn.style.transition = 'opacity 220ms var(--ease-close), transform 220ms var(--ease-close)';
      enterBtn.style.opacity = '0';
      enterBtn.style.transform = 'translate3d(-50%, 8px, 0) scale(0.94)';
    }

    cine.classList.remove('is-brand');

    const fadeOut = (el, wait, y) => {
      if (!el) return;
      window.setTimeout(() => {
        el.style.transition = 'opacity 380ms var(--ease-close), transform 380ms var(--ease-close)';
        el.style.opacity = '0';
        el.style.transform = `translate3d(0, ${y || -10}px, 0)`;
      }, wait);
    };
    fadeOut(tagline, 0, -6);
    letters
      .slice()
      .reverse()
      .forEach((letter, i) => fadeOut(letter, 40 + i * 32, -8));

    await delay(240);

    // Keep is-open; is-closing overrides lids — pupil stays centered
    eye.classList.remove('is-breathing', 'is-settled');
    eye.classList.add('is-closing');

    await delay(360);

    if (wipe) {
      wipe.style.opacity = '1';
      wipe.style.transition = 'transform 880ms var(--ease-cine), opacity 180ms linear';
      requestAnimationFrame(() => {
        wipe.style.transform = 'scale(95)';
      });
    }

    await delay(480);

    // Homepage under the wipe — NEVER dive to library from intro ENTER
    const stage = document.getElementById('stage');
    const main = document.getElementById('main');

    if (main) {
      main.hidden = true;
      main.classList.remove('is-visible');
    }

    root.classList.remove('is-cine', 'is-intro');
    root.classList.add('is-home');
    body.style.overflow = '';
    body.classList.remove('is-entered');
    if (cursor) cursor.style.opacity = '0';

    if (window.Symvolia && typeof window.Symvolia.enterHome === 'function') {
      window.Symvolia.enterHome({ silent: true });
    } else {
      // Fallback if main.js not ready — still land on #home only
      if (stage) {
        stage.hidden = false;
        stage.removeAttribute('aria-hidden');
        stage.classList.remove('is-diving', 'is-leaving');
        stage.style.visibility = 'visible';
        stage.style.opacity = '1';
        stage.classList.add('stage--alive', 'stage--home-enter', 'stage--home-visible');
      }
      window.scrollTo(0, 0);
      try {
        if (history.replaceState) history.replaceState(null, '', '#home');
      } catch (_) {
        /* */
      }
      root.classList.add('is-journey-alive');
    }

    await delay(480);
    cine.classList.add('is-done');
    timeline.destroy();
    window.setTimeout(() => {
      if (cine && cine.parentNode) cine.parentNode.removeChild(cine);
    }, 950);
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

  function onSkipKey(e) {
    if (!unlockSkip || timeline.skipped || timeline.currentPhase >= 4) return;
    if (e.code === 'Space' || e.key === ' ') {
      e.preventDefault();
      jumpToReady();
    }
  }

  function cleanup() {
    document.removeEventListener('keydown', onSkipKey, true);
    if (timeline._cursorMove) {
      window.removeEventListener('pointermove', timeline._cursorMove);
    }
    timeline._clearWillChange();
  }

  if (enterBtn) {
    enterBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      phase5();
    });
  }

  document.addEventListener('keydown', onSkipKey, true);
  bindCursor();

  // Safety net — don't leave users stranded
  window.setTimeout(() => {
    if (timeline.currentPhase < 4 && !timeline.destroyed) jumpToReady();
  }, 12000);

  window.SymvoliaCine = timeline;
  timeline.play();
})();
