(function () {
  'use strict';

  const stage = document.getElementById('stage');
  const main = document.getElementById('main');
  const enterCta = document.getElementById('enterCta');
  const enterBtn = document.getElementById('enterBtn');
  const backBtn = document.getElementById('backBtn');
  const tunnel = document.getElementById('tunnel');
  const stageAmbient = document.getElementById('stageAmbient');
  const mainAmbient = document.getElementById('mainAmbient');
  const enterSound = document.getElementById('enterSound');
  const soundToggle = document.getElementById('soundToggle');

  const voidPortal = document.getElementById('voidPortal');
  const voidParticles = document.getElementById('voidParticles');
  const archiveSection = document.getElementById('archive');
  const archivePortalBtn = document.getElementById('archivePortalBtn');
  const archivePanel = document.getElementById('archivePanel');
  const archivePanelClose = document.getElementById('archivePanelClose');

  if (!stage || !main) return;

  const DIVE_MS = 2600;
  const REVEAL_START_MS = 1600;

  const STAGE_VOLUME = 0.55;
  const MAIN_VOLUME = 0.5;
  const ENTER_SOUND_VOLUME = 0.8;
  const FADE_MS = 1400;
  const CROSSFADE_MS = 500;

  const VOID_MS = 2600;

  let entered = false;
  let livingAwake = false;
  let soundMuted = false;
  let revealObserver = null;
  const fadeTimers = new WeakMap();

  function prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function fadeAudio(el, target, duration, onDone) {
    if (!el) return;

    const existing = fadeTimers.get(el);
    if (existing) window.clearInterval(existing);

    const start = el.volume;
    const delta = target - start;
    const steps = Math.max(1, Math.round(duration / 40));
    let step = 0;

    if (target > 0 && el.paused) {
      const p = el.play();
      if (p !== undefined) p.catch(() => {});
    }

    const timer = window.setInterval(() => {
      step += 1;
      const t = step / steps;
      const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      el.volume = Math.min(1, Math.max(0, start + delta * eased));

      if (step >= steps) {
        window.clearInterval(timer);
        fadeTimers.delete(el);
        el.volume = Math.min(1, Math.max(0, target));
        if (target === 0) el.pause();
        if (onDone) onDone();
      }
    }, 40);

    fadeTimers.set(el, timer);
  }

  function startStageAmbient() {
    if (!stageAmbient) return;
    if (!stageAmbient.paused && stageAmbient.volume > 0) return;

    stageAmbient.volume = 0;
    const p = stageAmbient.play();
    if (p !== undefined) {
      p.then(() => fadeAudio(stageAmbient, STAGE_VOLUME, FADE_MS))
        .catch(() => {});
    } else {
      fadeAudio(stageAmbient, STAGE_VOLUME, FADE_MS);
    }
  }

  function bindAmbientFallback() {
    const retry = () => {
      if (!entered) startStageAmbient();
    };

    stage.addEventListener('pointerdown', retry, { once: true });
    document.addEventListener('keydown', retry, { once: true });
    document.addEventListener('pointerdown', retry, { once: true });
  }

  function playEnterSound() {
    if (!enterSound) return;
    try {
      enterSound.currentTime = 0;
      enterSound.volume = ENTER_SOUND_VOLUME;
      const p = enterSound.play();
      if (p !== undefined) p.catch(() => {});
    } catch (err) {
      /* ignore */
    }
  }

  function currentAmbient() {
    return entered ? mainAmbient : stageAmbient;
  }

  function suspendAmbient() {
    [stageAmbient, mainAmbient].forEach((el) => {
      if (el && !el.paused) el.pause();
    });
  }

  function resumeAmbient() {
    if (document.hidden || !document.hasFocus() || navigator.onLine === false) return;

    const el = currentAmbient();
    if (!el || !el.paused) return;

    if (el.volume === 0) el.volume = entered ? MAIN_VOLUME : STAGE_VOLUME;
    const p = el.play();
    if (p !== undefined) p.catch(() => {});
  }

  function bindAmbientLifecycle() {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) suspendAmbient();
      else resumeAmbient();
    });

    window.addEventListener('blur', suspendAmbient);
    window.addEventListener('focus', resumeAmbient);

    window.addEventListener('offline', suspendAmbient);
    window.addEventListener('online', resumeAmbient);

    window.addEventListener('pagehide', suspendAmbient);
  }

  /* ── Sound on/off toggle (persistent, all screens) ── */
  function setMuted(muted) {
    soundMuted = muted;
    try {
      window.dispatchEvent(
        new CustomEvent('symvolia:mute-change', { detail: { muted: soundMuted } })
      );
    } catch (err) { /* ignore */ }

    [stageAmbient, mainAmbient, enterSound].forEach((el) => {
      if (el) el.muted = muted;
    });

    if (soundToggle) {
      soundToggle.classList.toggle('is-muted', muted);
      soundToggle.setAttribute('aria-pressed', String(!muted));
      soundToggle.setAttribute('aria-label', muted ? 'Attiva audio' : 'Disattiva audio');
    }

    try {
      localStorage.setItem('symvolia-muted', muted ? '1' : '0');
    } catch (err) {
      /* storage unavailable */
    }

    if (!muted) resumeAmbient();
  }

  function bindSoundToggle() {
    let stored = '0';
    try {
      stored = localStorage.getItem('symvolia-muted') || '0';
    } catch (err) {
      /* ignore */
    }
    setMuted(stored === '1');

    if (soundToggle) {
      soundToggle.addEventListener('click', () => setMuted(!soundMuted));
    }
  }

  /* ── Void dive animation + Sound Archive portal ── */
  let voidBusy = false;
  let archiveOpen = false;
  let particlesBuilt = false;

  function buildVoidParticles() {
    if (particlesBuilt || !voidParticles) return;

    const count = 30;
    const frag = document.createDocumentFragment();

    for (let i = 0; i < count; i += 1) {
      const particle = document.createElement('span');
      particle.className = 'void__particle';

      const angle = Math.random() * Math.PI * 2;
      const dist = 32 + Math.random() * 58;
      const tx = Math.cos(angle) * dist;
      const ty = Math.sin(angle) * dist;
      const size = 3 + Math.random() * 6;

      particle.style.setProperty('--tx', `${tx.toFixed(1)}vmax`);
      particle.style.setProperty('--ty', `${ty.toFixed(1)}vmax`);
      particle.style.setProperty('--size', `${size.toFixed(1)}px`);
      particle.style.setProperty('--delay', `${Math.floor(Math.random() * 480)}ms`);

      frag.appendChild(particle);
    }

    voidParticles.appendChild(frag);
    particlesBuilt = true;
  }

  function runVoid(closing, onMid, onDone) {
    if (!voidPortal || prefersReducedMotion()) {
      if (onMid) onMid();
      if (onDone) onDone();
      return;
    }

    buildVoidParticles();

    voidPortal.classList.remove('is-active', 'is-closing');
    void voidPortal.offsetWidth; // restart animations
    voidPortal.classList.add(closing ? 'is-closing' : 'is-active');

    window.setTimeout(() => {
      if (onMid) onMid();
    }, Math.round(VOID_MS * 0.46));

    window.setTimeout(() => {
      voidPortal.classList.remove('is-active', 'is-closing');
      if (onDone) onDone();
    }, VOID_MS);
  }

  function revealArchiveCards() {
    if (!archivePanel) return;
    const items = archivePanel.querySelectorAll('[data-reveal]');
    items.forEach((el, i) => {
      el.style.setProperty('--reveal-delay', `${(i * 0.08).toFixed(2)}s`);
      el.classList.add('is-revealed');
    });
  }

  function openArchive() {
    if (voidBusy || archiveOpen || !archiveSection || !archivePanel) return;
    voidBusy = true;

    runVoid(false, () => {
      archivePanel.hidden = false;
      void archivePanel.offsetWidth;
      archiveSection.classList.add('is-open');
      archiveOpen = true;
      if (archivePortalBtn) archivePortalBtn.setAttribute('aria-expanded', 'true');
      revealArchiveCards();
    }, () => {
      voidBusy = false;
      if (archivePanelClose) archivePanelClose.focus({ preventScroll: true });
    });
  }

  function closeArchive() {
    if (voidBusy || !archiveOpen || !archiveSection || !archivePanel) return;
    voidBusy = true;

    runVoid(true, () => {
      archiveSection.classList.remove('is-open');
      archivePanel.hidden = true;
      archiveOpen = false;
      if (archivePortalBtn) archivePortalBtn.setAttribute('aria-expanded', 'false');
    }, () => {
      voidBusy = false;
      if (archivePortalBtn) archivePortalBtn.focus({ preventScroll: true });
    });
  }

  function resetArchive() {
    if (voidPortal) voidPortal.classList.remove('is-active', 'is-closing');
    if (archiveSection) archiveSection.classList.remove('is-open');
    if (archivePanel) archivePanel.hidden = true;
    if (archivePortalBtn) archivePortalBtn.setAttribute('aria-expanded', 'false');
    archiveOpen = false;
    voidBusy = false;
  }

  function bindArchivePortal() {
    if (archivePortalBtn) archivePortalBtn.addEventListener('click', openArchive);
    if (archivePanelClose) archivePanelClose.addEventListener('click', closeArchive);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && archiveOpen && !voidBusy) closeArchive();
    });
  }

  function awaken(opts) {
    if (livingAwake) return;
    livingAwake = true;
    const silent = opts && opts.silent;
    // Siren braam only on the dive into the site — silent during auto-emergence.
    if (!silent) playEnterSound();
    awakenLivingSymbol();
  }

  function handleEnter() {
    // Opening journey auto-awakens the living symbol; Enter always dives in.
    // Fallback: if somehow still asleep, awaken first then wait for a second press.
    if (!livingAwake) {
      awaken({ silent: false });
      showEnterCta();
      return;
    }
    enterSite('bio');
  }

  function setAmbientLevel(level) {
    if (soundMuted) return;
    const el = currentAmbient();
    if (!el || el.paused) return;
    const target = Math.max(0, Math.min(1, level));
    fadeAudio(el, target, CROSSFADE_MS);
  }

  function awakenLivingSymbol() {
    stage.classList.add('stage--alive');
    document.documentElement.classList.add('is-stage-alive');
    document.body.classList.add('is-stage-alive');
    const living = document.getElementById('stageLiving');
    const sigil = document.getElementById('sigilCore');
    const inscriptions = document.querySelector('.stage__inscriptions');
    if (living) living.setAttribute('aria-hidden', 'false');
    if (sigil) sigil.setAttribute('aria-hidden', 'false');
    if (inscriptions) inscriptions.setAttribute('aria-hidden', 'false');
  }

  function showEnterCta() {
    if (enterCta) enterCta.classList.add('is-active');
  }

  function revealMainContent() {
    const items = main.querySelectorAll('[data-reveal]');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reducedMotion || !('IntersectionObserver' in window)) {
      items.forEach((el) => el.classList.add('is-revealed'));
      return;
    }

    if (revealObserver) revealObserver.disconnect();

    revealObserver = new IntersectionObserver((entries, observer) => {
      const appearing = entries.filter((entry) => entry.isIntersecting);
      appearing
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        .forEach((entry, i) => {
          const el = entry.target;
          el.style.setProperty('--reveal-delay', `${i * 0.1}s`);
          el.classList.add('is-revealed');
          observer.unobserve(el);
        });
    }, { threshold: 0.12, rootMargin: '0px 0px -10% 0px' });

    items.forEach((el) => {
      el.classList.remove('is-revealed');
      revealObserver.observe(el);
    });
  }

  function resetReveals() {
    if (revealObserver) {
      revealObserver.disconnect();
      revealObserver = null;
    }
    main.querySelectorAll('[data-reveal]').forEach((el) => {
      el.classList.remove('is-revealed');
      el.style.removeProperty('--reveal-delay');
    });
  }

  function scrollToSection(id, behavior) {
    const section = document.getElementById(id);
    if (!section) return;

    section.scrollIntoView({ behavior, block: 'start' });
  }

  function bindSectionNavigation() {
    const sectionLinks = main.querySelectorAll('a[href^="#"]');

    sectionLinks.forEach((link) => {
      link.addEventListener('click', (e) => {
        const hash = link.getAttribute('href');
        if (!hash || hash === '#') return;

        const id = hash.slice(1);
        const target = document.getElementById(id);
        if (!target) return;

        e.preventDefault();

        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (window.SymvoliaEnv && typeof window.SymvoliaEnv.pulseSectionVeil === 'function') {
          window.SymvoliaEnv.pulseSectionVeil();
        }
        scrollToSection(id, reducedMotion ? 'auto' : 'smooth');

        if (history.replaceState) {
          history.replaceState(null, '', hash);
        } else {
          window.location.hash = hash;
        }

        if (window.SymvoliaEnv && typeof window.SymvoliaEnv.setMood === 'function') {
          window.SymvoliaEnv.setMood(id);
        }
      });
    });
  }

  function returnToStage() {
    if (!entered) return;

    entered = false;

    if (enterBtn) enterBtn.disabled = false;

    if (enterSound) {
      enterSound.pause();
      enterSound.currentTime = 0;
    }

    fadeAudio(mainAmbient, 0, FADE_MS);
    startStageAmbient();

    resetArchive();

    document.documentElement.classList.remove('is-stage-alive');
    document.body.classList.remove('is-stage-alive');
    document.body.classList.remove('is-entered');
    document.body.removeAttribute('data-mood');
    document.documentElement.classList.add('is-journey-alive', 'is-journey-cta');
    main.classList.remove('is-visible');
    main.hidden = true;
    showEnterCta();

    resetReveals();

    stage.hidden = false;
    stage.setAttribute('aria-hidden', 'false');
    stage.classList.remove('is-leaving', 'is-diving');

    if (tunnel) tunnel.classList.remove('is-active');

    window.scrollTo(0, 0);

    if (history.replaceState) {
      history.replaceState(null, '', window.location.pathname);
    } else {
      window.location.hash = '';
    }
  }

  function enterSite(targetId = 'bio') {
    if (entered) {
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      scrollToSection(targetId, reducedMotion ? 'auto' : 'smooth');

      if (history.replaceState) {
        history.replaceState(null, '', `#${targetId}`);
      } else {
        window.location.hash = targetId;
      }

      return;
    }
    entered = true;

    if (enterBtn) enterBtn.disabled = true;

    playEnterSound();

    fadeAudio(stageAmbient, 0, FADE_MS);
    if (mainAmbient) {
      mainAmbient.volume = 0;
      const p = mainAmbient.play();
      if (p !== undefined) p.catch(() => {});
      fadeAudio(mainAmbient, MAIN_VOLUME, FADE_MS);
    }

    document.documentElement.classList.remove('is-journey-locked', 'is-journey-cta');

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!reducedMotion) {
      stage.classList.add('is-diving');
      if (tunnel) tunnel.classList.add('is-active');
    } else {
      stage.classList.add('is-leaving');
    }

    main.hidden = false;

    const revealDelay = reducedMotion ? 0 : REVEAL_START_MS;
    const leaveDelay = reducedMotion ? 100 : DIVE_MS - 400;
    const hideDelay = reducedMotion ? 200 : DIVE_MS;

    window.setTimeout(() => {
      document.body.classList.add('is-entered');
      main.classList.add('is-visible');
      revealMainContent();

      window.scrollTo(0, 0);

      if (history.replaceState) {
        history.replaceState(null, '', `#${targetId}`);
      }

      scrollToSection(targetId, reducedMotion ? 'auto' : 'smooth');

      const focusTarget = document.getElementById(targetId) || main.querySelector('.main__title');
      if (focusTarget) focusTarget.focus({ preventScroll: true });
    }, revealDelay);

    window.setTimeout(() => {
      stage.classList.add('is-leaving');
    }, leaveDelay);

    window.setTimeout(() => {
      stage.hidden = true;
      stage.setAttribute('aria-hidden', 'true');
      main.removeAttribute('hidden');
    }, hideDelay);
  }

  // Public API for the living-environment / portal orchestrators.
  window.Symvolia = {
    awaken,
    showEnterCta,
    enterSite,
    setAmbientLevel,
    startStageAmbient,
    isMuted: () => soundMuted,
    isAwake: () => livingAwake,
    isEntered: () => entered,
  };

  bindSoundToggle();
  startStageAmbient();
  bindAmbientFallback();
  bindAmbientLifecycle();
  bindSectionNavigation();
  bindArchivePortal();
  // Enter CTA is revealed by environment.js after the opening journey.

  if (enterBtn) {
    enterBtn.addEventListener('click', handleEnter);
  }

  if (backBtn) {
    backBtn.addEventListener('click', returnToStage);
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !entered && enterCta?.classList.contains('is-active')) {
      e.preventDefault();
      handleEnter();
    }
  });

  setupMailMenu();

  function setupMailMenu() {
    const triggers = document.querySelectorAll('.mail-trigger');
    if (!triggers.length) return;

    const menu = document.createElement('div');
    menu.className = 'mail-menu';
    menu.setAttribute('role', 'menu');
    menu.hidden = true;
    document.body.appendChild(menu);

    let activeTrigger = null;

    function buildOptions(email) {
      const enc = encodeURIComponent(email);
      return [
        { label: 'Gmail', href: `https://mail.google.com/mail/?view=cm&fs=1&to=${enc}`, external: true },
        { label: 'Outlook', href: `https://outlook.live.com/mail/0/deeplink/compose?to=${enc}`, external: true },
        { label: 'App Mail', href: `mailto:${email}`, external: false },
        { label: 'Copia indirizzo', action: 'copy' },
      ];
    }

    function closeMenu() {
      menu.hidden = true;
      if (activeTrigger) {
        activeTrigger.setAttribute('aria-expanded', 'false');
        activeTrigger = null;
      }
    }

    function positionMenu(trigger) {
      const rect = trigger.getBoundingClientRect();
      menu.style.visibility = 'hidden';
      menu.hidden = false;
      const menuRect = menu.getBoundingClientRect();
      let left = rect.left + rect.width / 2 - menuRect.width / 2;
      left = Math.max(12, Math.min(left, window.innerWidth - menuRect.width - 12));
      let top = rect.bottom + 10;
      if (top + menuRect.height > window.innerHeight - 12) {
        top = rect.top - menuRect.height - 10;
      }
      menu.style.left = `${Math.round(left + window.scrollX)}px`;
      menu.style.top = `${Math.round(top + window.scrollY)}px`;
      menu.style.visibility = '';
    }

    function openMenu(trigger) {
      const email = trigger.getAttribute('data-email');
      menu.innerHTML = '';

      buildOptions(email).forEach((opt) => {
        let item;
        if (opt.action === 'copy') {
          item = document.createElement('button');
          item.type = 'button';
          item.textContent = opt.label;
          item.addEventListener('click', async () => {
            try {
              await navigator.clipboard.writeText(email);
              item.textContent = 'Copiato ✓';
              window.setTimeout(closeMenu, 700);
            } catch (err) {
              item.textContent = email;
            }
          });
        } else {
          item = document.createElement('a');
          item.href = opt.href;
          item.textContent = opt.label;
          if (opt.external) {
            item.target = '_blank';
            item.rel = 'noopener noreferrer';
          }
          item.addEventListener('click', () => window.setTimeout(closeMenu, 0));
        }
        item.className = 'mail-menu__item';
        item.setAttribute('role', 'menuitem');
        menu.appendChild(item);
      });

      activeTrigger = trigger;
      trigger.setAttribute('aria-expanded', 'true');
      positionMenu(trigger);
    }

    triggers.forEach((trigger) => {
      trigger.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (activeTrigger === trigger) {
          closeMenu();
        } else {
          openMenu(trigger);
        }
      });
    });

    document.addEventListener('click', (e) => {
      if (!menu.hidden && !menu.contains(e.target)) closeMenu();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeMenu();
    });
    window.addEventListener('resize', closeMenu);
    window.addEventListener('scroll', closeMenu, true);
  }
})();
