/**
 * Sound Archive — the FindArt particle-sun film plays after the click,
 * then the archive is allowed to surface over a looping background.
 */
(function (w) {
  'use strict';

  const REVEAL_AT = 5;

  function reduced() {
    return w.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function arm(video) {
    video.loop = true;
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    video.setAttribute('muted', '');
    video.setAttribute('autoplay', '');
  }

  function tryPlay(video) {
    const p = video.play();
    if (p && typeof p.catch === 'function') p.catch(() => {});
    return p;
  }

  function hold(video) {
    if (!video) return;
    arm(video);
    video.classList.add('is-playing', 'is-behind');
    tryPlay(video);
    const resume = () => {
      if (!document.hidden) tryPlay(video);
    };
    document.addEventListener('visibilitychange', resume);
    w.addEventListener('pageshow', resume);
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

    if (revealAt <= 0) {
      hold(video);
      if (typeof onStart === 'function') onStart();
      if (typeof onReveal === 'function') onReveal();
      return;
    }

    try { video.currentTime = 0; } catch (err) { /* ignore */ }

    let faded = false;
    const startFade = () => {
      if (faded) return;
      faded = true;
      video.classList.add('is-playing');
      if (typeof onStart === 'function') onStart();
    };

    let revealed = false;
    const reveal = () => {
      if (revealed) return;
      revealed = true;
      window.clearTimeout(failSafe);
      video.classList.add('is-behind');
      video.removeEventListener('timeupdate', onTime);
      video.removeEventListener('playing', startFade);
      hold(video);
      if (typeof onReveal === 'function') onReveal();
    };

    const onTime = () => {
      if (video.currentTime >= revealAt) reveal();
    };

    video.addEventListener('playing', startFade, { once: true });
    video.addEventListener('timeupdate', onTime);
    video.addEventListener('ended', reveal, { once: true });
    video.addEventListener('error', reveal, { once: true });
    const failSafe = window.setTimeout(reveal, Math.round((revealAt + 0.85) * 1000));

    const p = tryPlay(video);
    if (p && typeof p.catch === 'function') {
      p.catch(() => {
        tryPlay(video);
        window.setTimeout(startFade, 280);
      });
    }
  }

  w.SymvoliaArchiveFlow = { play, hold, REVEAL_AT };
})(window);
