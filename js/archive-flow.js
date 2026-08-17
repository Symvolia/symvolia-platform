/**
 * Sound Archive — the FindArt particle-sun film plays after the click,
 * then the archive is allowed to surface.
 */
(function (w) {
  'use strict';

  const REVEAL_AT = 5;

  function reduced() {
    return w.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function play(video, opts) {
    const onReveal = opts && opts.onReveal;
    const onStart = opts && opts.onStart;
    const revealAt = (opts && opts.revealAt != null) ? opts.revealAt : REVEAL_AT;

    if (typeof onStart === 'function') onStart();

    if (!video || reduced()) {
      if (typeof onReveal === 'function') onReveal();
      return;
    }

    video.classList.add('is-playing');
    video.loop = true;
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    try { video.currentTime = 0; } catch (err) { /* ignore */ }

    let revealed = false;
    const reveal = () => {
      if (revealed) return;
      revealed = true;
      window.clearTimeout(failSafe);
      video.classList.add('is-behind');
      video.removeEventListener('timeupdate', onTime);
      if (typeof onReveal === 'function') onReveal();
    };

    const onTime = () => {
      if (video.currentTime >= revealAt) reveal();
    };

    video.addEventListener('timeupdate', onTime);
    video.addEventListener('ended', reveal, { once: true });
    video.addEventListener('error', reveal, { once: true });
    const failSafe = window.setTimeout(reveal, Math.round((revealAt + 0.85) * 1000));

    const p = video.play();
    if (p && typeof p.catch === 'function') {
      p.catch(() => {
        const again = video.play();
        if (again && typeof again.catch === 'function') {
          again.catch(() => { /* failSafe still running */ });
        }
      });
    }
  }

  w.SymvoliaArchiveFlow = { play, REVEAL_AT };
})(window);
