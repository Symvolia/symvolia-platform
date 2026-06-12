(function () {
  'use strict';

  const stage = document.getElementById('stage');
  const main = document.getElementById('main');
  const enterCta = document.getElementById('enterCta');
  const enterBtn = document.getElementById('enterBtn');
  const backBtn = document.getElementById('backBtn');
  const podcastLink = document.getElementById('podcastLink');
  const tunnel = document.getElementById('tunnel');
  const eyeOpenSound = document.getElementById('eyeOpenSound');

  if (!stage || !main) return;

  const DIVE_MS = 2600;
  const REVEAL_START_MS = 1600;
  const EYE_OPEN_SOUND_MS = 200;
  const ALIVE_MS = 4000;
  const ENTER_CTA_MS = 7500;

  let entered = false;
  let eyeSoundPlayed = false;

  function playEyeOpenSound() {
    if (eyeSoundPlayed) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    eyeSoundPlayed = true;

    if (!eyeOpenSound) return;

    eyeOpenSound.volume = 0.38;
    const playPromise = eyeOpenSound.play();

    if (playPromise !== undefined) {
      playPromise.catch(() => {
        eyeSoundPlayed = false;
      });
    }
  }

  function bindEyeSoundFallback() {
    const retry = () => {
      if (!eyeSoundPlayed) playEyeOpenSound();
    };

    stage.addEventListener('pointerdown', retry, { once: true });
    document.addEventListener('keydown', retry, { once: true });
  }

  function awakenLivingSymbol() {
    stage.classList.add('stage--alive');
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
    items.forEach((el, i) => {
      el.style.setProperty('--reveal-delay', `${i * 0.09}s`);
      el.classList.add('is-revealed');
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
        scrollToSection(id, reducedMotion ? 'auto' : 'smooth');

        if (history.replaceState) {
          history.replaceState(null, '', hash);
        } else {
          window.location.hash = hash;
        }
      });
    });
  }

  function returnToStage() {
    if (!entered) return;

    entered = false;

    if (enterBtn) enterBtn.disabled = false;

    document.body.classList.remove('is-entered');
    main.classList.remove('is-visible');
    main.hidden = true;

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

  function enterSite(targetId = 'vision') {
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

  window.setTimeout(playEyeOpenSound, EYE_OPEN_SOUND_MS);
  bindEyeSoundFallback();
  bindSectionNavigation();
  window.setTimeout(awakenLivingSymbol, ALIVE_MS);
  window.setTimeout(showEnterCta, ENTER_CTA_MS);

  if (enterBtn) {
    enterBtn.addEventListener('click', enterSite);
  }

  if (backBtn) {
    backBtn.addEventListener('click', returnToStage);
  }

  if (podcastLink) {
    podcastLink.addEventListener('click', (e) => {
      e.preventDefault();
      enterSite('podcast');
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !entered && enterCta?.classList.contains('is-active')) {
      e.preventDefault();
      enterSite();
    }
  });
})();
