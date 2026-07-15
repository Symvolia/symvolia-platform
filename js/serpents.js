(function () {
  'use strict';

  const canvas = document.getElementById('serpentCanvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Braid parameters
  const TWISTS = 11;          // number of over/under crossings around the ring
  const SAMPLES = 520;        // resolution around the ring
  const AMP_RATIO = 0.066;    // helix amplitude relative to half-size
  const R_RATIO = 0.70;       // mean radius relative to half-size
  const WIDTH_RATIO = 0.052;  // body thickness relative to half-size

  // Two distinct serpents
  const SERPENT_A = [206, 199, 186]; // pale silver
  const SERPENT_B = [156, 128, 82];  // desaturated bronze
  const DARK = [10, 9, 8];

  let dpr = Math.min(window.devicePixelRatio || 1, 2);
  let cssSize = 0;
  let cx = 0;
  let cy = 0;
  let half = 0;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    cssSize = Math.min(rect.width, rect.height);
    if (cssSize <= 0) return;

    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    cx = rect.width / 2;
    cy = rect.height / 2;
    half = cssSize / 2;
  }

  const TWO_PI = Math.PI * 2;

  function tone(base, brightness) {
    const r = Math.min(255, base[0] * brightness) | 0;
    const g = Math.min(255, base[1] * brightness) | 0;
    const b = Math.min(255, base[2] * brightness) | 0;
    return `rgb(${r}, ${g}, ${b})`;
  }

  // Build continuous arcs for both serpents, split at over/under crossings.
  function buildArcs(phase, rot) {
    const Rmean = half * R_RATIO;
    const Amp = half * AMP_RATIO;
    const arcs = [];

    for (let s = 0; s < 2; s++) {
      const strandPhase = phase + s * Math.PI;
      let current = null;
      let prevFront = null;

      for (let i = 0; i <= SAMPLES; i++) {
        const u = (i / SAMPLES) * TWO_PI;
        const depth = Math.sin(TWISTS * u + strandPhase); // -1 .. 1
        const front = depth >= 0;
        const r = Rmean + Amp * depth;
        const a = u + rot;
        const pt = {
          x: cx + r * Math.cos(a),
          y: cy + r * Math.sin(a),
          depth,
        };

        if (prevFront === null || front === prevFront) {
          if (!current) current = { strand: s, front, pts: [], peak: 0 };
          current.pts.push(pt);
          current.peak = Math.max(current.peak, Math.abs(depth));
        } else {
          // crossing: close current arc at the meeting point, start a new one
          current.pts.push(pt);
          arcs.push(current);
          current = { strand: s, front, pts: [pt], peak: Math.abs(depth) };
        }
        prevFront = front;
      }
      if (current && current.pts.length > 1) arcs.push(current);
    }

    // Draw back arcs first, then front arcs (correct over/under)
    arcs.sort((a, b) => (a.front === b.front ? 0 : a.front ? 1 : -1));
    return arcs;
  }

  function strokeArc(pts, width, style) {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.lineWidth = width;
    ctx.strokeStyle = style;
    ctx.stroke();
  }

  function render(phase, rot) {
    if (half <= 0) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const arcs = buildArcs(phase, rot);
    const baseW = half * WIDTH_RATIO;

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (let i = 0; i < arcs.length; i++) {
      const arc = arcs[i];
      if (arc.pts.length < 2) continue;

      const w = baseW * (arc.front ? 1.0 : 0.82);
      const brightness = arc.front ? 1.0 : 0.6;
      const base = arc.strand === 0 ? SERPENT_A : SERPENT_B;

      // dark contour for depth separation
      strokeArc(arc.pts, w + baseW * 0.55, `rgba(${DARK[0]}, ${DARK[1]}, ${DARK[2]}, ${arc.front ? 0.7 : 0.85})`);
      // serpent body
      strokeArc(arc.pts, w, tone(base, brightness));
      // rounded volume: inner darker + specular highlight for front arcs
      strokeArc(arc.pts, w * 0.62, tone(base, brightness * 1.12));
      if (arc.front) {
        strokeArc(arc.pts, w * 0.26, `rgba(244, 240, 231, 0.22)`);
      }
    }
  }

  let rafId = null;
  let startTime = null;

  function frame(now) {
    if (startTime === null) startTime = now;
    const t = (now - startTime) / 1000;

    const phase = t * 1.05;   // spiral travel speed (weaving)
    const rot = t * 0.11;     // slow overall rotation

    render(phase, rot);
    rafId = window.requestAnimationFrame(frame);
  }

  function start() {
    resize();
    if (reducedMotion) {
      render(0, 0);
      return;
    }
    if (rafId === null) {
      rafId = window.requestAnimationFrame(frame);
    }
  }

  let resizeTimer = null;
  window.addEventListener('resize', () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      resize();
      if (reducedMotion) render(0, 0);
    }, 150);
  });

  // Pause when tab hidden to save resources
  document.addEventListener('visibilitychange', () => {
    if (reducedMotion) return;
    if (document.hidden) {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
        rafId = null;
      }
    } else if (rafId === null) {
      startTime = null;
      rafId = window.requestAnimationFrame(frame);
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
