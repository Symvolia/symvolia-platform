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

  const archivePortalBtn = document.getElementById('archivePortalBtn');

  const ARCHIVE_PAGE = 'archive.html';
  const HOME_PATH = window.location.pathname;
  const SECTION_IDS = ['bio', 'vision', 'archive', 'contact'];
  /* Single source of truth for the archive stylesheets used by the in-place
     path. Keep these identical to the <link> versions in archive.html. */
  const ARCHIVE_CSS = ['css/archive-page.css?v=10', 'css/archive-sun.css?v=17'];
  const ARCHIVE_PREFETCH_TIMEOUT_MS = 8000;
  const HUB_LEAVE_MS = 880;

  if (!stage || !main) return;

  const REVEAL_START_MS = 1000;
  const SITE_ENTER_CROSSFADE_MS = 1300;

  const STAGE_VOLUME = 0.55;
  const MAIN_VOLUME = 0.5;
  const ENTER_SOUND_VOLUME = 0.8;
  const FADE_MS = 1400;
  const CROSSFADE_MS = 500;

  /* Deep link (#bio / #vision / #archive / #contact) captured in <head>. */
  let pendingTargetHash = SECTION_IDS.indexOf(window.__symvoliaTargetHash) !== -1
    ? window.__symvoliaTargetHash
    : null;
  /* True when the current section entry sits on top of a home entry we pushed,
     so browser Back (and our back arrow) can simply pop it. */
  let sectionPushed = false;
  /* Programmatic scrolls (glideTo / jumpTo) must not close the mail menu. */
  let programmaticScrollUntil = 0;

  let entered = false;
  let livingAwake = false;
  let libraryUnlocked = false;
  let homeUnlockTimer = null;
  let soundMuted = false;
  let revealObserver = null;
  const fadeTimers = new WeakMap();
  const HOME_SETTLE_MS = 1400;

  function writeHistory(mode, state, url) {
    try {
      if (history[mode]) history[mode](state, '', url);
    } catch (err) { /* ignore */ }
  }

  function prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /* ── Volume control ──
     iOS Safari ignores HTMLMediaElement.volume (read-only, always 1), so there
     fades would silently do nothing. Where volume is not writable we route the
     element through Web Audio (MediaElementSource → GainNode) and drive the
     gain instead. The AudioContext is created / resumed inside the Enter tap. */
  let volumeWritable = null;
  let audioCtx = null;
  const gainNodes = new WeakMap();

  function canSetVolume() {
    if (volumeWritable !== null) return volumeWritable;
    try {
      const probe = new Audio();
      probe.volume = 0.5;
      volumeWritable = Math.abs(probe.volume - 0.5) < 0.001;
    } catch (err) {
      volumeWritable = true;
    }
    return volumeWritable;
  }

  function ensureAudioContext() {
    if (audioCtx) return audioCtx;
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    try {
      audioCtx = new Ctor();
    } catch (err) {
      audioCtx = null;
    }
    return audioCtx;
  }

  function resumeAudioContext() {
    if (!audioCtx || audioCtx.state === 'running') return;
    try {
      const p = audioCtx.resume();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    } catch (err) { /* ignore */ }
  }

  /* GainNode for an element, or null when plain .volume works / Web Audio fails. */
  function gainFor(el) {
    if (canSetVolume()) return null;
    if (gainNodes.has(el)) return gainNodes.get(el);

    const ctx = ensureAudioContext();
    let node = null;
    if (ctx) {
      try {
        const src = ctx.createMediaElementSource(el);
        node = ctx.createGain();
        node.gain.value = 0;
        src.connect(node);
        node.connect(ctx.destination);
      } catch (err) {
        node = null;
      }
    }
    gainNodes.set(el, node);
    return node;
  }

  function getVolume(el) {
    const node = gainFor(el);
    return node ? node.gain.value : el.volume;
  }

  function setVolume(el, value) {
    const v = Math.min(1, Math.max(0, value));
    const node = gainFor(el);
    if (node) node.gain.value = v;
    else el.volume = v;
  }

  /* Call synchronously from a user gesture (the Enter tap): grants playback to
     the ambient / enter elements on iOS so the later fade-in is allowed. */
  function unlockAudio() {
    if (!canSetVolume()) {
      ensureAudioContext();
      resumeAudioContext();
    }

    [stageAmbient, mainAmbient, enterSound].forEach((el) => {
      if (!el) return;
      try {
        el.muted = soundMuted;
        gainFor(el); // route through Web Audio before it starts playing
        const keepPlaying = el === stageAmbient;
        if (keepPlaying) {
          if (el.paused) setVolume(el, 0);
        } else if (el.dataset.audioUnlocked === '1') {
          return;
        } else {
          setVolume(el, 0);
        }

        el.dataset.audioUnlocked = '1';
        const p = el.play();
        if (p && typeof p.catch === 'function') p.catch(() => {});
        if (!keepPlaying) el.pause();
      } catch (err) { /* ignore */ }
    });
  }

  function fadeAudio(el, target, duration, onDone) {
    if (!el) return;
    resumeAudioContext();

    const existing = fadeTimers.get(el);
    if (existing) window.clearInterval(existing);

    const start = getVolume(el);
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
      setVolume(el, start + delta * eased);

      if (step >= steps) {
        window.clearInterval(timer);
        fadeTimers.delete(el);
        setVolume(el, target);
        if (target === 0) el.pause();
        if (onDone) onDone();
      }
    }, 40);

    fadeTimers.set(el, timer);
  }

  /* The ouroboros canvas loop only runs while the home sigil is on screen. */
  function ouroboros(action) {
    const api = window.SymvoliaOuroboros;
    if (api && typeof api[action] === 'function') api[action]();
  }

  function warmMedia(el) {
    if (!el) return;
    try {
      if (el.preload !== 'auto') el.preload = 'auto';
      // Never reset an element that is playing or was unlocked by the tap.
      if (el.paused && el.readyState === 0 && el.dataset.audioUnlocked !== '1'
        && typeof el.load === 'function') {
        el.load();
      }
    } catch (err) {
      /* ignore */
    }
  }

  function startStageAmbient() {
    if (!stageAmbient) return;
    if (!stageAmbient.paused && getVolume(stageAmbient) > 0) return;

    warmMedia(stageAmbient);
    setVolume(stageAmbient, 0);
    const p = stageAmbient.play();
    if (p !== undefined) {
      p.then(() => fadeAudio(stageAmbient, STAGE_VOLUME, FADE_MS))
        .catch(() => {});
    } else {
      fadeAudio(stageAmbient, STAGE_VOLUME, FADE_MS);
    }
  }

  function warmSiteAudio() {
    warmMedia(mainAmbient);
    warmMedia(enterSound);
  }

  function bindAmbientFallback() {
    const retry = () => {
      unlockAudio(); // a gesture: grant playback (iOS) + resume Web Audio
      if (!entered) startStageAmbient();
    };

    stage.addEventListener('pointerdown', retry, { once: true });
    document.addEventListener('keydown', retry, { once: true });
    document.addEventListener('pointerdown', retry, { once: true });
  }

  function playEnterSound() {
    if (!enterSound) return;
    warmSiteAudio();
    try {
      enterSound.currentTime = 0;
      setVolume(enterSound, ENTER_SOUND_VOLUME);
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
    if (document.hidden || navigator.onLine === false) return;

    const el = currentAmbient();
    if (!el || !el.paused) return;

    if (getVolume(el) === 0) setVolume(el, entered ? MAIN_VOLUME : STAGE_VOLUME);
    const p = el.play();
    if (p !== undefined) p.catch(() => {});
  }

  function bindAmbientLifecycle() {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) suspendAmbient();
      else resumeAmbient();
    });

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

    if (window.SymvoliaArchiveAmbient) window.SymvoliaArchiveAmbient.setMuted(muted);

    if (soundToggle) {
      soundToggle.classList.toggle('is-muted', muted);
      soundToggle.setAttribute('aria-pressed', String(!muted));
      soundToggle.setAttribute('aria-label', muted ? 'Unmute audio' : 'Mute audio');
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

  /* ── Sound Archive portal ── */
  let voidBusy = false;

  /* Resolves when the stylesheet has loaded (or failed — never rejects). */
  function ensureSheet(href) {
    return new Promise((resolve) => {
      const path = href.split('?')[0];
      let link = document.querySelector(`link[rel="stylesheet"][href*="${path}"]`);
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        resolve();
      };

      if (link && link.sheet) {
        finish();
        return;
      }

      if (!link) {
        link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = href;
        document.head.appendChild(link);
      }

      link.addEventListener('load', finish, { once: true });
      link.addEventListener('error', finish, { once: true });
      window.setTimeout(finish, ARCHIVE_PREFETCH_TIMEOUT_MS);
    });
  }

  /* Starts fetching archive.html and its stylesheets. The promise resolves
     (never rejects) with { ok, html } once BOTH the markup and the CSS are in.
     Cached so every caller shares one request. */
  let archivePrefetch = null;

  function prefetchArchive() {
    if (archivePrefetch) return archivePrefetch;

    const htmlReq = Promise.race([
      fetch(ARCHIVE_PAGE)
        .then((res) => {
          if (!res.ok) throw new Error('archive');
          return res.text();
        })
        .catch(() => null),
      new Promise((resolve) => window.setTimeout(() => resolve(null), ARCHIVE_PREFETCH_TIMEOUT_MS)),
    ]);
    const cssReq = Promise.all(ARCHIVE_CSS.map(ensureSheet));

    archivePrefetch = Promise.all([htmlReq, cssReq]).then(([html]) => {
      if (!html) archivePrefetch = null; // allow a retry next time
      return { ok: !!html, html };
    });

    return archivePrefetch;
  }

  /* Sound Archive: the tap that opens it must also start the film.
     iOS will not restart a <video> after a navigation, so phones keep this
     document and bring the archive in over the looping film. */
  let archiveLeaving = false;
  let attachMailTriggers = null; // set by setupMailMenu(); binds triggers in a new scope

  function teardownArchiveInPlace() {
    const shell = document.getElementById('archiveInPlace');
    if (!shell) return false;

    shell.remove();
    archiveLeaving = false;
    document.documentElement.classList.remove('is-archive-open', 'is-archive-page', 'is-dark-sun');
    document.body.classList.remove('is-archive-open', 'archive-body', 'dark-sun-body');

    if (entered) {
      if (main) {
        main.hidden = false;
        main.removeAttribute('aria-hidden');
      }
      if (stage) {
        stage.hidden = true;
        stage.setAttribute('aria-hidden', 'true');
      }
      fadeAudio(mainAmbient, MAIN_VOLUME, FADE_MS);
    } else {
      if (main) main.hidden = true;
      if (stage) {
        stage.hidden = false;
        stage.removeAttribute('aria-hidden');
      }
      if (livingAwake) startStageAmbient();
      ouroboros('resume');
    }

    if (window.SymvoliaArchiveAmbient) window.SymvoliaArchiveAmbient.pause();

    // The film has done its job — stop decoding it behind the site.
    const film = document.getElementById('archiveFlow');
    if (film) {
      film.classList.remove('is-playing', 'is-behind');
      try { film.pause(); } catch (err) { /* ignore */ }
    }

    if (entered) writeHistory('replaceState', { symv: 'section', id: 'archive' }, `${HOME_PATH}#archive`);
    else writeHistory('replaceState', { symv: 'home' }, `${HOME_PATH}#home`);

    voidBusy = false;
    return true;
  }

  /* In-place archive: the shell is not a separate page, so its back arrow and
     its links must not reload the document. */
  function leaveArchiveInPlace() {
    if (history.state && history.state.archiveInPlace) history.back();
    else teardownArchiveInPlace();
  }

  function leaveArchiveToPage(href) {
    if (archiveLeaving) return;
    archiveLeaving = true;

    const shell = document.getElementById('archiveInPlace');
    if (shell) shell.classList.add('is-leaving');
    if (window.SymvoliaArchiveAmbient) window.SymvoliaArchiveAmbient.fadeOut(HUB_LEAVE_MS);

    window.setTimeout(() => {
      window.location.href = href;
    }, prefersReducedMotion() ? 0 : Math.round(HUB_LEAVE_MS * 0.82));
  }

  function onArchiveShellClick(e) {
    if (e.defaultPrevented) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;

    const link = e.target.closest && e.target.closest('a[href]');
    if (!link) return;

    if (link.classList.contains('main__back') || link.id === 'archiveReturn') {
      e.preventDefault();
      leaveArchiveInPlace();
      return;
    }

    if (link.target === '_blank' || link.hasAttribute('download')) return;

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
    leaveArchiveToPage(url.href);
  }

  function enterArchiveInPlace(opts) {
    const fromHistory = !!(opts && opts.fromHistory);
    const video = document.getElementById('archiveFlow');
    if (video && window.SymvoliaArchiveFlow) {
      window.SymvoliaArchiveFlow.hold(video);
    }

    // HTML + CSS are fetched ahead of time; the shell is never inserted
    // before its stylesheets are applied.
    prefetchArchive()
      .then((res) => {
        if (!res || !res.ok) throw new Error('archive');
        const doc = new DOMParser().parseFromString(res.html, 'text/html');
        const inner = doc.querySelector('.dark-sun__earth-inner');
        const header = doc.querySelector('.archive-page__header');
        if (!inner) throw new Error('archive-markup');

        document.title = doc.title || document.title;
        document.documentElement.classList.add('is-archive-open', 'is-archive-page', 'is-dark-sun');
        document.documentElement.classList.remove('is-home');
        document.body.classList.add('is-archive-open', 'is-entered', 'archive-body', 'dark-sun-body');

        if (main) {
          main.hidden = true;
          main.setAttribute('aria-hidden', 'true');
        }
        if (stage) {
          stage.hidden = true;
          stage.setAttribute('aria-hidden', 'true');
        }
        ouroboros('pause');

        const existing = document.getElementById('archiveInPlace');
        if (existing) existing.remove();

        const shell = document.createElement('div');
        shell.id = 'archiveInPlace';
        shell.className = 'main is-visible archive-page archive-page--sun';
        if (header) shell.appendChild(document.importNode(header, true));

        const sun = document.createElement('div');
        sun.className = 'dark-sun is-flowing is-descended';
        sun.id = 'darkSun';
        const earth = document.createElement('div');
        earth.className = 'dark-sun__earth';
        earth.id = 'archiveEarth';
        earth.appendChild(document.importNode(inner, true));
        sun.appendChild(earth);
        shell.appendChild(sun);

        shell.addEventListener('click', onArchiveShellClick);
        archiveLeaving = false;

        if (video && video.parentNode) {
          video.parentNode.insertBefore(shell, video);
        } else {
          document.body.appendChild(shell);
        }

        if (attachMailTriggers) attachMailTriggers(shell);

        if (!fromHistory) writeHistory('pushState', { archiveInPlace: true }, 'archive.html?landed=1');

        window.scrollTo(0, 0);
        fadeAudio(mainAmbient, 0, FADE_MS);
        let hubMuted = false;
        try { hubMuted = localStorage.getItem('symvolia-muted') === '1'; } catch (err) { /* ignore */ }
        if (window.SymvoliaArchiveAmbient && !hubMuted) {
          window.SymvoliaArchiveAmbient.play(0.5, FADE_MS);
        }
        voidBusy = false;
      })
      .catch(() => {
        voidBusy = false;
        window.location.href = 'archive.html?landed=1';
      });
  }

  function diveToArchivePage(href) {
    if (voidBusy) return;
    voidBusy = true;

    // Start the HTML + CSS download right away (also covers a tap that
    // lands before the portal ever scrolled into view).
    const archiveReady = prefetchArchive();

    let play = 'archive.html?play=1';
    try {
      const url = new URL(href || ARCHIVE_PAGE, window.location.href);
      url.searchParams.delete('enter');
      url.searchParams.delete('landed');
      url.searchParams.set('play', '1');
      play = url.pathname + url.search + url.hash;
    } catch (err) { /* ignore */ }

    const flowApi = window.SymvoliaArchiveFlow;
    const flow = document.getElementById('archiveFlow');
    const reducedMotion = prefersReducedMotion();
    const canFilm = flow && flowApi && !reducedMotion;

    // Phones: keep this document, play the film inside the tap.
    if (canFilm && flowApi.needsGesture()) {
      flowApi.play(flow, {
        ready: archiveReady,
        onReveal: enterArchiveInPlace,
      });
      return;
    }

    // Desktop: navigate immediately — film starts on archive.html via ?play=1.
    fadeAudio(mainAmbient, 0, FADE_MS);
    window.location.href = play;
  }

  function resetArchive() {
    const flow = document.getElementById('archiveFlow');
    if (flow) {
      flow.classList.remove('is-playing', 'is-behind');
      try { flow.pause(); } catch (err) { /* ignore */ }
    }
    voidBusy = false;
  }

  /* Coming back from the archive with the browser's own back gesture: the page
     may have been frozen mid-dive. Reset film/portal state and resume audio. */
  window.addEventListener('pageshow', (e) => {
    if (!e.persisted) return;

    // Back from a passage into the in-place archive: it is still open, and
    // frozen mid-leave. Lift it and keep the film running behind it.
    const openShell = document.getElementById('archiveInPlace');
    if (openShell) {
      openShell.classList.remove('is-leaving');
      archiveLeaving = false;
      voidBusy = false;
      const film = document.getElementById('archiveFlow');
      if (film && window.SymvoliaArchiveFlow) window.SymvoliaArchiveFlow.hold(film);
      if (window.SymvoliaArchiveAmbient && !soundMuted) window.SymvoliaArchiveAmbient.play(0.5, FADE_MS);
      return;
    }

    resetArchive();

    if (entered) fadeAudio(mainAmbient, MAIN_VOLUME, FADE_MS);
    else if (livingAwake) startStageAmbient();
  });

  function bindArchivePortal() {
    if (!archivePortalBtn) return;

    const go = (e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (e.type === 'click' && e.button !== 0) return;
      e.preventDefault();
      diveToArchivePage(archivePortalBtn.getAttribute('href'));
    };

    archivePortalBtn.addEventListener('click', go);

    const flow = document.getElementById('archiveFlow');
    if (flow && window.SymvoliaArchiveFlow && 'IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        window.SymvoliaArchiveFlow.prime(flow);
        prefetchArchive();
        io.disconnect();
      }, { rootMargin: '200px' });
      io.observe(archivePortalBtn);
    }
  }

  /* Returning from the archive page: surface directly into the library,
     skipping intro and homepage. */
  function enterLibraryDirect(targetId) {
    entered = true;
    libraryUnlocked = true;

    document.documentElement.classList.remove(
      'is-home', 'is-intro', 'is-cine', 'is-journey-locked', 'is-journey-cta'
    );
    document.documentElement.classList.add('is-journey-alive');

    setHomeChromeVisible(false);
    stage.hidden = true;
    stage.setAttribute('aria-hidden', 'true');
    ouroboros('pause');
    if (enterCta) enterCta.classList.remove('is-active');

    main.hidden = false;
    document.body.classList.add('is-entered');
    main.classList.add('is-visible');
    revealMainContent();

    if (mainAmbient) {
      setVolume(mainAmbient, 0);
      const p = mainAmbient.play();
      if (p !== undefined) p.catch(() => {});
      fadeAudio(mainAmbient, MAIN_VOLUME, FADE_MS);
    }

    scrollToSection(targetId, 'auto');
    // Reveals and web fonts settle a few frames later — land the anchor precisely.
    window.setTimeout(() => scrollToSection(targetId, 'auto'), 320);
    window.setTimeout(() => scrollToSection(targetId, 'auto'), 900);

    // Drop the ?from=archive marker without touching history depth.
    sectionPushed = false;
    writeHistory('replaceState', { symv: 'section', id: targetId }, `${HOME_PATH}#${targetId}`);
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
    // Archive dive is locked until the homepage sigil has settled.
    if (!libraryUnlocked) return;
    if (!livingAwake) awaken({ silent: false });
    enterSite('bio');
  }

  /* One-shot reveal animations are done once the home has settled: drop their
     compositing hints (mirrors _clearWillChange in the intro). */
  function releaseHomeWillChange() {
    stage.querySelectorAll('.eye__ball, .stage__sigil-reveal').forEach((el) => {
      el.style.willChange = 'auto';
    });
  }

  function unlockLibraryNav() {
    releaseHomeWillChange();
    libraryUnlocked = true;
    document.documentElement.classList.add('is-journey-cta');
    showEnterCta();
    if (enterBtn) enterBtn.disabled = false;

    // Deep link: once the home has settled, go straight to the requested section.
    if (pendingTargetHash) {
      const target = pendingTargetHash;
      pendingTargetHash = null;
      window.__symvoliaTargetHash = null;
      enterSite(target);
    }
  }

  /**
   * Land on the homepage sigil (ouroboros / runes / seal).
   * NEVER opens the library — that requires a deliberate second action.
   */
  function enterHome(opts) {
    const silent = !opts || opts.silent !== false;

    entered = false;
    libraryUnlocked = false;
    if (homeUnlockTimer) {
      window.clearTimeout(homeUnlockTimer);
      homeUnlockTimer = null;
    }

    document.documentElement.classList.add('is-home', 'is-journey-alive');
    document.documentElement.classList.remove(
      'is-journey-locked',
      'is-journey-cta',
      'is-cine',
      'is-intro'
    );
    document.body.classList.remove('is-entered');
    document.body.style.overflow = '';

    if (enterBtn) enterBtn.disabled = true;
    if (enterCta) enterCta.classList.remove('is-active');

    main.classList.remove('is-visible');
    main.hidden = true;

    stage.hidden = false;
    stage.removeAttribute('aria-hidden');
    stage.classList.remove('is-diving', 'is-leaving');
    stage.style.visibility = 'visible';
    stage.style.opacity = '1';

    window.scrollTo(0, 0);
    sectionPushed = false;
    // A requested deep link keeps its hash; otherwise normalise to #home.
    if (pendingTargetHash) writeHistory('replaceState', { symv: 'home' }, window.location.href);
    else writeHistory('replaceState', { symv: 'home' }, '#home');

    awaken({ silent: true });
    if (!silent) playEnterSound();
    startStageAmbient();
    ouroboros('resume');

    stage.classList.add('stage--alive', 'stage--home-enter');
    stage.classList.remove('stage--home-visible');
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        stage.classList.add('stage--home-visible');
      });
    });

    const settle = prefersReducedMotion() ? 80 : HOME_SETTLE_MS;
    homeUnlockTimer = window.setTimeout(unlockLibraryNav, settle);

    try {
      window.dispatchEvent(new CustomEvent('symvolia:home-ready'));
    } catch (err) {
      /* */
    }
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
    const stageMenu = document.getElementById('stageMenu');
    if (living) living.setAttribute('aria-hidden', 'false');
    if (sigil) sigil.setAttribute('aria-hidden', 'false');
    if (stageMenu) stageMenu.removeAttribute('aria-hidden');
  }

  function getStageMenuItems() {
    return Array.from(stage.querySelectorAll('.stage__menu-item'));
  }

  function setMenuSelection(index) {
    const items = getStageMenuItems();
    items.forEach((item, i) => {
      item.classList.toggle('is-selected', i === index);
    });
    return items[index] || null;
  }

  function activateMenuItem(item) {
    if (!item || entered || !libraryUnlocked) return;
    const target = item.getAttribute('data-enter');
    if (target) {
      enterSite(target.replace(/^#/, ''));
      return;
    }
    // External / plain links
    if (item.target === '_blank') {
      window.open(item.href, '_blank', 'noopener,noreferrer');
      return;
    }
    item.click();
  }

  function bindStageMenu() {
    const items = getStageMenuItems();
    if (!items.length) return;

    let selected = 0;
    setMenuSelection(selected);

    items.forEach((item, index) => {
      item.addEventListener('click', (e) => {
        const target = item.getAttribute('data-enter');
        if (!target) return; // let external links work natively
        e.preventDefault();
        selected = index;
        setMenuSelection(selected);
        if (!entered && libraryUnlocked) enterSite(target.replace(/^#/, ''));
      });

      item.addEventListener('mouseenter', () => {
        selected = index;
        setMenuSelection(selected);
      });

      item.addEventListener('focus', () => {
        selected = index;
        setMenuSelection(selected);
      });
    });

    document.addEventListener('keydown', (e) => {
      if (entered || !libraryUnlocked) return;
      if (!document.documentElement.classList.contains('is-home')) return;
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Enter') return;

      const active = document.activeElement;
      const onMenu =
        active &&
        (active.classList?.contains('stage__menu-item') ||
          stage.contains(active) && active.closest?.('.stage__orbit, .stage__menu'));
      const onEnterBtn = active === enterBtn;

      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        // Don't steal arrows from text fields
        if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return;
        e.preventDefault();
        const list = getStageMenuItems();
        if (!list.length) return;
        if (e.key === 'ArrowDown') selected = (selected + 1) % list.length;
        else selected = (selected - 1 + list.length) % list.length;
        const next = setMenuSelection(selected);
        if (next) next.focus({ preventScroll: true });
        return;
      }

      // Enter: activate selected menu item when focusing menu; else CTA
      if (e.key === 'Enter') {
        if (onEnterBtn) return; // button handles itself
        if (onMenu || document.activeElement === document.body || active === stage) {
          const list = getStageMenuItems();
          const current = list[selected];
          if (current && (onMenu || !enterCta?.classList.contains('is-active'))) {
            e.preventDefault();
            activateMenuItem(current);
          }
        }
      }
    });
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

  /* Native smooth scrolling never completes in this document — the animation is
     dropped the moment the library fades in — so we drive it ourselves. */
  let scrollAnim = 0;

  function jumpTo(top) {
    programmaticScrollUntil = performance.now() + 200;
    if (scrollAnim) {
      window.cancelAnimationFrame(scrollAnim);
      scrollAnim = 0;
    }
    try {
      window.scrollTo({ top, left: 0, behavior: 'instant' });
    } catch (err) {
      window.scrollTo(0, top);
    }
  }

  function glideTo(top, duration) {
    const start = window.scrollY || document.documentElement.scrollTop || 0;
    const delta = top - start;
    if (Math.abs(delta) < 2) {
      jumpTo(top);
      return;
    }

    if (scrollAnim) window.cancelAnimationFrame(scrollAnim);

    const span = duration || 1080;
    const t0 = performance.now();
    const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

    const step = (now) => {
      programmaticScrollUntil = performance.now() + 200;
      const t = Math.min(1, (now - t0) / span);
      const y = Math.round(start + delta * ease(t));
      try {
        window.scrollTo({ top: y, left: 0, behavior: 'instant' });
      } catch (err) {
        window.scrollTo(0, y);
      }
      scrollAnim = t < 1 ? window.requestAnimationFrame(step) : 0;
    };

    scrollAnim = window.requestAnimationFrame(step);
  }

  function sectionOffset(section) {
    const margin = parseFloat(window.getComputedStyle(section).scrollMarginTop) || 0;
    const y = section.getBoundingClientRect().top + (window.scrollY || 0) - margin;
    const max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    return Math.max(0, Math.min(Math.round(y), max));
  }

  function focusSection(id) {
    const el = document.getElementById(id);
    if (!el) return false;
    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
    try {
      el.focus({ preventScroll: true });
    } catch (err) {
      return false;
    }
    return true;
  }

  function scrollToSection(id, behavior) {
    const section = document.getElementById(id);
    if (!section) return;

    const top = sectionOffset(section);
    if (behavior === 'smooth' && !prefersReducedMotion()) glideTo(top);
    else jumpTo(top);
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
        focusSection(id);

        writeHistory('replaceState', { symv: 'section', id }, hash);

        if (window.SymvoliaEnv && typeof window.SymvoliaEnv.setMood === 'function') {
          window.SymvoliaEnv.setMood(id);
        }
      });
    });
  }

  function setHomeChromeVisible(visible) {
    const menu = document.getElementById('stageMenu');
    const footer = stage.querySelector('.stage__footer');
    const inscriptions = stage.querySelector('.stage__inscriptions');
    const targets = [menu, footer, inscriptions].filter(Boolean);

    targets.forEach((el) => {
      if (visible) {
        el.hidden = false;
        el.removeAttribute('aria-hidden');
        el.style.removeProperty('display');
        el.style.removeProperty('opacity');
        el.style.removeProperty('visibility');
      } else {
        el.hidden = true;
        el.setAttribute('aria-hidden', 'true');
        el.style.display = 'none';
        el.style.opacity = '0';
        el.style.visibility = 'hidden';
      }
    });

    // The runic inscriptions are decorative: never exposed to assistive tech.
    if (inscriptions) inscriptions.setAttribute('aria-hidden', 'true');

    stage.querySelectorAll('.stage__menu-item').forEach((item) => {
      if (visible) {
        item.style.removeProperty('opacity');
        item.style.removeProperty('visibility');
      } else {
        item.style.opacity = '0';
        item.style.visibility = 'hidden';
      }
    });
  }

  function returnToStage() {
    entered = false;
    libraryUnlocked = true;
    if (homeUnlockTimer) {
      window.clearTimeout(homeUnlockTimer);
      homeUnlockTimer = null;
    }

    document.documentElement.classList.add('is-home', 'is-journey-alive', 'is-journey-cta');
    document.documentElement.classList.remove('is-journey-locked');
    document.body.classList.remove('is-entered');

    if (enterBtn) enterBtn.disabled = false;

    const reducedMotion = prefersReducedMotion();
    const fadeMs = reducedMotion ? 0 : 900;

    stage.hidden = false;
    stage.removeAttribute('aria-hidden');
    stage.classList.remove('is-diving', 'is-leaving');
    stage.classList.add('stage--alive', 'stage--home-enter', 'stage--home-visible');
    stage.style.visibility = 'visible';
    stage.style.opacity = '0';
    setHomeChromeVisible(true);
    ouroboros('resume');

    void stage.offsetWidth;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        main.classList.remove('is-visible');
        stage.style.opacity = '1';
      });
    });

    window.setTimeout(() => {
      main.hidden = true;
      stage.style.removeProperty('opacity');
      stage.style.removeProperty('visibility');
    }, fadeMs);

    window.scrollTo(0, 0);
    sectionPushed = false;
    writeHistory('replaceState', { symv: 'home' }, '#home');

    fadeAudio(mainAmbient, 0, FADE_MS);
    startStageAmbient();
    showEnterCta();
    awaken({ silent: true });

    if (enterSound) {
      enterSound.pause();
      enterSound.currentTime = 0;
    }
    resetArchive();
    resetReveals();
    if (tunnel) tunnel.classList.remove('is-active');
  }

  /* Land after the library is laid out — a single jump while main was just
     un-hidden can measure the wrong offset before layout settles. */
  function landOnSection(targetId) {
    const go = () => {
      const section = document.getElementById(targetId);
      if (!section) {
        window.scrollTo(0, 0);
        return;
      }
      jumpTo(sectionOffset(section));
    };
    go();
    requestAnimationFrame(() => {
      go();
      requestAnimationFrame(go);
    });
    window.setTimeout(go, 60);
    window.setTimeout(go, 280);
    window.setTimeout(go, 700);
  }

  function enterSite(targetId = 'bio', opts) {
    const fromHistory = !!(opts && opts.fromHistory);
    // Critical: never dive to library until homepage has been revealed.
    if (!entered && !libraryUnlocked) return;

    if (entered) {
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      scrollToSection(targetId, reducedMotion ? 'auto' : 'smooth');
      focusSection(targetId);
      writeHistory('replaceState', { symv: 'section', id: targetId }, `#${targetId}`);

      return;
    }
    entered = true;
    document.documentElement.classList.remove('is-journey-cta', 'is-journey-locked');

    if (enterBtn) enterBtn.disabled = true;
    if (enterCta) enterCta.classList.remove('is-active');

    playEnterSound();

    fadeAudio(stageAmbient, 0, FADE_MS);
    if (mainAmbient) {
      setVolume(mainAmbient, 0);
      const p = mainAmbient.play();
      if (p !== undefined) p.catch(() => {});
      fadeAudio(mainAmbient, MAIN_VOLUME, FADE_MS);
    }

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    main.hidden = false;
    main.removeAttribute('hidden');
    void main.offsetHeight;

    if (!reducedMotion) {
      document.documentElement.classList.add('is-site-entering');
      stage.classList.add('is-diving');
      if (tunnel) tunnel.classList.add('is-active');
    } else {
      stage.classList.add('is-leaving');
      document.documentElement.classList.remove('is-home');
    }

    const revealDelay = reducedMotion ? 0 : REVEAL_START_MS;
    const hideDelay = reducedMotion ? 200 : REVEAL_START_MS + SITE_ENTER_CROSSFADE_MS + 200;

    window.setTimeout(() => {
      document.body.classList.add('is-entered');

      main.classList.add('is-visible');
      if (!reducedMotion) stage.classList.add('is-fading');
      revealMainContent();
      landOnSection(targetId);

      // home → site is a new history entry, so Back returns to the home.
      if (fromHistory) {
        writeHistory('replaceState', { symv: 'section', id: targetId }, `#${targetId}`);
      } else {
        writeHistory('pushState', { symv: 'section', id: targetId }, `#${targetId}`);
      }
      sectionPushed = true;

      focusSection(targetId);
    }, revealDelay);

    window.setTimeout(() => {
      setHomeChromeVisible(false);
      stage.classList.remove('is-diving', 'is-fading');
      stage.classList.add('is-leaving');
      stage.hidden = true;
      stage.setAttribute('aria-hidden', 'true');
      ouroboros('pause');
      if (tunnel) tunnel.classList.remove('is-active');
      document.documentElement.classList.remove('is-home', 'is-site-entering');
      main.removeAttribute('hidden');
      landOnSection(targetId);
      focusSection(targetId);
    }, hideDelay);
  }

  // Public API for the living-environment / portal orchestrators.
  window.Symvolia = {
    awaken,
    showEnterCta,
    enterHome,
    enterSite,
    setAmbientLevel,
    startStageAmbient,
    unlockAudio,
    isMuted: () => soundMuted,
    isAwake: () => livingAwake,
    isEntered: () => entered,
    isLibraryUnlocked: () => libraryUnlocked,
  };

  const directEntry = document.documentElement.classList.contains('is-direct');

  bindSoundToggle();
  // Stage ambient waits for intro-complete (or direct entry) so boot stays light.
  if (directEntry) startStageAmbient();
  else {
    window.addEventListener('symvolia:intro-complete', () => {
      warmMedia(stageAmbient);
      startStageAmbient();
    }, { once: true });
    window.addEventListener('symvolia:home-ready', () => {
      warmSiteAudio();
    }, { once: true });
  }
  bindAmbientFallback();
  bindAmbientLifecycle();
  bindSectionNavigation();
  bindArchivePortal();
  window.addEventListener('popstate', (e) => {
    // Archive opened in place: Back closes it and lands on the section/home below.
    if (teardownArchiveInPlace()) return;

    const st = e.state || {};

    if (st.archiveInPlace) {
      // Forward into an in-place archive whose shell was torn down.
      if (entered) {
        voidBusy = true;
        enterArchiveInPlace({ fromHistory: true });
      }
      return;
    }

    if (st.symv === 'section') {
      // Forward from home into a section.
      if (!entered && libraryUnlocked) enterSite(st.id || 'bio', { fromHistory: true });
      return;
    }

    // Home (or anything that is not a section): leave the site view, not the page.
    if (entered && !document.getElementById('archiveInPlace')) returnToStage();
  });
  bindStageMenu();
  // Enter CTA is revealed by environment.js after the opening journey.

  if (directEntry) enterLibraryDirect('bio');

  if (enterBtn) {
    enterBtn.addEventListener('click', handleEnter);
  }

  if (backBtn) {
    backBtn.addEventListener('click', () => {
      if (sectionPushed && history.state && history.state.symv === 'section') history.back();
      else returnToStage();
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || entered || !libraryUnlocked) return;
    if (!enterCta?.classList.contains('is-active')) return;
    const active = document.activeElement;
    // Menu items / focused controls handle Enter themselves
    if (active && active.classList?.contains('stage__menu-item')) return;
    if (active === enterBtn) return;
    // Ignore while cinematic intro still owns the viewport
    if (document.documentElement.classList.contains('is-cine')) return;
    e.preventDefault();
    handleEnter();
  });

  setupMailMenu();

  function setupMailMenu() {
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
        { label: 'Copy address', action: 'copy' },
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

      activeTrigger = trigger;
      trigger.setAttribute('aria-expanded', 'true');
      positionMenu(trigger);
    }

    function bindTrigger(trigger) {
      if (trigger.dataset.mailBound === '1') return;
      trigger.dataset.mailBound = '1';
      trigger.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (activeTrigger === trigger) {
          closeMenu();
        } else {
          openMenu(trigger);
        }
      });
    }

    attachMailTriggers = (scope) => {
      (scope || document).querySelectorAll('.mail-trigger').forEach(bindTrigger);
    };
    attachMailTriggers(document);

    document.addEventListener('click', (e) => {
      if (!menu.hidden && !menu.contains(e.target)) closeMenu();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeMenu();
    });
    window.addEventListener('resize', closeMenu);
    window.addEventListener('scroll', () => {
      if (performance.now() < programmaticScrollUntil) return;
      closeMenu();
    }, true);
  }
})();
