/**
 * Symvolia — Sound Archive pages (the hub and every single passage).
 * Passage pages still emerge from / return through the void.
 * The Dark Sun hub uses its own descent instead of the alchemical veil.
 */
(function () {
  'use strict';

  const voidPortal = document.getElementById('voidPortal');
  const voidParticles = document.getElementById('voidParticles');
  const soundToggle = document.getElementById('soundToggle');
  const mainAmbient = document.getElementById('mainAmbient');
  const page = document.querySelector('.archive-page');
  const isSunHub = !!document.getElementById('darkSun');

  const VOID_MS = 3200;
  const HUB_LEAVE_MS = 720;
  const FADE_MS = 1400;
  const MUTE_KEY = 'symvolia-muted';

  // A passage page is a listening room — the ambient bed stays further back there.
  const hasPlayer = !!document.querySelector('.archive-entry__player');
  const MAIN_VOLUME = hasPlayer ? 0.26 : 0.5;

  const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── Void particles (shared markup with the main page) ── */
  let particlesBuilt = false;

  function buildVoidParticles() {
    if (particlesBuilt || !voidParticles) return;

    const frag = document.createDocumentFragment();

    for (let i = 0; i < 30; i += 1) {
      const particle = document.createElement('span');
      particle.className = 'void__particle';

      const angle = Math.random() * Math.PI * 2;
      const dist = 32 + Math.random() * 58;

      particle.style.setProperty('--tx', `${(Math.cos(angle) * dist).toFixed(1)}vmax`);
      particle.style.setProperty('--ty', `${(Math.sin(angle) * dist).toFixed(1)}vmax`);
      particle.style.setProperty('--size', `${(3 + Math.random() * 6).toFixed(1)}px`);
      particle.style.setProperty('--delay', `${Math.floor(Math.random() * 480)}ms`);

      frag.appendChild(particle);
    }

    voidParticles.appendChild(frag);
    particlesBuilt = true;
  }

  if (voidParticles) buildVoidParticles();

  /* ── Arrival: drop the veil once it has dissolved ── */
  if (voidPortal && !isSunHub) {
    window.setTimeout(() => {
      voidPortal.classList.remove('is-arriving');
    }, reduced() ? 0 : VOID_MS);
  }

  /* ── Departure: dive back into the void, then hand over to the next page ── */
  let leaving = false;

  function leaveThrough(go) {
    if (leaving) return;
    leaving = true;

    if (isSunHub) {
      if (page) page.classList.add('is-leaving');
      if (mainAmbient) fadeAudio(mainAmbient, 0, HUB_LEAVE_MS);
      window.setTimeout(go, reduced() ? 0 : HUB_LEAVE_MS);
      return;
    }

    if (!voidPortal || reduced()) {
      go();
      return;
    }

    if (page) page.classList.add('is-leaving');
    if (mainAmbient) fadeAudio(mainAmbient, 0, Math.round(VOID_MS * 0.74));

    // Canvas black hole for every forward passage inside the archive.
    if (window.SymvoliaVoid) {
      window.SymvoliaVoid.start({
        duration: VOID_MS,
        interactive: true,
        onMid: go,
      });
      return;
    }

    voidPortal.classList.remove('is-active', 'is-closing', 'is-arriving', 'void--canvas');
    void voidPortal.offsetWidth;
    voidPortal.classList.add('is-active');
    window.setTimeout(go, Math.round(VOID_MS * 0.74));
  }

  function leaveTo(href) {
    leaveThrough(() => {
      window.location.href = href;
    });
  }

  /* ── Return: a page restored from the back/forward cache comes back exactly
     as it was left — sunk in the void, with every link already spent. It has to
     be lifted out, or the reader lands on a black, unresponsive page. ── */
  window.addEventListener('pageshow', (e) => {
    if (!e.persisted) return;

    leaving = false;
    if (page) page.classList.remove('is-leaving');
    if (window.SymvoliaVoid) window.SymvoliaVoid.stop();

    if (voidPortal && !isSunHub) {
      voidPortal.classList.remove('is-active', 'is-closing', 'is-arriving', 'void--canvas');
      if (!reduced()) {
        void voidPortal.offsetWidth;
        voidPortal.classList.add('is-arriving');
        window.setTimeout(() => voidPortal.classList.remove('is-arriving'), VOID_MS);
      }
    }

    startAmbient();
  });

  // Forward moves inside the archive — hub → passages → next passage —
  // travel through the black hole. The back arrow does not.
  function bindVoidExits() {
    document.addEventListener('click', (e) => {
      if (e.defaultPrevented) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;

      const link = e.target.closest && e.target.closest('a[href]');
      if (!link || link.target === '_blank' || link.hasAttribute('download')) return;
      if (link.classList.contains('main__back') || link.closest('.main__back')) return;

      const href = link.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('mailto:')) return;

      let url;
      try {
        url = new URL(href, window.location.href);
      } catch (err) {
        return;
      }
      if (url.origin !== window.location.origin) return;

      e.preventDefault();
      leaveTo(url.href);
    });
  }

  const ARCHIVE_PATH = /(^|\/)archive[\w-]*\.html$/;

  function isArchiveUrl(value) {
    if (!value) return false;
    try {
      const url = new URL(value, window.location.href);
      return url.origin === window.location.origin && ARCHIVE_PATH.test(url.pathname);
    } catch (err) {
      return false;
    }
  }

  // The arrow goes straight back — no black hole, no delay. Within the archive
  // it retraces history; leaving for the site it follows its written href,
  // which carries the marker that skips the intro.
  function bindBackLink() {
    const back = document.querySelector('.main__back');
    if (!back) return;

    back.addEventListener('click', (e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;

      const href = back.getAttribute('href');
      const useHistory = isArchiveUrl(href)
        && window.history.length >= 2
        && isArchiveUrl(document.referrer);

      if (!useHistory && !href) return;

      e.preventDefault();
      leaving = true;
      if (useHistory) window.history.back();
      else window.location.href = href;
    });
  }

  /* ── Audio: same ambient bed and same mute switch as the rest of the site ── */
  let fadeTimer = 0;

  function fadeAudio(el, target, duration) {
    if (!el) return;
    if (fadeTimer) window.clearInterval(fadeTimer);

    const start = el.volume;
    const delta = target - start;
    const steps = Math.max(1, Math.round(duration / 40));
    let step = 0;

    fadeTimer = window.setInterval(() => {
      step += 1;
      const t = step / steps;
      el.volume = Math.min(1, Math.max(0, start + delta * t));
      if (step >= steps) {
        window.clearInterval(fadeTimer);
        fadeTimer = 0;
        el.volume = Math.min(1, Math.max(0, target));
        if (target === 0) el.pause();
      }
    }, 40);
  }

  let muted = false;

  function readMuted() {
    try {
      return localStorage.getItem(MUTE_KEY) === '1';
    } catch (err) {
      return false;
    }
  }

  function applyMuted(next, persist) {
    muted = next;

    if (mainAmbient) mainAmbient.muted = muted;

    if (soundToggle) {
      soundToggle.classList.toggle('is-muted', muted);
      soundToggle.setAttribute('aria-pressed', String(!muted));
      soundToggle.setAttribute('aria-label', muted ? 'Attiva audio' : 'Disattiva audio');
    }

    if (persist) {
      try {
        localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
      } catch (err) { /* storage unavailable */ }
    }

    if (!muted) startAmbient();
  }

  function startAmbient() {
    if (!mainAmbient || muted || leaving) return;
    if (!mainAmbient.paused && mainAmbient.volume > 0) return;

    mainAmbient.volume = 0;
    const p = mainAmbient.play();
    if (p !== undefined) {
      p.then(() => fadeAudio(mainAmbient, MAIN_VOLUME, FADE_MS)).catch(() => {
        // Autoplay refused on a fresh document — wait for the first gesture.
        document.addEventListener('pointerdown', startAmbient, { once: true });
        document.addEventListener('keydown', startAmbient, { once: true });
      });
    } else {
      fadeAudio(mainAmbient, MAIN_VOLUME, FADE_MS);
    }
  }

  function bindSoundToggle() {
    applyMuted(readMuted(), false);
    if (soundToggle) {
      soundToggle.addEventListener('click', () => applyMuted(!muted, true));
    }
  }

  function bindAmbientLifecycle() {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (mainAmbient && !mainAmbient.paused) mainAmbient.pause();
      } else {
        startAmbient();
      }
    });
    window.addEventListener('pagehide', () => {
      if (mainAmbient && !mainAmbient.paused) mainAmbient.pause();
    });
  }

  /* ── Scroll reveals ── */
  function bindReveals() {
    const items = Array.from(document.querySelectorAll('[data-reveal]'));
    if (!items.length) return;

    if (reduced() || !('IntersectionObserver' in window)) {
      items.forEach((el) => el.classList.add('is-revealed'));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const el = entry.target;
          const siblings = Array.from(el.parentElement ? el.parentElement.children : [el]);
          const i = Math.max(0, siblings.indexOf(el));
          el.style.setProperty('--reveal-delay', `${(i * 0.08).toFixed(2)}s`);
          el.classList.add('is-revealed');
          observer.unobserve(el);
        });
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.12 }
    );

    items.forEach((el) => observer.observe(el));
  }

  /* ── Mail menu (compact twin of the one on the main page) ── */
  function bindMailMenu() {
    const triggers = document.querySelectorAll('.mail-trigger');
    if (!triggers.length) return;

    const menu = document.createElement('div');
    menu.className = 'mail-menu';
    menu.setAttribute('role', 'menu');
    menu.hidden = true;
    document.body.appendChild(menu);

    let activeTrigger = null;

    function closeMenu() {
      menu.hidden = true;
      if (activeTrigger) {
        activeTrigger.setAttribute('aria-expanded', 'false');
        activeTrigger = null;
      }
    }

    function openMenu(trigger) {
      const email = trigger.getAttribute('data-email') || '';
      const enc = encodeURIComponent(email);
      menu.innerHTML = '';

      const options = [
        { label: 'Gmail', href: `https://mail.google.com/mail/?view=cm&fs=1&to=${enc}`, external: true },
        { label: 'Outlook', href: `https://outlook.live.com/mail/0/deeplink/compose?to=${enc}`, external: true },
        { label: 'App Mail', href: `mailto:${email}`, external: false },
        { label: 'Copia indirizzo', action: 'copy' },
      ];

      options.forEach((opt) => {
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

      const rect = trigger.getBoundingClientRect();
      menu.style.visibility = 'hidden';
      menu.hidden = false;
      const menuRect = menu.getBoundingClientRect();
      let left = rect.left + rect.width / 2 - menuRect.width / 2;
      left = Math.max(12, Math.min(left, window.innerWidth - menuRect.width - 12));
      let top = rect.bottom + 10;
      if (top + menuRect.height > window.innerHeight - 12) top = rect.top - menuRect.height - 10;
      menu.style.left = `${Math.round(left + window.scrollX)}px`;
      menu.style.top = `${Math.round(top + window.scrollY)}px`;
      menu.style.visibility = '';

      activeTrigger = trigger;
      trigger.setAttribute('aria-expanded', 'true');
    }

    triggers.forEach((trigger) => {
      trigger.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (activeTrigger === trigger) closeMenu();
        else openMenu(trigger);
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

  /* The moment a player is touched, the ambient bed steps aside. */
  function bindPlayerDucking() {
    if (!hasPlayer || !mainAmbient) return;

    const duck = () => {
      if (mainAmbient.paused) return;
      fadeAudio(mainAmbient, 0, 900);
    };

    document.querySelectorAll('.archive-entry__player').forEach((el) => {
      el.addEventListener('pointerdown', duck);
    });

    // Clicks inside an iframe never bubble: the focus jumping there is the tell.
    window.addEventListener('blur', () => {
      if (document.activeElement && document.activeElement.tagName === 'IFRAME') duck();
    });
  }

  bindSoundToggle();
  bindAmbientLifecycle();
  bindVoidExits();
  bindBackLink();
  bindReveals();
  bindMailMenu();
  bindPlayerDucking();
})();
