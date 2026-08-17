/**
 * Sound Archive — the FindArt particle-sun film plays after the click,
 * then the archive is allowed to surface over a looping background.
 *
 * iOS will not start a muted video that is visibility:hidden, display:none,
 * or played after a navigation (the tap is spent). Fade immediately, retry
 * play(), and unlock on the same gesture that opened Sound Archive.
 */
(function (w) {
  'use strict';

  const REVEAL_AT = 5;

  function reduced() {
    return w.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function arm(video) {
    if (!video) return;
    video.loop = true;
    video.muted = true;
    video.defaultMuted = true;
    video.volume = 0;
    video.playsInline = true;
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    video.setAttribute('muted', '');
    video.setAttribute('autoplay', '');
    video.autoplay = true;
    try { video.preload = 'auto'; } catch (err) { /* ignore */ }
  }

  function tryPlay(video) {
    if (!video) return;
    arm(video);
    const p = video.play();
    if (p && typeof p.catch === 'function') p.catch(() => {});
    return p;
  }

  function prime(video) {
    if (!video) return;
    arm(video);
    if (video.readyState < 2) {
      try { video.load(); } catch (err) { /* ignore */ }
    }
  }

  function kickWhile(video, alive) {
    tryPlay(video);
    ['loadeddata', 'canplay', 'canplaythrough'].forEach((ev) => {
      video.addEventListener(ev, () => {
        if (alive()) tryPlay(video);
      }, { once: true });
    });
    [40, 160, 400, 900, 1800, 3200].forEach((ms) => {
      w.setTimeout(() => {
        if (alive()) tryPlay(video);
      }, ms);
    });
  }

  function bindResume(video) {
    if (!video || video.dataset.flowBound === '1') return;
    video.dataset.flowBound = '1';
    const resume = () => {
      if (!document.hidden) tryPlay(video);
    };
    document.addEventListener('visibilitychange', resume);
    w.addEventListener('pageshow', resume);
    document.addEventListener('touchstart', () => {
      if (video.paused) tryPlay(video);
    }, { passive: true });
  }

  function hold(video) {
    if (!video) return;
    arm(video);
    video.classList.add('is-playing', 'is-behind');
    bindResume(video);
    kickWhile(video, () => true);
  }

  function play(video, opts) {
    const onReveal = opts && opts.onReveal;
    const onStart = opts && opts.onStart;
    const revealAt = (opts && opts.revealAt != null) ? opts.revealAt : REVEAL_AT;

    if (!video || reduced()) {
      if (typeof onStart === 'function') onStart();
      if (typeof onReveal === 'function') onReveal();
      return;
    }

    arm(video);

    // Fade now — iOS will not decode a hidden <video>, and 'playing' may never fire.
    video.classList.add('is-playing');
    if (typeof onStart === 'function') onStart();

    try { video.currentTime = 0; } catch (err) { /* ignore */ }

    let revealed = false;
    const reveal = () => {
      if (revealed) return;
      revealed = true;
      w.clearTimeout(failSafe);
      w.clearInterval(poll);
      video.classList.add('is-behind');
      hold(video);
      if (typeof onReveal === 'function') onReveal();
    };

    const poll = w.setInterval(() => {
      if (video.currentTime >= revealAt) reveal();
    }, 80);

    video.addEventListener('ended', reveal, { once: true });
    video.addEventListener('error', reveal, { once: true });
    const failSafe = w.setTimeout(reveal, Math.round((revealAt + 0.85) * 1000));

    bindResume(video);
    kickWhile(video, () => !revealed);
  }

  w.SymvoliaArchiveFlow = { play, hold, prime, arm, tryPlay, REVEAL_AT };
})(window);
