/**
 * Symvolia — Sound Archive pages (the hub and every single passage).
 * Passage links navigate natively. The Dark Sun hub keeps a short leave fade.
 */
(function () {
  'use strict';

  const soundToggle = document.getElementById('soundToggle');
  const mainAmbient = document.getElementById('mainAmbient');
  const page = document.querySelector('.archive-page');
  const isSunHub = !!document.getElementById('darkSun');
  const hubAmbient = isSunHub && window.SymvoliaArchiveAmbient;

  const HUB_LEAVE_MS = 880;
  const FADE_MS = 1400;
  const MUTE_KEY = 'symvolia-muted';

  // A passage page is a listening room — the ambient bed stays further back there.
  const hasPlayer = !!document.querySelector('.archive-entry__player');
  const MAIN_VOLUME = hasPlayer ? 0.26 : 0.5;

  const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let leaving = false;

  /* Hub only: short fade before navigating into a passage. Passages use native links. */
  function leaveThrough(go) {
    if (leaving) return;
    leaving = true;

    if (isSunHub) {
      if (page) page.classList.add('is-leaving');
      if (hubAmbient) hubAmbient.fadeOut(HUB_LEAVE_MS);
      else if (mainAmbient) fadeAudio(mainAmbient, 0, HUB_LEAVE_MS);
      window.setTimeout(go, reduced() ? 0 : Math.round(HUB_LEAVE_MS * 0.82));
      return;
    }

    go();
  }

  function leaveTo(href) {
    leaveThrough(() => {
      window.location.href = href;
    });
  }

  /* bfcache restore: clear leave state and restart ambient — no overlay. */
  window.addEventListener('pageshow', (e) => {
    if (!e.persisted) return;
    leaving = false;
    if (page) page.classList.remove('is-leaving');
    startAmbient();
  });

  function bindHubExits() {
    if (!isSunHub) return;

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

  // The arrow goes straight back — no delay. Within the archive it retraces
  // history; leaving for the site it follows its written href, which carries
  // the marker that skips the intro.
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

    if (hubAmbient) {
      if (muted) hubAmbient.pause();
    } else if (mainAmbient) {
      mainAmbient.muted = muted;
    }

    if (soundToggle) {
      soundToggle.classList.toggle('is-muted', muted);
      soundToggle.setAttribute('aria-pressed', String(!muted));
      soundToggle.setAttribute('aria-label', muted ? 'Unmute audio' : 'Mute audio');
    }

    if (persist) {
      try {
        localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
      } catch (err) { /* storage unavailable */ }
    }

    if (!muted && (!hubAmbient || hubIsOpen())) startAmbient();
  }

  window.addEventListener('symvolia:archive-open', () => {
    if (!muted) startAmbient();
  });

  function hubIsOpen() {
    return document.documentElement.classList.contains('is-archive-open');
  }

  function startAmbient() {
    if (muted || leaving) return;

    if (hubAmbient) {
      if (!hubIsOpen()) return;
      hubAmbient.play(MAIN_VOLUME, FADE_MS);
      return;
    }

    if (!mainAmbient) return;
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
        if (hubAmbient) hubAmbient.pause();
        else if (mainAmbient && !mainAmbient.paused) mainAmbient.pause();
      } else {
        startAmbient();
      }
    });
    window.addEventListener('pagehide', () => {
      if (hubAmbient) hubAmbient.pause();
      else if (mainAmbient && !mainAmbient.paused) mainAmbient.pause();
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
        { label: 'Copy address', action: 'copy' },
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
              item.textContent = 'Copied ✓';
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
  bindHubExits();
  bindBackLink();
  bindReveals();
  bindMailMenu();
  bindPlayerDucking();

  if (hubAmbient && hubIsOpen()) startAmbient();
})();
