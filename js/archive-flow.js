/**
 * Sound Archive — the FindArt particle-sun film plays after the click,
 * then the archive is allowed to surface over a looping background.
 *
 * iOS will not start a muted video that is visibility:hidden, or restart it
 * after a navigation. play() must run in the tap handler; never seek first.
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
    video.controls = false;
    video.playsInline = true;
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    video.setAttribute('muted', '');
    video.setAttribute('autoplay', '');
    video.removeAttribute('controls');
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
  }

  function bindResume(video) {
    if (!video || video.dataset.flowBound === '1') return;
    video.dataset.flowBound = '1';
    const resume = () => {
      if (!document.hidden) tryPlay(video);
    };
    document.addEventListener('visibilitychange', resume);
    w.addEventListener('pageshow', resume);
  }

  function hold(video) {
    if (!video) return;
    arm(video);
    video.classList.add('is-playing', 'is-behind');
    bindResume(video);
    tryPlay(video);
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
    video.classList.add('is-playing');
    if (typeof onStart === 'function') onStart();

    // Must stay inside the tap call stack. Seeking first pauses iOS playback
    // and the next play() is no longer a user gesture.
    tryPlay(video);

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
  }

  w.SymvoliaArchiveFlow = { play, hold, prime, arm, tryPlay, REVEAL_AT };
})(window);
