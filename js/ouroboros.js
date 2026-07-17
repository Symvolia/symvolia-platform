/**
 * Symvolia — Living Ouroboros.
 *
 * A hypnotic, meditative loop rendered on Canvas 2D, reusing the site's
 * photorealistic two-serpent ring (assets/ouroboros-photo.png) so the style
 * stays identical to the rest of the site.
 *
 * Choreography (loops forever after a one-time emergence):
 *   1. Emergence  — the ring rises from the dark (fade + zoom + glow ramp).
 *   2. Orbit      — slow rotation around the central sigil, organic breathing.
 *   3. Formation  — the ring tightens and accelerates, glow rising.
 *   4. The bite   — a golden particle burst + energy aura + glow peak, then a
 *                   deliberate slow-down and a short contemplative hold.
 *   5. Return     — eases back to the orbit speed, seamlessly, and loops.
 *
 * Everything is tunable through CONFIG. The rotation speeds are intentionally
 * slower than a literal "50 RPM" (which would look frantic) to keep the mood
 * meditative — raise CONFIG.baseRPM etc. if you want it faster.
 */
(function () {
  'use strict';

  const canvas = document.getElementById('ouroborosCanvas');
  const stage = document.getElementById('stage');
  if (!canvas || !stage) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // ── Tunables ──
  const CONFIG = {
    emergeMs: 1500, // one-time rise from the dark
    cycleMs: 5000, // full loop (phases 2→5)
    // Rotation, in revolutions per minute (kept meditative on purpose).
    baseRPM: 7, // orbit
    peakRPM: 18, // formation peak
    slowRPM: 2.5, // the bite / hold
    direction: 1, // 1 clockwise, -1 counter-clockwise
    ringScale: 0.6, // ring size relative to the canvas' min side
    gold: [212, 175, 55], // #d4af37
    goldBright: [255, 215, 0], // #FFD700
    audioReactive: false, // see note at the bottom
  };

  // Phase boundaries within a cycle (ms).
  const P = {
    orbitEnd: 2000, // 1.5s → 3.5s
    formEnd: 3500, // 3.5s → 5s
    biteEnd: 4300, // 5s → ~5.8s (slow-down)
    holdEnd: 4500, // short hold
    // 4500 → 5000 : return to base
  };
  const BITE_AT = 3550; // instant the jaws close

  // ── Easing ──
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
  const easeInCubic = (t) => t * t * t;
  const easeInOutCubic = (t) =>
    t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const clamp01 = (t) => Math.max(0, Math.min(1, t));
  const lerp = (a, b, t) => a + (b - a) * t;
  const rpmToRadPerMs = (rpm) => (rpm * 2 * Math.PI) / 60 / 1000;

  const gold = (a) => `rgba(${CONFIG.gold[0]},${CONFIG.gold[1]},${CONFIG.gold[2]},${a})`;
  const goldB = (a) =>
    `rgba(${CONFIG.goldBright[0]},${CONFIG.goldBright[1]},${CONFIG.goldBright[2]},${a})`;

  // ── Sizing (high-DPI) ──
  let W = 0;
  let H = 0;
  let cx = 0;
  let cy = 0;
  let minDim = 0;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.max(1, rect.width);
    H = Math.max(1, rect.height);
    cx = W / 2;
    cy = H / 2;
    minDim = Math.min(W, H);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // ── Ring image ──
  const ring = new Image();
  let ringReady = false;
  ring.src = 'assets/ouroboros-photo.png?v=1';
  ring.onload = () => {
    ringReady = true;
  };

  // ── Deep-space dust (subtle, static field with slow twinkle) ──
  const dust = [];
  (function buildDust() {
    let seed = 7;
    const rnd = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    for (let i = 0; i < 46; i += 1) {
      dust.push({
        x: rnd(),
        y: rnd(),
        r: 0.4 + rnd() * 1.3,
        a: 0.04 + rnd() * 0.10,
        tw: rnd() * Math.PI * 2,
      });
    }
  })();

  // ── Bite particles ──
  const particles = [];
  function spawnBurst(x, y) {
    const n = 5 + Math.floor(Math.random() * 2); // 5–6, restrained
    for (let i = 0; i < n; i += 1) {
      const ang = (i / n) * Math.PI * 2 + Math.random() * 0.5;
      const speed = (0.06 + Math.random() * 0.09) * minDim; // px per sec
      particles.push({
        x,
        y,
        vx: Math.cos(ang) * speed,
        vy: Math.sin(ang) * speed,
        life: 0,
        ttl: 380 + Math.random() * 220,
        r: 1.5 + Math.random() * 2.5,
      });
    }
  }

  // ── Angular velocity as a function of global time ──
  function velAt(t) {
    const base = rpmToRadPerMs(CONFIG.baseRPM);
    const peak = rpmToRadPerMs(CONFIG.peakRPM);
    const slow = rpmToRadPerMs(CONFIG.slowRPM);

    if (t < CONFIG.emergeMs) {
      return base * easeOutCubic(t / CONFIG.emergeMs);
    }
    const lt = (t - CONFIG.emergeMs) % CONFIG.cycleMs;

    if (lt < P.orbitEnd) {
      // Gentle ±10% sinusoidal variation (the "breathing" of the dance).
      const wobble = 1 + 0.1 * Math.sin((t / 1000) * 1.4);
      return base * wobble;
    }
    if (lt < P.formEnd) {
      return lerp(base, peak, easeInCubic((lt - P.orbitEnd) / (P.formEnd - P.orbitEnd)));
    }
    if (lt < P.biteEnd) {
      return lerp(peak, slow, easeOutCubic((lt - P.formEnd) / (P.biteEnd - P.formEnd)));
    }
    if (lt < P.holdEnd) {
      return slow;
    }
    return lerp(slow, base, easeInOutCubic((lt - P.holdEnd) / (CONFIG.cycleMs - P.holdEnd)));
  }

  // ── Scale (tighten during formation, relax on return) ──
  function scaleAt(t) {
    let s = 1;
    if (t >= CONFIG.emergeMs) {
      const lt = (t - CONFIG.emergeMs) % CONFIG.cycleMs;
      if (lt < P.orbitEnd) s = 1;
      else if (lt < P.formEnd) s = lerp(1, 0.95, easeInOutCubic((lt - P.orbitEnd) / (P.formEnd - P.orbitEnd)));
      else if (lt < P.holdEnd) s = 0.95;
      else s = lerp(0.95, 1, easeInOutCubic((lt - P.holdEnd) / (CONFIG.cycleMs - P.holdEnd)));
    }
    // Always-on meditative breathing.
    s *= 1 + 0.03 * Math.sin((t / 1000) * (Math.PI * 2) / 4);
    return s;
  }

  // ── Serpent luminescence — subtle & constant (no breathing / no pulsing).
  //    Kept in the 0.35–0.5 range: shadow-and-mystery, not "magical glow".
  function glowAt(t) {
    if (t < CONFIG.emergeMs) return 0.35 * easeOutCubic(t / CONFIG.emergeMs);
    const lt = (t - CONFIG.emergeMs) % CONFIG.cycleMs;
    if (lt < P.formEnd) return 0.35;
    // A restrained, elegant rise toward the bite.
    if (lt < BITE_AT + 250) return lerp(0.35, 0.5, clamp01((lt - P.formEnd) / (BITE_AT + 250 - P.formEnd)));
    if (lt < P.holdEnd) return lerp(0.5, 0.4, clamp01((lt - (BITE_AT + 250)) / (P.holdEnd - (BITE_AT + 250))));
    return lerp(0.4, 0.35, easeInOutCubic((lt - P.holdEnd) / (CONFIG.cycleMs - P.holdEnd)));
  }

  // Emergence alpha (one-time rise) and zoom.
  function emergeAlpha(t) {
    return t < CONFIG.emergeMs ? easeOutCubic(t / CONFIG.emergeMs) : 1;
  }
  function emergeScale(t) {
    return t < CONFIG.emergeMs ? lerp(0.7, 1, easeOutCubic(t / CONFIG.emergeMs)) : 1;
  }

  // ── Render one frame ──
  let angle = 0;
  let lastTs = 0;
  let startTs = 0;
  let lastBurstCycle = -1;

  function frame(ts) {
    if (!startTs) {
      startTs = ts;
      lastTs = ts;
    }
    const t = ts - startTs;
    const dt = Math.min(64, ts - lastTs);
    lastTs = ts;

    // Advance rotation by integrating angular velocity (seamless, no snaps).
    angle += CONFIG.direction * velAt(t) * dt;

    const s = scaleAt(t) * emergeScale(t);
    const glow = glowAt(t);
    const alpha = emergeAlpha(t);

    draw(t, s, glow, alpha, dt);

    raf = requestAnimationFrame(frame);
  }

  function draw(t, s, glow, alpha, dt) {
    ctx.clearRect(0, 0, W, H);

    // 1) Deep-space dust.
    dust.forEach((d) => {
      const tw = 0.6 + 0.4 * Math.sin(t * 0.001 + d.tw);
      ctx.fillStyle = `rgba(200,200,215,${(d.a * tw * alpha).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(d.x * W, d.y * H, d.r, 0, Math.PI * 2);
      ctx.fill();
    });

    const ringSize = minDim * CONFIG.ringScale * s;
    const ringR = ringSize * 0.46; // radius of the serpent path

    // 2) Sigil glimmer — a barely-there constant glow at the very centre.
    //    (No rotating aura, no breathing halo — just a faint, still presence.)
    const glimmer = ctx.createRadialGradient(cx, cy, 0, cx, cy, ringR * 0.42);
    glimmer.addColorStop(0, gold(0.05 * alpha));
    glimmer.addColorStop(0.6, gold(0.02 * alpha));
    glimmer.addColorStop(1, gold(0));
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = glimmer;
    ctx.beginPath();
    ctx.arc(cx, cy, ringR * 0.42, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 3) The ring itself — rotated, scaled, with a SUBTLE golden glow that only
    //    hugs the serpents' silhouette (no light around it).
    if (ringReady) {
      ctx.save();
      ctx.globalAlpha = alpha * 0.98;
      ctx.translate(cx, cy);
      ctx.rotate(angle);
      ctx.shadowColor = gold(0.22 + glow * 0.28);
      ctx.shadowBlur = (8 + glow * 10) * (minDim / 600);
      ctx.drawImage(ring, -ringSize / 2, -ringSize / 2, ringSize, ringSize);
      ctx.restore();
    }

    // 5) Highlight sweep — a soft specular running along the body.
    const sweepAng = angle * 1.6 + t * 0.0016;
    const hx = cx + Math.cos(sweepAng) * ringR;
    const hy = cy + Math.sin(sweepAng) * ringR;
    const sweepA = 0.18 + 0.22 * (0.5 + 0.5 * Math.sin(t * 0.002));
    const sweep = ctx.createRadialGradient(hx, hy, 0, hx, hy, ringR * 0.4);
    sweep.addColorStop(0, `rgba(240,240,240,${(sweepA * alpha).toFixed(3)})`);
    sweep.addColorStop(1, 'rgba(240,240,240,0)');
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = sweep;
    ctx.beginPath();
    ctx.arc(hx, hy, ringR * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 6) The bite — spawn once per cycle at BITE_AT, at the serpents' heads
    //    (top of the source image, carried around by the rotation).
    if (t >= CONFIG.emergeMs) {
      const lt = (t - CONFIG.emergeMs) % CONFIG.cycleMs;
      const cycleIdx = Math.floor((t - CONFIG.emergeMs) / CONFIG.cycleMs);
      const headAng = angle - Math.PI / 2;
      const headX = cx + Math.cos(headAng) * ringR;
      const headY = cy + Math.sin(headAng) * ringR;

      if (lt >= BITE_AT && cycleIdx !== lastBurstCycle) {
        lastBurstCycle = cycleIdx;
        spawnBurst(headX, headY);
      }

      // Contact flash right after the bite — reduced, elegant.
      const sinceBite = lt - BITE_AT;
      if (sinceBite >= 0 && sinceBite < 360) {
        const k = 1 - sinceBite / 360;
        const fr = ringR * 0.24 * (1.1 - k * 0.4);
        const flash = ctx.createRadialGradient(headX, headY, 0, headX, headY, fr);
        flash.addColorStop(0, goldB(0.4 * k * alpha));
        flash.addColorStop(0.5, gold(0.18 * k * alpha));
        flash.addColorStop(1, gold(0));
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = flash;
        ctx.beginPath();
        ctx.arc(headX, headY, fr, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    // 7) Update + draw particles.
    if (particles.length) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = particles.length - 1; i >= 0; i -= 1) {
        const pt = particles[i];
        pt.life += dt;
        if (pt.life >= pt.ttl) {
          particles.splice(i, 1);
          continue;
        }
        const k = pt.life / pt.ttl;
        pt.x += (pt.vx * dt) / 1000;
        pt.y += (pt.vy * dt) / 1000;
        const a = (1 - k) * alpha;
        const pr = pt.r * (1 - k * 0.5);
        const g = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, pr * 3);
        g.addColorStop(0, goldB(0.9 * a));
        g.addColorStop(0.5, gold(0.5 * a));
        g.addColorStop(1, gold(0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pr * 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  // ── Static single frame (reduced motion) ──
  function drawStatic() {
    resize();
    if (!ringReady) {
      ring.onload = drawStatic;
      return;
    }
    const ringSize = minDim * CONFIG.ringScale;
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.shadowColor = gold(0.4);
    ctx.shadowBlur = 16 * (minDim / 600);
    ctx.drawImage(ring, -ringSize / 2, -ringSize / 2, ringSize, ringSize);
    ctx.restore();
  }

  // ── Boot: start the choreography when the composition awakens ──
  let raf = 0;
  let started = false;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function start() {
    if (started) return;
    started = true;
    resize();
    if (reduced) {
      drawStatic();
      return;
    }
    startTs = 0;
    lastTs = 0;
    raf = requestAnimationFrame(frame);
  }

  function isAlive() {
    return stage.classList.contains('stage--alive');
  }

  window.addEventListener('resize', () => {
    resize();
    if (reduced && started) drawStatic();
  });

  if (isAlive()) {
    start();
  } else {
    const observer = new MutationObserver(() => {
      if (isAlive()) {
        observer.disconnect();
        start();
      }
    });
    observer.observe(stage, { attributes: true, attributeFilter: ['class'] });
  }

  /*
   * Audio-reactivity (optional):
   * Left off by default so it can never interfere with the site's existing
   * audio pipeline (crossfade + mute in main.js). To enable, route
   * #stageAmbient through an AnalyserNode created on the first user gesture and
   * feed its bass energy into `glowAt` / `velAt`. The time-based pulsing above
   * already gives a convincingly "alive", breathing motion without it.
   */
})();
