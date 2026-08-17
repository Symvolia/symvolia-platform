/**
 * Sound Archive hub — background bed from YouTube (Sanctum · Raman Yermalayeu).
 * Starts only after the hub opens (symvolia:archive-open), inside the user gesture chain.
 */
(function (w) {
  'use strict';

  const VIDEO_ID = 'iOEz8ZdD_64';
  const MOUNT_ID = 'archiveHubAmbient';

  let player = null;
  let ready = false;
  let pendingPlay = false;
  let targetVolume = 50;
  let fadeTimer = 0;
  let apiLoading = false;

  function reduced() {
    return w.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function mount() {
    if (document.getElementById(MOUNT_ID)) return;
    const wrap = document.createElement('div');
    wrap.className = 'archive-hub-ambient';
    wrap.setAttribute('aria-hidden', 'true');
    const inner = document.createElement('div');
    inner.id = MOUNT_ID;
    wrap.appendChild(inner);
    document.body.appendChild(wrap);
  }

  function ensureApi(onReady) {
    if (w.YT && w.YT.Player) {
      onReady();
      return;
    }
    const prev = w.onYouTubeIframeAPIReady;
    w.onYouTubeIframeAPIReady = () => {
      if (typeof prev === 'function') prev();
      onReady();
    };
    if (apiLoading) return;
    apiLoading = true;
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    tag.async = true;
    document.head.appendChild(tag);
  }

  function initPlayer() {
    if (player || reduced()) return;
    mount();
    player = new w.YT.Player(MOUNT_ID, {
      videoId: VIDEO_ID,
      playerVars: {
        autoplay: 0,
        controls: 0,
        disablekb: 1,
        fs: 0,
        loop: 1,
        playlist: VIDEO_ID,
        modestbranding: 1,
        playsinline: 1,
        rel: 0,
        origin: w.location.origin,
      },
      events: {
        onReady: () => {
          ready = true;
          try { player.setVolume(0); } catch (err) { /* ignore */ }
          if (pendingPlay) internalPlay();
        },
        onStateChange: (e) => {
          if (e.data === w.YT.PlayerState.ENDED) {
            try {
              player.seekTo(0);
              player.playVideo();
            } catch (err) { /* ignore */ }
          }
        },
      },
    });
  }

  function clearFade() {
    if (fadeTimer) w.clearInterval(fadeTimer);
    fadeTimer = 0;
  }

  function fadeVolume(to, duration, onDone) {
    if (!player || !ready) {
      if (onDone) onDone();
      return;
    }
    clearFade();
    let start = 0;
    try { start = player.getVolume(); } catch (err) { /* ignore */ }
    const delta = to - start;
    const steps = Math.max(1, Math.round(duration / 40));
    let step = 0;

    fadeTimer = w.setInterval(() => {
      step += 1;
      const t = step / steps;
      const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      const vol = Math.round(start + delta * eased);
      try { player.setVolume(Math.min(100, Math.max(0, vol))); } catch (err) { /* ignore */ }
      if (step >= steps) {
        clearFade();
        try { player.setVolume(Math.min(100, Math.max(0, to))); } catch (err) { /* ignore */ }
        if (onDone) onDone();
      }
    }, 40);
  }

  function internalPlay() {
    pendingPlay = false;
    if (!player || !ready || reduced()) return;
    try {
      player.playVideo();
      fadeVolume(targetVolume, 1400);
    } catch (err) { /* ignore */ }
  }

  function play(volume, fadeMs) {
    if (reduced()) return;
    pendingPlay = true;
    targetVolume = Math.round(Math.min(1, Math.max(0, volume || 0.5)) * 100);
    ensureApi(() => {
      if (!player) initPlayer();
      else if (ready) internalPlay();
    });
  }

  function fadeOut(ms, onDone) {
    pendingPlay = false;
    if (!player || !ready) {
      if (onDone) onDone();
      return;
    }
    fadeVolume(0, ms || 720, () => {
      try { player.pauseVideo(); } catch (err) { /* ignore */ }
      if (onDone) onDone();
    });
  }

  function pause() {
    pendingPlay = false;
    clearFade();
    if (!player || !ready) return;
    try {
      player.pauseVideo();
      player.setVolume(0);
    } catch (err) { /* ignore */ }
  }

  function setMuted(next) {
    if (!player || !ready) return;
    try {
      if (next) {
        clearFade();
        player.pauseVideo();
      } else if (pendingPlay || document.documentElement.classList.contains('is-archive-open')) {
        internalPlay();
      }
    } catch (err) { /* ignore */ }
  }

  w.SymvoliaArchiveAmbient = {
    play,
    fadeOut,
    pause,
    setMuted,
    VIDEO_ID,
  };
})(window);
