/**
 * Symvolia — Alchemical black-hole void (canvas).
 * Cosmic horror meets Magnum Opus: event horizon, accretion disk,
 * logarithmic spirals, orbiting seals, and a slow cinematic pull inward.
 *
 * Exposed as window.SymvoliaVoid:
 *   start({ duration, onMid, interactive })
 *   stop()
 */
(function () {
  'use strict';

  const COLORS = {
    bg: '#0a0018',
    core: '#000000',
    glowInner: '#2a0850',
    gold: '#D4A017',
    crimson: '#B01030',
    mercury: '#D8D8D8',
    symbol: '#6B8F3C',
    hawking: '#FFFFFF',
    fog: 'rgba(42, 8, 80, 0.35)',
  };

  // Six seals of the Work, drawn with arcs and lines.
  const SYMBOLS = ['ouroboros', 'cross', 'triangle', 'mercury', 'sulfur', 'salt'];

  const LATIN_WORDS = [
    'SOLVE', 'ET', 'COAGULA', 'NIGREDO', 'ALBEDO', 'RUBEDO',
    'MAGNUM', 'OPUS', 'VISITA', 'INTERIORA', 'TERRAE',
  ];

  let canvas = null;
  let ctx = null;
  let running = false;
  let raf = 0;
  let startTs = 0;
  let width = 0;
  let height = 0;
  let cx = 0;
  let cy = 0;
  let dpr = 1;

  let particles = [];
  let stars = [];
  let symbols = [];
  let fragments = [];
  let fogArms = [];
  let shockwaves = [];
  let ghosts = [];

  let mouseX = 0;
  let mouseY = 0;
  let mouseLive = false;
  let zoom = 1;
  let breath = 0;
  let lastPulse = 0;
  let lastGhost = 0;
  let duration = 2800;
  let onMid = null;
  let midFired = false;
  let interactive = true;
  let particleBudget = 2800;

  function prefersReduced() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function rand(a, b) {
    return a + Math.random() * (b - a);
  }

  function pick(arr) {
    return arr[(Math.random() * arr.length) | 0];
  }

  function ensureCanvas() {
    const portal = document.getElementById('voidPortal');
    if (!portal) return null;

    canvas = document.getElementById('voidCanvas');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = 'voidCanvas';
      canvas.className = 'void__canvas';
      canvas.setAttribute('aria-hidden', 'true');
      portal.insertBefore(canvas, portal.firstChild);
    }
    ctx = canvas.getContext('2d', { alpha: false });
    return canvas;
  }

  function resize() {
    if (!canvas || !ctx) return;
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    width = Math.max(1, window.innerWidth);
    height = Math.max(1, window.innerHeight);
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
  }

  function beginFrame() {
    // Re-apply DPR every frame so external probes cannot leave the context skewed.
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /* ── Object pools ── */

  function makeParticle(forceOuter) {
    const angle = Math.random() * Math.PI * 2;
    const maxR = Math.hypot(width, height) * 0.55;
    const r = forceOuter ? rand(maxR * 0.55, maxR) : rand(maxR * 0.18, maxR);
    const kind = Math.random();
    let color = COLORS.gold;
    if (kind > 0.62) color = COLORS.crimson;
    else if (kind > 0.9) color = COLORS.mercury;

    return {
      alive: true,
      angle,
      r,
      baseR: r,
      // Logarithmic spiral: r = a * e^(bθ), advanced by winding θ each frame.
      spin: rand(0.35, 1.15) * (Math.random() < 0.5 ? 1 : -1),
      spiral: rand(0.012, 0.04),
      size: rand(1.2, 3.4),
      color,
      trail: Math.random() < 0.28,
      stretch: 1,
      life: 1,
      hawking: false,
    };
  }

  function resetParticle(p, outer) {
    const n = makeParticle(outer);
    Object.assign(p, n);
  }

  function makeStar() {
    return {
      x: Math.random() * width,
      y: Math.random() * height,
      z: rand(0.3, 1.4),
      phase: Math.random() * Math.PI * 2,
      size: rand(0.4, 1.6),
    };
  }

  function makeSymbol(i) {
    const orbit = 90 + i * 42 + rand(-8, 12);
    return {
      kind: SYMBOLS[i % SYMBOLS.length],
      orbit,
      angle: (i / SYMBOLS.length) * Math.PI * 2 + rand(-0.2, 0.2),
      speed: rand(0.08, 0.22) * (i % 2 === 0 ? 1 : -1),
      spin: rand(0.2, 0.7),
      rot: rand(0, Math.PI * 2),
      size: rand(16, 26),
      dissolve: 0,
    };
  }

  function makeFragment() {
    const angle = Math.random() * Math.PI * 2;
    const maxR = Math.hypot(width, height) * 0.5;
    return {
      angle,
      r: rand(maxR * 0.35, maxR),
      spin: rand(0.05, 0.18) * (Math.random() < 0.5 ? 1 : -1),
      spiral: rand(0.006, 0.018),
      w: rand(28, 54),
      h: rand(10, 18),
      rot: rand(0, Math.PI),
      word: pick(LATIN_WORDS),
      alpha: rand(0.18, 0.42),
    };
  }

  function seedScene() {
    const mobile = Math.min(width, height) < 720;
    particleBudget = mobile ? 900 : 2200;

    particles = [];
    for (let i = 0; i < particleBudget; i += 1) particles.push(makeParticle(false));

    stars = [];
    const starCount = mobile ? 120 : 220;
    for (let i = 0; i < starCount; i += 1) stars.push(makeStar());

    symbols = SYMBOLS.map((_, i) => makeSymbol(i));

    fragments = [];
    for (let i = 0; i < (mobile ? 8 : 14); i += 1) fragments.push(makeFragment());

    fogArms = [];
    for (let i = 0; i < 5; i += 1) {
      fogArms.push({
        angle: (i / 5) * Math.PI * 2,
        speed: rand(0.05, 0.12) * (i % 2 ? 1 : -1),
        width: rand(70, 140),
        length: rand(160, 280),
        alpha: rand(0.12, 0.28),
      });
    }

    shockwaves = [];
    ghosts = [];
    zoom = 1;
    breath = 0;
    lastPulse = 0;
    lastGhost = -4000;
    midFired = false;
  }

  /* ── Drawing helpers ── */

  function drawSymbol(kind, size) {
    ctx.save();
    ctx.strokeStyle = COLORS.gold;
    ctx.fillStyle = COLORS.symbol;
    ctx.lineWidth = 1.4;
    ctx.shadowColor = COLORS.symbol;
    ctx.shadowBlur = 10;

    if (kind === 'ouroboros') {
      ctx.beginPath();
      ctx.arc(0, 0, size, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(size * 0.72, 0, size * 0.22, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (kind === 'cross') {
      ctx.beginPath();
      ctx.moveTo(-size, 0);
      ctx.lineTo(size, 0);
      ctx.moveTo(0, -size);
      ctx.lineTo(0, size);
      ctx.stroke();
    } else if (kind === 'triangle') {
      ctx.beginPath();
      ctx.moveTo(0, -size);
      ctx.lineTo(size * 0.9, size * 0.75);
      ctx.lineTo(-size * 0.9, size * 0.75);
      ctx.closePath();
      ctx.stroke();
    } else if (kind === 'mercury') {
      ctx.beginPath();
      ctx.arc(0, -size * 0.15, size * 0.55, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, size * 0.4);
      ctx.lineTo(0, size);
      ctx.moveTo(-size * 0.35, size * 0.7);
      ctx.lineTo(size * 0.35, size * 0.7);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, -size * 0.85, size * 0.28, Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();
    } else if (kind === 'sulfur') {
      ctx.beginPath();
      ctx.moveTo(0, -size);
      ctx.lineTo(size * 0.85, size * 0.2);
      ctx.lineTo(-size * 0.85, size * 0.2);
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, size * 0.2);
      ctx.lineTo(0, size);
      ctx.moveTo(-size * 0.35, size * 0.65);
      ctx.lineTo(size * 0.35, size * 0.65);
      ctx.stroke();
    } else if (kind === 'salt') {
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-size * 0.7, 0);
      ctx.lineTo(size * 0.7, 0);
      ctx.stroke();
    }
    ctx.restore();
  }

  function horizonRadius(t) {
    // Holds as a readable hole for most of the dive, then swallows the frame.
    const base = Math.min(width, height) * 0.11;
    const swallow = Math.hypot(width, height) * 0.75;
    const linear = Math.min(1, t / Math.max(1, duration));
    // Ease-in cubic concentrated in the second half.
    const grow = linear < 0.45 ? linear * 0.25 : Math.pow((linear - 0.45) / 0.55, 1.35);
    const pulse = 1 + Math.sin(breath) * 0.045;
    return (base + (swallow - base) * Math.min(1, grow)) * pulse;
  }

  /* ── Frame ── */

  function update(dt, elapsed) {
    breath += dt * 2.1;
    zoom += dt * 0.018; // barely perceptible dread-zoom

    const hr = horizonRadius(elapsed);
    const absorbR = hr * 0.92;

    // Mouse gravity: stronger the closer the cursor sits to the void.
    let pullX = 0;
    let pullY = 0;
    if (interactive && mouseLive) {
      const mdx = mouseX - cx;
      const mdy = mouseY - cy;
      const md = Math.hypot(mdx, mdy) + 1;
      const nearVoid = 1 - Math.min(1, md / (Math.min(width, height) * 0.55));
      pullX = (mdx / md) * nearVoid * 28;
      pullY = (mdy / md) * nearVoid * 28;
    }

    for (let i = 0; i < particles.length; i += 1) {
      const p = particles[i];
      if (!p.alive) {
        resetParticle(p, true);
        continue;
      }

      // Logarithmic spiral inward: wind the angle, shrink radius.
      const haste = 1 + Math.pow(1 - Math.min(1, p.r / (p.baseR + 1)), 2.2) * 4.5;
      p.angle += p.spin * dt * haste;
      p.r -= p.r * p.spiral * haste * dt * 2.8;

      // Soft mouse tug.
      if (pullX || pullY) {
        const px = cx + Math.cos(p.angle) * p.r + pullX * dt * 8;
        const py = cy + Math.sin(p.angle) * p.r + pullY * dt * 8;
        p.angle = Math.atan2(py - cy, px - cx);
        p.r = Math.hypot(px - cx, py - cy);
      }

      // Spaghettification near the horizon.
      p.stretch = p.r < hr * 1.8 ? 1 + (1.8 - p.r / hr) * 2.4 : 1;

      if (p.r <= absorbR || p.r < 2) {
        if (p.hawking) {
          p.alive = false;
        } else {
          resetParticle(p, true);
        }
      }
    }

    for (let i = 0; i < symbols.length; i += 1) {
      const s = symbols[i];
      const haste = 1 + Math.max(0, 1 - s.orbit / 280) * 2.5;
      s.angle += s.speed * dt * haste;
      s.rot += s.spin * dt;
      s.orbit -= dt * 6.5 * haste;
      if (s.orbit < hr * 1.15) {
        s.dissolve += dt * 1.4;
        s.orbit = Math.max(hr * 0.95, s.orbit);
      }
      if (s.dissolve > 1) {
        // Respawn further out, still circling the Work.
        Object.assign(s, makeSymbol(i));
        s.orbit = rand(210, 320);
      }
    }

    for (let i = 0; i < fragments.length; i += 1) {
      const f = fragments[i];
      const haste = 1 + Math.pow(1 - Math.min(1, f.r / 400), 2) * 2;
      f.angle += f.spin * dt * haste;
      f.r -= f.r * f.spiral * haste * dt * 2.2;
      f.rot += dt * 0.15;
      if (f.r < absorbR) {
        Object.assign(f, makeFragment());
        f.r = Math.hypot(width, height) * rand(0.4, 0.55);
      }
    }

    for (let i = 0; i < fogArms.length; i += 1) {
      fogArms[i].angle += fogArms[i].speed * dt;
    }

    // Deep crimson shockwave every ~3 seconds.
    if (elapsed - lastPulse > 3000) {
      lastPulse = elapsed;
      shockwaves.push({ r: hr * 0.9, life: 1, width: 10 });
    }

    // Ghost seal emerging from the void every ~8 seconds.
    if (elapsed - lastGhost > 8000) {
      lastGhost = elapsed;
      ghosts.push({
        kind: pick(SYMBOLS),
        life: 0,
        size: hr * 0.35,
      });
    }

    for (let i = shockwaves.length - 1; i >= 0; i -= 1) {
      const w = shockwaves[i];
      w.r += dt * 220;
      w.life -= dt * 0.55;
      w.width *= 0.992;
      if (w.life <= 0) shockwaves.splice(i, 1);
    }

    for (let i = ghosts.length - 1; i >= 0; i -= 1) {
      const g = ghosts[i];
      g.life += dt * 0.45;
      g.size += dt * 90;
      if (g.life >= 1) ghosts.splice(i, 1);
    }

    // Occasional Hawking bursts from the rim.
    if (Math.random() < 0.08) {
      for (let n = 0; n < 6; n += 1) {
        const p = makeParticle(false);
        p.r = hr * rand(1.02, 1.12);
        p.angle = Math.random() * Math.PI * 2;
        p.color = COLORS.hawking;
        p.size = rand(0.8, 1.8);
        p.spiral = rand(0.02, 0.05);
        p.hawking = true;
        p.trail = true;
        // Reuse a dead slot if possible.
        const slot = particles.find((x) => !x.alive);
        if (slot) Object.assign(slot, p);
        else if (particles.length < particleBudget + 40) particles.push(p);
      }
    }
  }

  function draw(elapsed) {
    const hr = horizonRadius(elapsed);
    const tZoom = Math.min(1.35, zoom);

    beginFrame();
    cx = width * 0.5;
    cy = height * 0.5;

    // Deep space plate — slightly lifted from pure black so the field reads.
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(tZoom, tZoom);
    ctx.translate(-cx, -cy);

    // Star field with gravitational lensing near the hole.
    for (let i = 0; i < stars.length; i += 1) {
      const s = stars[i];
      const dx = s.x - cx;
      const dy = s.y - cy;
      const dist = Math.hypot(dx, dy) + 0.001;
      const lens = Math.max(0, 1 - dist / (hr * 4.2));
      const bend = lens * lens * 28;
      const lx = s.x + (dx / dist) * bend;
      const ly = s.y + (dy / dist) * bend;
      const twinkle = 0.55 + 0.45 * Math.sin(elapsed * 0.0015 * s.z + s.phase);
      ctx.globalAlpha = twinkle * (0.55 + s.z * 0.45) * (1 - lens * 0.25);
      ctx.fillStyle = '#f2ebe0';
      ctx.beginPath();
      ctx.arc(lx, ly, s.size * s.z * 1.15, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Volumetric fog tendrils.
    for (let i = 0; i < fogArms.length; i += 1) {
      const f = fogArms[i];
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(f.angle);
      const grad = ctx.createRadialGradient(hr * 1.4, 0, 4, hr * 1.4, 0, f.length);
      grad.addColorStop(0, `rgba(28, 0, 51, ${f.alpha})`);
      grad.addColorStop(1, 'rgba(28, 0, 51, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(hr * 1.2, 0, f.length, f.width, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Accretion disk ellipse (flat ring of gold/crimson).
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1, 0.38);
    ctx.rotate(elapsed * 0.00018);
    for (let ring = 0; ring < 3; ring += 1) {
      const rr = hr * (1.55 + ring * 0.55);
      ctx.strokeStyle = ring % 2 === 0 ? COLORS.gold : COLORS.crimson;
      ctx.globalAlpha = 0.35 - ring * 0.06;
      ctx.lineWidth = 10 - ring * 2;
      ctx.shadowColor = ring % 2 === 0 ? COLORS.gold : COLORS.crimson;
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.arc(0, 0, rr, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;

    // Spiraling particles (with optional trails + chromatic aberration near the void).
    for (let i = 0; i < particles.length; i += 1) {
      const p = particles[i];
      if (!p.alive) continue;
      const x = cx + Math.cos(p.angle) * p.r;
      const y = cy + Math.sin(p.angle) * p.r * 0.55; // flatten into the disk plane
      const near = Math.max(0, 1 - p.r / (hr * 3));

      if (p.trail) {
        const tx = cx + Math.cos(p.angle - 0.12) * (p.r + 6);
        const ty = cy + Math.sin(p.angle - 0.12) * (p.r + 6) * 0.55;
        ctx.strokeStyle = p.color;
        ctx.globalAlpha = 0.22 + near * 0.25;
        ctx.lineWidth = p.size * 0.6;
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(x, y);
        ctx.stroke();
      }

      // Chromatic aberration: red/blue split near the horizon.
      if (near > 0.35) {
        const sep = near * 1.8;
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = '#ff3030';
        ctx.beginPath();
        ctx.ellipse(x - sep, y, p.size, p.size * p.stretch, p.angle, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#3080ff';
        ctx.beginPath();
        ctx.ellipse(x + sep, y, p.size, p.size * p.stretch, p.angle, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalAlpha = 0.7 + near * 0.3;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.ellipse(x, y, p.size, p.size * p.stretch, p.angle, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Manuscript fragments.
    ctx.font = '10px "Cormorant Garamond", Georgia, serif';
    for (let i = 0; i < fragments.length; i += 1) {
      const f = fragments[i];
      const x = cx + Math.cos(f.angle) * f.r;
      const y = cy + Math.sin(f.angle) * f.r * 0.45;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(f.rot);
      ctx.globalAlpha = f.alpha;
      ctx.fillStyle = 'rgba(40, 28, 18, 0.55)';
      ctx.strokeStyle = 'rgba(184, 134, 11, 0.35)';
      ctx.lineWidth = 0.6;
      ctx.fillRect(-f.w * 0.5, -f.h * 0.5, f.w, f.h);
      ctx.strokeRect(-f.w * 0.5, -f.h * 0.5, f.w, f.h);
      ctx.fillStyle = 'rgba(184, 134, 11, 0.7)';
      ctx.fillText(f.word, -f.w * 0.4, 3);
      ctx.restore();
    }
    ctx.globalAlpha = 1;

    // Orbiting alchemical seals.
    for (let i = 0; i < symbols.length; i += 1) {
      const s = symbols[i];
      const x = cx + Math.cos(s.angle) * s.orbit;
      const y = cy + Math.sin(s.angle) * s.orbit * 0.46;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(s.rot);
      ctx.globalAlpha = Math.max(0, 1 - s.dissolve);
      // Mild radial stretch as they near the void.
      const squash = 1 + s.dissolve * 1.8;
      ctx.scale(1 / squash, squash);
      drawSymbol(s.kind, s.size);
      ctx.restore();
    }
    ctx.globalAlpha = 1;

    // SOLVE ET COAGULA as a gold text arc.
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(elapsed * 0.00012);
    const arcR = hr * 2.35;
    const phrase = 'SOLVE ET COAGULA · SOLVE ET COAGULA · ';
    ctx.font = '600 14px "Cormorant Garamond", Georgia, serif';
    ctx.fillStyle = COLORS.gold;
    ctx.textAlign = 'center';
    for (let i = 0; i < phrase.length; i += 1) {
      const a = (i / phrase.length) * Math.PI * 2;
      ctx.save();
      ctx.rotate(a);
      ctx.translate(0, -arcR);
      ctx.globalAlpha = 0.82;
      ctx.shadowColor = COLORS.gold;
      ctx.shadowBlur = 8;
      ctx.fillText(phrase[i], 0, 0);
      ctx.restore();
    }
    ctx.restore();
    ctx.globalAlpha = 1;

    // Ghost symbol rising from the void.
    for (let i = 0; i < ghosts.length; i += 1) {
      const g = ghosts[i];
      ctx.save();
      ctx.translate(cx, cy);
      ctx.globalAlpha = Math.sin(g.life * Math.PI) * 0.45;
      ctx.scale(g.size / 18, g.size / 18);
      drawSymbol(g.kind, 18);
      ctx.restore();
    }
    ctx.globalAlpha = 1;

    // Event horizon bloom — layered shadowBlur for a strong glow.
    const glowR = hr * 1.35;
    for (let i = 0; i < 4; i += 1) {
      ctx.beginPath();
      ctx.arc(cx, cy, glowR + i * 18, 0, Math.PI * 2);
      ctx.fillStyle = i % 2 === 0 ? 'rgba(28, 0, 51, 0.22)' : 'rgba(139, 0, 0, 0.12)';
      ctx.shadowColor = i % 2 === 0 ? COLORS.glowInner : COLORS.crimson;
      ctx.shadowBlur = 30 + i * 18;
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    // Photon rim.
    ctx.beginPath();
    ctx.arc(cx, cy, hr * 1.04, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(184, 134, 11, 0.7)';
    ctx.lineWidth = 2;
    ctx.shadowColor = COLORS.gold;
    ctx.shadowBlur = 22;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Pure black core.
    ctx.beginPath();
    ctx.arc(cx, cy, hr, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.core;
    ctx.fill();

    // Shockwave rings.
    for (let i = 0; i < shockwaves.length; i += 1) {
      const w = shockwaves[i];
      ctx.beginPath();
      ctx.arc(cx, cy, w.r, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(139, 0, 0, ${Math.max(0, w.life * 0.55)})`;
      ctx.lineWidth = w.width;
      ctx.stroke();
    }

    ctx.restore(); // end zoom

    // Vignette — dark edges, inevitable, but leave the disk readable.
    const vig = ctx.createRadialGradient(
      cx,
      cy,
      Math.min(width, height) * 0.28,
      cx,
      cy,
      Math.hypot(width, height) * 0.72
    );
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(0.7, 'rgba(0,0,0,0.18)');
    vig.addColorStop(1, 'rgba(0,0,0,0.78)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, width, height);
  }

  function frame(now) {
    if (!running) return;
    if (!startTs) startTs = now;
    const elapsed = now - startTs;
    const dt = Math.min(0.05, (frame.prev ? (now - frame.prev) : 16) / 1000);
    frame.prev = now;

    update(dt, elapsed);
    draw(elapsed);

    if (!midFired && elapsed >= duration * 0.74) {
      midFired = true;
      if (typeof onMid === 'function') onMid();
    }

    raf = requestAnimationFrame(frame);
  }

  function onPointerMove(e) {
    mouseLive = true;
    mouseX = e.clientX;
    mouseY = e.clientY;
  }

  function onPointerLeave() {
    mouseLive = false;
  }

  function onClick(e) {
    if (!running || !interactive) return;
    // Burst of gold from the cursor, spiraling into the void.
    for (let i = 0; i < 200; i += 1) {
      const p = makeParticle(false);
      const ang = Math.random() * Math.PI * 2;
      const dist = rand(8, 70);
      const px = e.clientX + Math.cos(ang) * dist;
      const py = e.clientY + Math.sin(ang) * dist;
      p.angle = Math.atan2(py - cy, px - cx);
      p.r = Math.hypot(px - cx, py - cy);
      p.baseR = p.r;
      p.color = Math.random() < 0.75 ? COLORS.gold : COLORS.crimson;
      p.spiral = rand(0.03, 0.07);
      p.trail = true;
      const slot = particles.find((x) => !x.alive);
      if (slot) Object.assign(slot, p);
      else if (particles.length < particleBudget + 220) particles.push(p);
    }
  }

  function bindInput() {
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerleave', onPointerLeave, { passive: true });
    window.addEventListener('click', onClick);
    window.addEventListener('resize', resize);
  }

  function unbindInput() {
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerleave', onPointerLeave);
    window.removeEventListener('click', onClick);
    window.removeEventListener('resize', resize);
  }

  function start(opts) {
    opts = opts || {};
    if (prefersReduced()) {
      if (typeof opts.onMid === 'function') opts.onMid();
      return false;
    }
    if (!ensureCanvas()) return false;

    stop(true);
    running = true;
    duration = opts.duration || 2800;
    onMid = opts.onMid || null;
    interactive = opts.interactive !== false;
    startTs = 0;
    frame.prev = 0;

    const portal = document.getElementById('voidPortal');
    if (portal) {
      portal.classList.add('is-active', 'void--canvas');
      portal.classList.remove('is-closing', 'is-arriving');
    }

    resize();
    cx = width * 0.5;
    cy = height * 0.5;
    seedScene();
    // Immediate first pulse + ghost so a short dive still feels alive.
    lastPulse = -2500;
    lastGhost = -7500;
    bindInput();
    raf = requestAnimationFrame(frame);
    return true;
  }

  function stop(keepPortal) {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    unbindInput();
    onMid = null;

    if (!keepPortal) {
      const portal = document.getElementById('voidPortal');
      if (portal) portal.classList.remove('is-active', 'void--canvas');
    }
  }

  window.SymvoliaVoid = {
    start,
    stop,
    isRunning() {
      return running;
    },
    debug() {
      return {
        running,
        width,
        height,
        dpr,
        particles: particles.length,
        zoom,
      };
    },
  };
})();
