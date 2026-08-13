/**
 * Symvolia — Monochrome alchemical void (canvas).
 * A living engraving: pure black, thin white ink, sacred geometry,
 * planetary seals dissolving into the prima materia.
 *
 * Exposed as window.SymvoliaVoid:
 *   start({ duration, onMid, interactive })
 *   stop()
 */
(function () {
  'use strict';

  const PLANETS = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn'];
  const PHRASES = [
    'SOLVE ET COAGULA · ',
    'V.I.T.R.I.O.L · ',
    'AS ABOVE SO BELOW · ',
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
  let planets = [];
  let ripples = [];
  let ghosts = [];
  let blooms = [];
  let mandalas = [];
  let grain = null;

  let mouseX = 0;
  let mouseY = 0;
  let mouseLive = false;
  let breath = 0;
  let sceneRot = 0;
  let dashOffset = 0;
  let flowerRot = 0;
  let metaLife = 0;
  let lastRipple = 0;
  let lastShock = 0;
  let lastGhost = 0;
  let lastBloom = 0;
  let duration = 3200;
  let onMid = null;
  let midFired = false;
  let interactive = true;
  let particleBudget = 2000;

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
    buildGrain();
  }

  function beginFrame() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /* Film grain — a quiet manuscript tooth over the blackness. */
  function buildGrain() {
    const g = document.createElement('canvas');
    g.width = 128;
    g.height = 128;
    const gctx = g.getContext('2d');
    const img = gctx.createImageData(128, 128);
    for (let i = 0; i < img.data.length; i += 4) {
      const n = (Math.random() * 255) | 0;
      img.data[i] = n;
      img.data[i + 1] = n;
      img.data[i + 2] = n;
      img.data[i + 3] = 18 + ((Math.random() * 20) | 0);
    }
    gctx.putImageData(img, 0, 0);
    grain = g;
  }

  /* ── Pools ── */

  function makeParticle(outer) {
    const angle = Math.random() * Math.PI * 2;
    const maxR = Math.hypot(width, height) * 0.58;
    const pattern = Math.random();
    return {
      alive: true,
      angle,
      r: outer ? rand(maxR * 0.55, maxR) : rand(maxR * 0.2, maxR),
      baseR: maxR,
      spin: rand(0.2, 0.9) * (Math.random() < 0.5 ? 1 : -1),
      spiral: rand(0.01, 0.035),
      size: rand(0.5, 2),
      alpha: rand(0.25, 0.9),
      trail: Math.random() < 0.35,
      stretch: 1,
      // Occasional sacred orbits instead of pure spirals.
      mode: pattern < 0.08 ? 'hex' : pattern < 0.14 ? 'tri' : 'spiral',
      hawking: false,
    };
  }

  function resetParticle(p, outer) {
    Object.assign(p, makeParticle(outer));
  }

  function makeStar() {
    return {
      x: Math.random() * width,
      y: Math.random() * height,
      z: rand(0.25, 1.2),
      phase: Math.random() * Math.PI * 2,
      size: rand(0.35, 1.3),
    };
  }

  function makePlanet(i) {
    return {
      kind: PLANETS[i % PLANETS.length],
      orbit: 95 + i * 38 + rand(-6, 10),
      angle: (i / PLANETS.length) * Math.PI * 2,
      speed: rand(0.04, 0.14) * (i % 2 === 0 ? 1 : -1),
      spin: rand(0.1, 0.45),
      rot: rand(0, Math.PI * 2),
      size: rand(9, 14),
    };
  }

  function seedScene() {
    const mobile = Math.min(width, height) < 720;
    particleBudget = mobile ? 1100 : 2000;

    particles = [];
    for (let i = 0; i < particleBudget; i += 1) particles.push(makeParticle(false));

    stars = [];
    for (let i = 0; i < (mobile ? 220 : 400); i += 1) stars.push(makeStar());

    planets = PLANETS.map((_, i) => makePlanet(i));

    ripples = [];
    ghosts = [];
    blooms = [];
    mandalas = [];
    breath = 0;
    sceneRot = 0;
    dashOffset = 0;
    flowerRot = 0;
    metaLife = 0;
    lastRipple = -3000;
    lastShock = -4000;
    lastGhost = -5000;
    lastBloom = -8000;
    midFired = false;
  }

  function horizonRadius(t) {
    const base = Math.min(width, height) * 0.1;
    const swallow = Math.hypot(width, height) * 0.76;
    const linear = Math.min(1, t / Math.max(1, duration));
    // Hold as a readable seal, then swallow the frame for the handoff.
    const grow = linear < 0.48 ? linear * 0.22 : Math.pow((linear - 0.48) / 0.52, 1.3);
    const breathe = Math.sin(breath) * 3; // ±3px
    return base + (swallow - base) * Math.min(1, grow) + breathe;
  }

  /* ── Glyph drawing (thin white ink) ── */

  function strokeGlyph(kind, size) {
    ctx.strokeStyle = '#ffffff';
    ctx.fillStyle = 'transparent';
    ctx.lineWidth = 1.1;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (kind === 'sun') {
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.12, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    } else if (kind === 'moon') {
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.7, Math.PI * 0.2, Math.PI * 1.5);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(size * 0.22, -size * 0.1, size * 0.52, Math.PI * 0.55, Math.PI * 1.85);
      ctx.stroke();
    } else if (kind === 'mercury') {
      ctx.beginPath();
      ctx.arc(0, -size * 0.1, size * 0.45, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, size * 0.35);
      ctx.lineTo(0, size);
      ctx.moveTo(-size * 0.32, size * 0.7);
      ctx.lineTo(size * 0.32, size * 0.7);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, -size * 0.72, size * 0.28, Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();
    } else if (kind === 'venus') {
      ctx.beginPath();
      ctx.arc(0, -size * 0.25, size * 0.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, size * 0.25);
      ctx.lineTo(0, size);
      ctx.moveTo(-size * 0.32, size * 0.65);
      ctx.lineTo(size * 0.32, size * 0.65);
      ctx.stroke();
    } else if (kind === 'mars') {
      ctx.beginPath();
      ctx.arc(0, size * 0.15, size * 0.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(size * 0.25, -size * 0.15);
      ctx.lineTo(size * 0.85, -size * 0.75);
      ctx.moveTo(size * 0.35, -size * 0.75);
      ctx.lineTo(size * 0.85, -size * 0.75);
      ctx.lineTo(size * 0.85, -size * 0.25);
      ctx.stroke();
    } else if (kind === 'jupiter') {
      ctx.beginPath();
      ctx.moveTo(-size * 0.55, -size * 0.15);
      ctx.quadraticCurveTo(-size * 0.1, -size * 0.9, size * 0.55, -size * 0.2);
      ctx.moveTo(0, -size * 0.55);
      ctx.lineTo(0, size * 0.85);
      ctx.moveTo(-size * 0.35, size * 0.35);
      ctx.lineTo(size * 0.35, size * 0.35);
      ctx.stroke();
    } else if (kind === 'saturn') {
      ctx.beginPath();
      ctx.moveTo(-size * 0.2, -size);
      ctx.lineTo(-size * 0.2, size * 0.55);
      ctx.moveTo(-size * 0.55, size * 0.15);
      ctx.lineTo(size * 0.55, size * 0.15);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(size * 0.35, size * 0.55, size * 0.35, Math.PI * 1.15, Math.PI * 0.15);
      ctx.stroke();
    }
  }

  function drawFlowerOfLife(radius, rot) {
    const r = radius / 3;
    ctx.save();
    ctx.rotate(rot);
    ctx.strokeStyle = 'rgba(255,255,255,0.16)';
    ctx.lineWidth = 0.8;
    const centers = [[0, 0]];
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2;
      centers.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
      centers.push([Math.cos(a) * r * 2, Math.sin(a) * r * 2]);
    }
    centers.forEach(([x, y]) => {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.stroke();
    });
    ctx.restore();
  }

  function drawMetatron(radius, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 0.7;
    const pts = [];
    pts.push([0, 0]);
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
      pts.push([Math.cos(a) * radius * 0.5, Math.sin(a) * radius * 0.5]);
      pts.push([Math.cos(a) * radius, Math.sin(a) * radius]);
    }
    for (let i = 0; i < pts.length; i += 1) {
      for (let j = i + 1; j < pts.length; j += 1) {
        ctx.beginPath();
        ctx.moveTo(pts[i][0], pts[i][1]);
        ctx.lineTo(pts[j][0], pts[j][1]);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawFibonacci(hr, rot) {
    ctx.save();
    ctx.rotate(rot);
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    let first = true;
    for (let i = 0; i < 220; i += 1) {
      const t = i * 0.12;
      const r = hr * 1.05 * Math.exp(0.085 * t) * 0.12;
      const x = Math.cos(t) * r;
      const y = Math.sin(t) * r;
      if (first) {
        ctx.moveTo(x, y);
        first = false;
      } else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawSriYantra(radius, rot, alpha) {
    ctx.save();
    ctx.rotate(rot);
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 0.8;
    for (let i = 0; i < 4; i += 1) {
      const s = radius * (0.35 + i * 0.18);
      const flip = i % 2 === 0 ? 1 : -1;
      ctx.beginPath();
      ctx.moveTo(0, -s * flip);
      ctx.lineTo(s * 0.9, s * 0.7 * flip);
      ctx.lineTo(-s * 0.9, s * 0.7 * flip);
      ctx.closePath();
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.12, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function drawVesica(radius, deform, rot) {
    ctx.save();
    ctx.rotate(rot);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 0.9;
    const d = radius * (0.55 + deform * 0.12);
    ctx.beginPath();
    ctx.arc(-d * 0.5, 0, radius * 0.7, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(d * 0.5, 0, radius * 0.7, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function drawMerkaba(radius, rot, alpha) {
    ctx.save();
    ctx.rotate(rot);
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    for (let flip of [1, -1]) {
      ctx.beginPath();
      ctx.moveTo(0, -radius * flip);
      ctx.lineTo(radius * 0.9, radius * 0.55 * flip);
      ctx.lineTo(-radius * 0.9, radius * 0.55 * flip);
      ctx.closePath();
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawTextArc(phrase, radius, rot, alpha) {
    ctx.save();
    ctx.rotate(rot);
    ctx.font = '300 11px "Cormorant Garamond", Georgia, serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.letterSpacing = '0.3em';
    for (let i = 0; i < phrase.length; i += 1) {
      const a = (i / phrase.length) * Math.PI * 2;
      ctx.save();
      ctx.rotate(a);
      ctx.translate(0, -radius);
      ctx.globalAlpha = alpha;
      ctx.fillText(phrase[i], 0, 0);
      ctx.restore();
    }
    ctx.restore();
  }

  function drawMandala(radius, rot, alpha) {
    ctx.save();
    ctx.rotate(rot);
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 0.8;
    for (let ring = 1; ring <= 4; ring += 1) {
      ctx.beginPath();
      ctx.arc(0, 0, radius * ring * 0.22, 0, Math.PI * 2);
      ctx.stroke();
    }
    for (let i = 0; i < 12; i += 1) {
      const a = (i / 12) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * radius, Math.sin(a) * radius);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(Math.cos(a) * radius * 0.55, Math.sin(a) * radius * 0.55, radius * 0.12, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  /* ── Update ── */

  function update(dt, elapsed) {
    breath += dt * ((Math.PI * 2) / 3); // ~3s breath
    sceneRot += dt * ((Math.PI * 2) / 300); // full turn ~5 minutes
    flowerRot += dt * 0.02;
    dashOffset -= dt * 18;
    metaLife = (Math.sin(elapsed * 0.0007) + 1) * 0.5;

    const hr = horizonRadius(elapsed);
    const absorbR = Math.max(4, hr * 0.92);

    let pullX = 0;
    let pullY = 0;
    if (interactive && mouseLive) {
      const mdx = mouseX - cx;
      const mdy = mouseY - cy;
      const md = Math.hypot(mdx, mdy) + 1;
      const near = 1 - Math.min(1, md / (Math.min(width, height) * 0.55));
      pullX = (mdx / md) * near * 22;
      pullY = (mdy / md) * near * 22;
    }

    for (let i = 0; i < particles.length; i += 1) {
      const p = particles[i];
      if (!p.alive) {
        resetParticle(p, true);
        continue;
      }

      const haste = 1 + Math.pow(1 - Math.min(1, p.r / (p.baseR + 1)), 2.1) * 4;
      if (p.mode === 'hex') {
        p.angle += p.spin * dt * 0.7;
        p.r -= dt * 12 * haste;
      } else if (p.mode === 'tri') {
        p.angle += p.spin * dt * 1.1;
        p.r -= p.r * p.spiral * 0.7 * haste * dt * 2.5;
      } else {
        p.angle += p.spin * dt * haste;
        p.r -= p.r * p.spiral * haste * dt * 2.6;
      }

      if (pullX || pullY) {
        const px = cx + Math.cos(p.angle) * p.r + pullX * dt * 7;
        const py = cy + Math.sin(p.angle) * p.r + pullY * dt * 7;
        p.angle = Math.atan2(py - cy, px - cx);
        p.r = Math.hypot(px - cx, py - cy);
      }

      p.stretch = p.r < hr * 1.85 ? 1 + (1.85 - p.r / hr) * 2.2 : 1;

      if (p.r <= absorbR || p.r < 2) {
        if (p.hawking) p.alive = false;
        else resetParticle(p, true);
      }
    }

    for (let i = 0; i < planets.length; i += 1) {
      const s = planets[i];
      const haste = 1 + Math.max(0, 1 - s.orbit / 260) * 2;
      s.angle += s.speed * dt * haste;
      s.rot += s.spin * dt;
      s.orbit -= dt * 5.5 * haste;
      if (s.orbit < hr * 1.2) {
        Object.assign(s, makePlanet(i));
        s.orbit = rand(200, 310);
      }
    }

    // Concentric ripples every ~4s.
    if (elapsed - lastRipple > 4000) {
      lastRipple = elapsed;
      ripples.push({ r: hr * 1.05, life: 1, kind: 'ripple' });
    }
    // Shockwave every ~5s.
    if (elapsed - lastShock > 5000) {
      lastShock = elapsed;
      ripples.push({ r: hr * 1.02, life: 1, kind: 'shock' });
    }
    // Ghost planetary seal every ~6s.
    if (elapsed - lastGhost > 6000) {
      lastGhost = elapsed;
      ghosts.push({ kind: pick(PLANETS), life: 0, size: hr * 0.4 });
    }
    // Large sacred bloom every ~10s.
    if (elapsed - lastBloom > 10000) {
      lastBloom = elapsed;
      blooms.push({
        kind: Math.random() < 0.5 ? 'merkaba' : 'yantra',
        life: 0,
        size: hr * 0.5,
      });
    }

    // Sparse Hawking flecks from the rim.
    if (Math.random() < 0.045) {
      for (let n = 0; n < 4; n += 1) {
        const p = makeParticle(false);
        p.r = hr * rand(1.02, 1.1);
        p.angle = Math.random() * Math.PI * 2;
        p.alpha = rand(0.5, 1);
        p.size = rand(0.6, 1.4);
        p.hawking = true;
        p.trail = true;
        p.spiral = rand(0.025, 0.05);
        const slot = particles.find((x) => !x.alive);
        if (slot) Object.assign(slot, p);
        else if (particles.length < particleBudget + 30) particles.push(p);
      }
    }

    for (let i = ripples.length - 1; i >= 0; i -= 1) {
      const w = ripples[i];
      w.r += dt * (w.kind === 'shock' ? 210 : 160);
      w.life -= dt * (w.kind === 'shock' ? 0.5 : 0.4);
      if (w.life <= 0) ripples.splice(i, 1);
    }
    for (let i = ghosts.length - 1; i >= 0; i -= 1) {
      const g = ghosts[i];
      g.life += dt * 0.4;
      g.size += dt * 70;
      if (g.life >= 1) ghosts.splice(i, 1);
    }
    for (let i = blooms.length - 1; i >= 0; i -= 1) {
      const b = blooms[i];
      b.life += dt * 0.28;
      b.size += dt * 55;
      if (b.life >= 1) blooms.splice(i, 1);
    }
    for (let i = mandalas.length - 1; i >= 0; i -= 1) {
      const m = mandalas[i];
      m.life += dt * 0.55;
      m.size += dt * 40 * (m.life < 0.35 ? 1 : -0.35);
      if (m.life >= 1) mandalas.splice(i, 1);
    }
  }

  /* ── Draw ── */

  function draw(elapsed) {
    const hr = horizonRadius(elapsed);
    beginFrame();
    cx = width * 0.5;
    cy = height * 0.5;

    // Pure black plate.
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);

    // Star field with gravitational lensing.
    for (let i = 0; i < stars.length; i += 1) {
      const s = stars[i];
      const dx = s.x - cx;
      const dy = s.y - cy;
      const dist = Math.hypot(dx, dy) + 0.001;
      const lens = Math.max(0, 1 - dist / (hr * 4.5));
      const bend = lens * lens * 26;
      // Cursor also gently warps nearby geometry/stars.
      let wx = 0;
      let wy = 0;
      if (interactive && mouseLive) {
        const mdx = mouseX - s.x;
        const mdy = mouseY - s.y;
        const md = Math.hypot(mdx, mdy) + 1;
        if (md < 180) {
          const f = (1 - md / 180) * 4;
          wx = (mdx / md) * f;
          wy = (mdy / md) * f;
        }
      }
      const lx = s.x + (dx / dist) * bend + wx;
      const ly = s.y + (dy / dist) * bend + wy;
      const twinkle = 0.35 + 0.65 * Math.sin(elapsed * 0.0012 * s.z + s.phase);
      ctx.globalAlpha = twinkle * (0.25 + s.z * 0.45) * (1 - lens * 0.3);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(lx, ly, s.size * s.z, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Whole scene turns like ancient cosmic machinery.
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(sceneRot);

    // Sacred geometry layer — thin ink, never solid.
    drawFlowerOfLife(hr * 2.8, flowerRot);
    drawFibonacci(hr, -flowerRot * 0.6);
    drawVesica(hr * 1.9, Math.sin(elapsed * 0.0008), flowerRot * 0.4);
    drawMetatron(hr * 2.2, 0.08 + metaLife * 0.12);
    drawSriYantra(hr * 1.6, flowerRot * 0.25, 0.14);

    // Ouroboros — outermost dashed white ring.
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.lineWidth = 1.1;
    ctx.setLineDash([6, 10]);
    ctx.lineDashOffset = dashOffset;
    ctx.beginPath();
    ctx.ellipse(0, 0, hr * 3.35, hr * 3.35 * 0.92, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    // Serpent head suggestion.
    ctx.beginPath();
    ctx.arc(hr * 3.35, 0, 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Latin inscriptions as curved text arcs.
    drawTextArc(PHRASES[0], hr * 2.55, elapsed * 0.00008, 0.22);
    drawTextArc(PHRASES[1], hr * 2.95, -elapsed * 0.00006, 0.18);
    drawTextArc(PHRASES[2], hr * 3.35, elapsed * 0.00005, 0.16);

    // Planetary seals.
    for (let i = 0; i < planets.length; i += 1) {
      const s = planets[i];
      const fade = Math.max(0.08, Math.min(1, (s.orbit - hr) / (hr * 1.8)));
      const x = Math.cos(s.angle) * s.orbit;
      const y = Math.sin(s.angle) * s.orbit * 0.92;
      // Lines near the void bend toward the singularity.
      const warp = Math.max(0, 1 - s.orbit / (hr * 3)) * 8;
      ctx.save();
      ctx.translate(x * (1 - warp * 0.01), y * (1 - warp * 0.01));
      ctx.rotate(s.rot);
      ctx.globalAlpha = 0.35 + fade * 0.45;
      strokeGlyph(s.kind, s.size);
      ctx.restore();
    }
    ctx.globalAlpha = 1;

    // Ghost seals emerging from the center.
    for (let i = 0; i < ghosts.length; i += 1) {
      const g = ghosts[i];
      ctx.save();
      ctx.globalAlpha = Math.sin(g.life * Math.PI) * 0.35;
      ctx.scale(g.size / 14, g.size / 14);
      strokeGlyph(g.kind, 14);
      ctx.restore();
    }

    // Sacred blooms from the void.
    for (let i = 0; i < blooms.length; i += 1) {
      const b = blooms[i];
      const a = Math.sin(b.life * Math.PI) * 0.3;
      if (b.kind === 'merkaba') drawMerkaba(b.size, b.life * 0.8, a);
      else drawSriYantra(b.size, b.life * 0.5, a);
    }

    ctx.restore(); // end scene rotation

    // Particles (screen space, flattened disk).
    for (let i = 0; i < particles.length; i += 1) {
      const p = particles[i];
      if (!p.alive) continue;
      const x = cx + Math.cos(p.angle + sceneRot) * p.r;
      const y = cy + Math.sin(p.angle + sceneRot) * p.r * 0.88;
      const near = Math.max(0, 1 - p.r / (hr * 3));

      if (p.trail) {
        const tx = cx + Math.cos(p.angle + sceneRot - 0.1) * (p.r + 5);
        const ty = cy + Math.sin(p.angle + sceneRot - 0.1) * (p.r + 5) * 0.88;
        ctx.strokeStyle = `rgba(255,255,255,${0.12 + near * 0.2})`;
        ctx.lineWidth = Math.max(0.4, p.size * 0.45);
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(x, y);
        ctx.stroke();
      }

      ctx.globalAlpha = p.alpha * (0.55 + near * 0.45);
      ctx.fillStyle = near > 0.7 ? '#ffffff' : 'rgba(210,210,210,1)';
      ctx.beginPath();
      ctx.ellipse(x, y, p.size, p.size * p.stretch, p.angle, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Cursor mandalas.
    for (let i = 0; i < mandalas.length; i += 1) {
      const m = mandalas[i];
      ctx.save();
      ctx.translate(m.x, m.y);
      drawMandala(Math.max(8, m.size), m.life * 2, Math.sin(m.life * Math.PI) * 0.4);
      ctx.restore();
    }

    // Event horizon — thin glowing white rim.
    ctx.beginPath();
    ctx.arc(cx, cy, hr, 0, Math.PI * 2);
    ctx.fillStyle = '#000000';
    ctx.fill();

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, hr + 0.8, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 1.4;
    ctx.shadowColor = 'rgba(255,255,255,0.7)';
    ctx.shadowBlur = 10 + Math.sin(breath) * 3;
    ctx.stroke();
    ctx.restore();

    // Soft secondary rim.
    ctx.beginPath();
    ctx.arc(cx, cy, hr + 4, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 0.7;
    ctx.stroke();

    // Ripples / shockwaves.
    for (let i = 0; i < ripples.length; i += 1) {
      const w = ripples[i];
      ctx.beginPath();
      ctx.arc(cx, cy, w.r, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255,255,255,${Math.max(0, w.life * (w.kind === 'shock' ? 0.45 : 0.28))})`;
      ctx.lineWidth = w.kind === 'shock' ? 1.2 : 0.8;
      ctx.stroke();
    }

    // Vignette — edges fall to black.
    const vig = ctx.createRadialGradient(
      cx,
      cy,
      Math.min(width, height) * 0.25,
      cx,
      cy,
      Math.hypot(width, height) * 0.7
    );
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(0.7, 'rgba(0,0,0,0.2)');
    vig.addColorStop(1, 'rgba(0,0,0,0.88)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, width, height);

    // Film grain / parchment tooth.
    if (grain) {
      ctx.save();
      ctx.globalAlpha = 0.07;
      const pattern = ctx.createPattern(grain, 'repeat');
      ctx.fillStyle = pattern;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    }
  }

  function frame(now) {
    if (!running) return;
    if (!startTs) startTs = now;
    const elapsed = now - startTs;
    const dt = Math.min(0.05, (frame.prev ? now - frame.prev : 16) / 1000);
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
    for (let i = 0; i < 150; i += 1) {
      const p = makeParticle(false);
      const ang = Math.random() * Math.PI * 2;
      const dist = rand(6, 60);
      const px = e.clientX + Math.cos(ang) * dist;
      const py = e.clientY + Math.sin(ang) * dist;
      p.angle = Math.atan2(py - cy, px - cx) - sceneRot;
      p.r = Math.hypot(px - cx, py - cy);
      p.baseR = p.r;
      p.alpha = rand(0.5, 1);
      p.spiral = rand(0.03, 0.06);
      p.trail = true;
      const slot = particles.find((x) => !x.alive);
      if (slot) Object.assign(slot, p);
      else if (particles.length < particleBudget + 180) particles.push(p);
    }
  }

  function onContextMenu(e) {
    if (!running || !interactive) return;
    e.preventDefault();
    mandalas.push({
      x: e.clientX,
      y: e.clientY,
      life: 0,
      size: 28,
    });
  }

  function bindInput() {
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerleave', onPointerLeave, { passive: true });
    window.addEventListener('click', onClick);
    window.addEventListener('contextmenu', onContextMenu);
    window.addEventListener('resize', onResize);
  }

  function unbindInput() {
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerleave', onPointerLeave);
    window.removeEventListener('click', onClick);
    window.removeEventListener('contextmenu', onContextMenu);
    window.removeEventListener('resize', onResize);
  }

  function onResize() {
    resize();
    cx = width * 0.5;
    cy = height * 0.5;
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
    duration = opts.duration || 3200;
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
    // Seed timers so a short dive still sees ripples and a ghost.
    lastRipple = -3500;
    lastShock = -4500;
    lastGhost = -5500;
    lastBloom = -9000;
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
  };
})();
