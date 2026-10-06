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
  const FAILSAFE_EXTRA_MS = 850;   // film never reaches REVEAL_AT → reveal anyway
  const STALL_CHECK_MS = 1200;     // video still not playing after this → stalled
  const STALL_REVEAL_MS = 1500;    // shortened film when stalled (from tap)

  function reduced() {
    return w.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /* Phones / touch devices keep the current document (the <video> cannot be
     restarted after a navigation on iOS), so they need the tap to start it. */
  function needsGesture() {
    return w.matchMedia('(pointer: coarse)').matches
      || w.matchMedia('(max-width: 820px)').matches;
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

  /**
   * opts.onStart  — called right after the tap starts the film
   * opts.onReveal — called once the archive may surface
   * opts.ready    — optional Promise (e.g. archive prefetch); the reveal never
   *                 happens before it settles
   * opts.revealAt — seconds into the film at which to reveal
   */
  function play(video, opts) {
    const onReveal = opts && opts.onReveal;
    const onStart = opts && opts.onStart;
    const ready = opts && opts.ready;
    const revealAt = (opts && opts.revealAt != null) ? opts.revealAt : REVEAL_AT;

    if (!video || reduced()) {
      if (typeof onStart === 'function') onStart();
      if (ready && typeof ready.then === 'function') {
        const go = () => { if (typeof onReveal === 'function') onReveal(); };
        ready.then(go, go);
        return;
      }
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
    let timeReached = false;
    let readyDone = !(ready && typeof ready.then === 'function');
    let started = false;
    let frameCb = 0;
    let failSafe = 0;
    let stallTimer = 0;
    let stallReveal = 0;

    const cleanup = () => {
      w.clearTimeout(failSafe);
      w.clearTimeout(stallTimer);
      w.clearTimeout(stallReveal);
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('playing', onPlaying);
      if (frameCb && typeof video.cancelVideoFrameCallback === 'function') {
        try { video.cancelVideoFrameCallback(frameCb); } catch (err) { /* ignore */ }
      }
      frameCb = 0;
    };

    const reveal = () => {
      if (revealed) return;
      revealed = true;
      cleanup();
      video.classList.add('is-behind');
      hold(video);
      if (typeof onReveal === 'function') onReveal();
    };

    const tryReveal = () => {
      if (!revealed && timeReached && readyDone) reveal();
    };

    const reachTime = () => {
      timeReached = true;
      tryReveal();
    };

    function onPlaying() {
      started = true;
    }

    function onTimeUpdate() {
      if (video.currentTime > 0.05) started = true;
      if (video.currentTime >= revealAt) reachTime();
    }

    if (ready && typeof ready.then === 'function') {
      const done = () => {
        readyDone = true;
        tryReveal();
      };
      ready.then(done, done);
    }

    video.addEventListener('playing', onPlaying);

    if (typeof video.requestVideoFrameCallback === 'function') {
      const onFrame = (now, meta) => {
        if (revealed) return;
        started = true;
        const t = meta && typeof meta.mediaTime === 'number' ? meta.mediaTime : video.currentTime;
        if (t >= revealAt) {
          reachTime();
          return;
        }
        frameCb = video.requestVideoFrameCallback(onFrame);
      };
      frameCb = video.requestVideoFrameCallback(onFrame);
    } else {
      video.addEventListener('timeupdate', onTimeUpdate);
    }

    video.addEventListener('ended', reachTime, { once: true });
    video.addEventListener('error', reachTime, { once: true });

    // Film never gets to REVEAL_AT (stalled / throttled): do not wait forever.
    failSafe = w.setTimeout(reachTime, Math.round(revealAt * 1000 + FAILSAFE_EXTRA_MS));

    // Film has not even started after ~1.2 s (slow network): shorten it.
    stallTimer = w.setTimeout(() => {
      if (revealed || started || video.currentTime > 0.05) return;
      w.clearTimeout(failSafe);
      stallReveal = w.setTimeout(reachTime, Math.max(0, STALL_REVEAL_MS - STALL_CHECK_MS));
    }, STALL_CHECK_MS);

    bindResume(video);
  }

  w.SymvoliaArchiveFlow = { play, hold, prime, arm, tryPlay, needsGesture, REVEAL_AT };
})(window);
