/**
 * Symvolia — Cinematic eye-opening intro ("Requiem for a Dream" mood).
 *
 * Extreme close-up of an eye: the lids open, the iris (black → deep blue →
 * violet) breathes with organic tremor, wet cornea highlights sweep across it,
 * red-grey veins pulse in the corners, and the pupil dilates until it swallows
 * the whole screen. From the depth of the pupil the golden Symvolia sigil
 * emerges, then everything fades to black and the crisp logo appears before the
 * overlay dissolves into the site.
 *
 * Tech: Canvas 2D (light, fully controllable, high-DPI aware).
 * Autoplay once · skippable (click / Enter) · respects reduced motion.
 */
(function () {
  'use strict';

  const intro = document.getElementById('intro');
  const canvas = document.getElementById('introCanvas');
  const skipBtn = document.getElementById('introSkip');
  if (!intro || !canvas) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    intro.classList.add('is-done');
    return;
  }

  // ── Timeline (ms). Tuned to hand off to the site right as its own
  //    tagline + Enter become ready underneath. ──
  const DURATION = 3800; // eye animation
  const LOGO_HOLD = 700; // black + logo before dissolving

  // Normalized milestones (fractions of DURATION).
  const T = {
    lidsOpen: [0.04, 0.34],
    dilate: [0.22, 0.70], // natural slow dilation
    fill: [0.66, 0.94], // pupil expands to fill the screen
    sigil: [0.5, 0.96], // sigil emerging from the depth
    blackout: [0.88, 1.0],
  };

  // ── Easing helpers ──
  const easeInOutSine = (t) => -(Math.cos(Math.PI * t) - 1) / 2;
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
  const easeInCubic = (t) => t * t * t;
  const easeInOutCubic = (t) =>
    t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const lerp = (a, b, t) => a + (b - a) * t;
  // Normalize `t` inside a [start,end] window to 0..1.
  const win = (t, a, b) => Math.max(0, Math.min(1, (t - a) / (b - a)));

  // ── Sizing (high-DPI) ──
  let W = 0;
  let H = 0;
  let cx = 0;
  let cy = 0;
  let minDim = 0;
  let diag = 0;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    cx = W / 2;
    cy = H / 2;
    minDim = Math.min(W, H);
    diag = Math.hypot(W, H);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  window.addEventListener('resize', resize);

  // ── Golden sigil (tinted offscreen copy of the logo) ──
  let sigil = null; // offscreen canvas, golden
  const logoImg = new Image();
  logoImg.src = 'assets/logo.png';
  logoImg.onload = () => {
    const s = 512;
    const off = document.createElement('canvas');
    off.width = s;
    off.height = s;
    const octx = off.getContext('2d');
    octx.drawImage(logoImg, 0, 0, s, s);
    // The logo has a dark opaque background, so we rebuild it as a golden
    // sigil: brightness → alpha (dark bg becomes transparent), lines → gold.
    try {
      const img = octx.getImageData(0, 0, s, s);
      const px = img.data;
      for (let i = 0; i < px.length; i += 4) {
        const lum = (px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114) / 255;
        px[i] = 255; // R
        px[i + 1] = 205; // G
        px[i + 2] = 110; // B  → warm gold
        px[i + 3] = Math.round(255 * Math.pow(lum, 1.15));
      }
      octx.putImageData(img, 0, 0);
    } catch (err) {
      /* getImageData blocked — fall back to raw logo */
    }
    sigil = off;
  };

  // ── Deterministic pseudo-random veins so they don't jitter each frame ──
  const veins = [];
  (function buildVeins() {
    let seed = 1337;
    const rnd = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    for (let i = 0; i < 14; i += 1) {
      const side = i % 2 === 0 ? -1 : 1; // left / right corner
      veins.push({
        side,
        y: 0.15 + rnd() * 0.7, // vertical position (0..1 of H)
        spread: 0.4 + rnd() * 0.8,
        wob: rnd() * Math.PI * 2,
        w: 0.6 + rnd() * 1.6,
        a: 0.05 + rnd() * 0.12,
      });
    }
  })();

  // ── Render one frame at normalized progress p (0..1) ──
  function draw(p, now) {
    const lids = easeOutCubic(win(p, T.lidsOpen[0], T.lidsOpen[1]));
    const dilate = easeInOutSine(win(p, T.dilate[0], T.dilate[1]));
    const fill = easeInCubic(win(p, T.fill[0], T.fill[1]));
    const sig = easeOutCubic(win(p, T.sigil[0], T.sigil[1]));
    const black = easeInOutCubic(win(p, T.blackout[0], T.blackout[1]));

    // Organic tremor + slow drift.
    const trAmp = minDim * 0.004 * (1 - fill);
    const dx = Math.sin(now * 0.0021) * trAmp + (Math.random() - 0.5) * trAmp * 0.5;
    const dy = Math.cos(now * 0.0017) * trAmp + (Math.random() - 0.5) * trAmp * 0.5;
    const px = cx + dx;
    const py = cy + dy;

    // Camera push-in (zoom) toward the pupil.
    const zoom = lerp(1, 1.55, easeInCubic(p));

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#010101';
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(zoom, zoom);
    ctx.translate(-cx, -cy);

    const eyeR = minDim * 0.66;
    // Pupil radius: natural dilation, then explosive fill.
    let pupilR = eyeR * lerp(0.12, 0.34, dilate);
    if (fill > 0) pupilR = lerp(eyeR * 0.34, diag * 1.35, fill);

    // 1) Sclera base (dark, faintly warm) behind the eyeball.
    const scler = ctx.createRadialGradient(px, py, eyeR * 0.6, px, py, eyeR * 1.5);
    scler.addColorStop(0, '#171310');
    scler.addColorStop(0.6, '#0d0a08');
    scler.addColorStop(1, '#040303');
    ctx.fillStyle = scler;
    ctx.fillRect(0, 0, W, H);

    // 2) Red-grey veins in the corners (organic, subtly pulsing).
    const pulse = 0.85 + 0.15 * Math.sin(now * 0.004);
    veins.forEach((v) => {
      const startX = v.side < 0 ? -10 : W + 10;
      const startY = H * v.y;
      const endX = px - v.side * eyeR * 0.95;
      const endY = py + (v.y - 0.5) * H * 0.5;
      const midX = (startX + endX) / 2;
      const midY = (startY + endY) / 2 + Math.sin(v.wob + now * 0.0009) * H * 0.06 * v.spread;
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.quadraticCurveTo(midX, midY, endX, endY);
      ctx.strokeStyle = `rgba(150, 46, 42, ${(v.a * pulse).toFixed(3)})`;
      ctx.lineWidth = v.w * zoom;
      ctx.stroke();
    });

    // 3) Iris — radial gradient black → deep blue → violet, with fibers.
    ctx.save();
    ctx.beginPath();
    ctx.arc(px, py, eyeR, 0, Math.PI * 2);
    ctx.clip();

    const iris = ctx.createRadialGradient(px, py, pupilR * 0.7, px, py, eyeR);
    iris.addColorStop(0, '#000000');
    iris.addColorStop(0.16, '#04060f');
    iris.addColorStop(0.44, '#0a1738'); // deep blue
    iris.addColorStop(0.7, '#241046'); // deep violet
    iris.addColorStop(0.88, '#150a26');
    iris.addColorStop(1, '#050409');
    ctx.fillStyle = iris;
    ctx.fillRect(px - eyeR, py - eyeR, eyeR * 2, eyeR * 2);

    // Iris fibers (thin radial strokes for depth).
    const fibers = 130;
    for (let i = 0; i < fibers; i += 1) {
      const ang = (i / fibers) * Math.PI * 2 + Math.sin(i * 12.9) * 0.04;
      const r0 = pupilR + eyeR * 0.02;
      const r1 = eyeR * (0.82 + (Math.sin(i * 7.7) * 0.5 + 0.5) * 0.16);
      const bright = 0.04 + (Math.sin(i * 3.3) * 0.5 + 0.5) * 0.08;
      ctx.beginPath();
      ctx.moveTo(px + Math.cos(ang) * r0, py + Math.sin(ang) * r0);
      ctx.lineTo(px + Math.cos(ang) * r1, py + Math.sin(ang) * r1);
      ctx.strokeStyle = `rgba(120, 140, 210, ${bright.toFixed(3)})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Rotating shine sweep across the iris (light travelling through).
    const sweepAng = now * 0.0012;
    const sweep = ctx.createLinearGradient(
      px + Math.cos(sweepAng) * -eyeR,
      py + Math.sin(sweepAng) * -eyeR,
      px + Math.cos(sweepAng) * eyeR,
      py + Math.sin(sweepAng) * eyeR
    );
    sweep.addColorStop(0, 'rgba(120, 150, 255, 0)');
    sweep.addColorStop(0.5, `rgba(150, 175, 255, ${(0.10 * (1 - fill)).toFixed(3)})`);
    sweep.addColorStop(1, 'rgba(120, 150, 255, 0)');
    ctx.fillStyle = sweep;
    ctx.fillRect(px - eyeR, py - eyeR, eyeR * 2, eyeR * 2);

    // Limbal ring (dark rim around the iris).
    ctx.beginPath();
    ctx.arc(px, py, eyeR * 0.98, 0, Math.PI * 2);
    ctx.lineWidth = eyeR * 0.06;
    ctx.strokeStyle = 'rgba(2, 2, 6, 0.85)';
    ctx.stroke();
    ctx.restore();

    // 4) Pupil (black), with faint golden depth where the sigil lives.
    const pupilGrad = ctx.createRadialGradient(px, py, 0, px, py, pupilR);
    pupilGrad.addColorStop(0, '#000000');
    pupilGrad.addColorStop(0.75, '#000000');
    pupilGrad.addColorStop(1, 'rgba(20, 12, 4, 1)');
    ctx.fillStyle = pupilGrad;
    ctx.beginPath();
    ctx.arc(px, py, pupilR, 0, Math.PI * 2);
    ctx.fill();

    // 5) Sigil emerging from the depth of the pupil.
    if (sigil && sig > 0) {
      const maxSize = minDim * (fill > 0 ? lerp(0.34, 0.62, fill) : 0.34);
      const size = maxSize * lerp(0.04, 1, sig);
      const alpha = Math.min(1, sig * 1.2) * (1 - black * 0.15);
      // Golden glow halo.
      const halo = ctx.createRadialGradient(px, py, 0, px, py, size * 0.85);
      halo.addColorStop(0, `rgba(255, 205, 110, ${(0.5 * alpha).toFixed(3)})`);
      halo.addColorStop(0.5, `rgba(210, 150, 60, ${(0.22 * alpha).toFixed(3)})`);
      halo.addColorStop(1, 'rgba(120, 80, 30, 0)');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(px, py, size * 0.85, 0, Math.PI * 2);
      ctx.fill();
      // Sigil image.
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.drawImage(sigil, px - size / 2, py - size / 2, size, size);
      ctx.restore();
    }

    // 6) Wet cornea highlights (specular reflections), fading as we dive in.
    if (fill < 0.9) {
      const hlA = (1 - fill) * (0.4 + 0.3 * lids);
      const hx = px - eyeR * 0.32;
      const hy = py - eyeR * 0.34;
      const soft = ctx.createRadialGradient(hx, hy, 0, hx, hy, eyeR * 0.5);
      soft.addColorStop(0, `rgba(255, 255, 255, ${(0.22 * hlA).toFixed(3)})`);
      soft.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = soft;
      ctx.beginPath();
      ctx.arc(hx, hy, eyeR * 0.5, 0, Math.PI * 2);
      ctx.fill();

      const sx = px + eyeR * 0.24;
      const sy = py - eyeR * 0.42;
      const sharp = ctx.createRadialGradient(sx, sy, 0, sx, sy, eyeR * 0.12);
      sharp.addColorStop(0, `rgba(255, 255, 255, ${(0.5 * hlA).toFixed(3)})`);
      sharp.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = sharp;
      ctx.beginPath();
      ctx.arc(sx, sy, eyeR * 0.12, 0, Math.PI * 2);
      ctx.fill();
    }

    // 7) Eyelids opening (skin from top & bottom, with lash line + waterline).
    if (lids < 1 && fill < 0.5) {
      const open = lerp(-eyeR * 0.18, eyeR * 1.3, lids);
      const curve = eyeR * 0.42;
      drawLid(px, py - open, -1, curve);
      drawLid(px, py + open, 1, curve);
    }

    ctx.restore(); // undo zoom

    // 8) Vignette.
    const vig = ctx.createRadialGradient(cx, cy, minDim * 0.35, cx, cy, diag * 0.62);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.7)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);

    // 9) Final blackout.
    if (black > 0) {
      ctx.fillStyle = `rgba(1, 1, 1, ${black.toFixed(3)})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  // Draw an eyelid as a curved skin flap. dir = -1 upper, +1 lower.
  function drawLid(originX, edgeY, dir, curve) {
    const skin = ctx.createLinearGradient(0, edgeY - dir * H * 0.5, 0, edgeY);
    skin.addColorStop(0, '#0b0705');
    skin.addColorStop(0.7, '#1a0e0a');
    skin.addColorStop(1, '#2a120c');
    ctx.fillStyle = skin;
    ctx.beginPath();
    if (dir < 0) {
      ctx.moveTo(-W, -H);
      ctx.lineTo(W * 2, -H);
      ctx.lineTo(W * 2, edgeY);
      ctx.quadraticCurveTo(originX, edgeY + curve, -W, edgeY);
    } else {
      ctx.moveTo(-W, H * 2);
      ctx.lineTo(W * 2, H * 2);
      ctx.lineTo(W * 2, edgeY);
      ctx.quadraticCurveTo(originX, edgeY - curve, -W, edgeY);
    }
    ctx.closePath();
    ctx.fill();

    // Waterline (wet reddish rim) + lash shadow along the margin.
    ctx.beginPath();
    ctx.moveTo(-W, edgeY);
    ctx.quadraticCurveTo(originX, edgeY + dir * curve, W * 2, edgeY);
    ctx.lineWidth = Math.max(2, minDim * 0.01);
    ctx.strokeStyle = 'rgba(120, 40, 36, 0.55)';
    ctx.stroke();
    ctx.lineWidth = Math.max(3, minDim * 0.02);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.stroke();
  }

  // ── Playback loop ──
  let raf = 0;
  let startTs = 0;
  let finished = false;

  function frame(ts) {
    if (!startTs) startTs = ts;
    const elapsed = ts - startTs;
    const p = Math.min(1, elapsed / DURATION);
    draw(p, elapsed);
    if (p >= 1) {
      finish();
      return;
    }
    raf = requestAnimationFrame(frame);
  }

  function finish() {
    if (finished) return;
    finished = true;
    cancelAnimationFrame(raf);
    cleanupInput();
    // Crisp logo appears on black, then the overlay dissolves into the site.
    intro.classList.add('show-logo');
    window.setTimeout(() => {
      intro.classList.add('is-done');
      document.documentElement.classList.remove('is-intro');
      window.setTimeout(() => {
        if (intro && intro.parentNode) intro.parentNode.removeChild(intro);
      }, 1300);
    }, LOGO_HOLD);
  }

  // ── Skip (click / Enter) ──
  function onKey(e) {
    if (e.key === 'Enter' || e.key === 'Escape' || e.key === ' ') {
      e.preventDefault();
      e.stopImmediatePropagation();
      finish();
    }
  }
  function onClick() {
    finish();
  }
  function cleanupInput() {
    document.removeEventListener('keydown', onKey, true);
    intro.removeEventListener('click', onClick);
    if (skipBtn) skipBtn.removeEventListener('click', onClick);
  }

  // ── Debug hook: ?introdebug lets you render a specific frame manually ──
  if (/introdebug/.test(window.location.search)) {
    window.__introDraw = (p) => draw(p, p * DURATION);
    window.__introDraw(0);
    return;
  }

  // ── Boot ──
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) {
    intro.classList.add('is-done');
    document.documentElement.classList.remove('is-intro');
    window.setTimeout(() => {
      if (intro && intro.parentNode) intro.parentNode.removeChild(intro);
    }, 400);
    return;
  }

  document.addEventListener('keydown', onKey, true);
  intro.addEventListener('click', onClick);
  if (skipBtn) {
    skipBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      onClick();
    });
  }

  // Safety net: never leave the overlay stuck.
  window.setTimeout(() => {
    if (!finished) finish();
  }, DURATION + 2500);

  try {
    raf = requestAnimationFrame(frame);
  } catch (err) {
    finish();
  }
})();
