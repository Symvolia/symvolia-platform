/**
 * Symvolia — Cinematic Portal Transition
 * Continuous metamorphosis: Requiem eye → Symvolia Seal (no black cuts).
 *
 * Timeline (8–10s of pure magic):
 *   A 0–3.5s   Eye awakening, pupil dilates, wet cornea
 *   B 3.5–5.5s Seal reveals inside pupil, eye structure dissolves
 *   C 5.5–6.5s Cosmic vortex + golden flash peak @ 6.0s + particle burst
 *   D 6.5–8.5s Stabilization, Ouroboros loop, content fade-in
 *   E 8.5s+    Ready — ENTER floating, interaction unlocked
 *
 * Tech: Three.js · WebGL shaders · GSAP timeline · Web Audio (portal-audio.js)
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

/* Fullscreen-style eye is painted to a CanvasTexture (Requiem fidelity),
   then vortex/particles/camera live in Three.js — one continuous portal. */
function createEyePainter(sigilCanvas) {
  const size = 1024;
  const cvs = document.createElement('canvas');
  cvs.width = size;
  cvs.height = size;
  const ctx = cvs.getContext('2d');
  const tex = new THREE.CanvasTexture(cvs);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;

  const easeInCubic = (t) => t * t * t;
  const lerp = (a, b, t) => a + (b - a) * t;

  function paint(state, time) {
    const W = size;
    const H = size;
    const cx = W / 2;
    const cy = H / 2;
    const minDim = W;
    const eyeR = minDim * 0.42;
    let pupilR = eyeR * lerp(0.12, 0.36, state.dilate);
    if (state.fill > 0) pupilR = lerp(eyeR * 0.36, minDim * 1.35, easeInCubic(state.fill));

    ctx.fillStyle = '#010101';
    ctx.fillRect(0, 0, W, H);

    // Sclera
    const scler = ctx.createRadialGradient(cx, cy, eyeR * 0.55, cx, cy, eyeR * 1.35);
    scler.addColorStop(0, `rgba(28, 20, 16, ${state.eyeFade})`);
    scler.addColorStop(0.7, `rgba(12, 8, 6, ${state.eyeFade})`);
    scler.addColorStop(1, 'rgba(2, 2, 3, 1)');
    ctx.fillStyle = scler;
    ctx.fillRect(0, 0, W, H);

    // Iris
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, eyeR, 0, Math.PI * 2);
    ctx.clip();
    const iris = ctx.createRadialGradient(cx, cy, pupilR * 0.7, cx, cy, eyeR);
    iris.addColorStop(0, '#000000');
    iris.addColorStop(0.18, '#04060f');
    iris.addColorStop(0.45, '#0a1738');
    iris.addColorStop(0.72, '#241046');
    iris.addColorStop(1, '#050409');
    ctx.globalAlpha = state.eyeFade;
    ctx.fillStyle = iris;
    ctx.fillRect(cx - eyeR, cy - eyeR, eyeR * 2, eyeR * 2);

    const fibers = 120;
    for (let i = 0; i < fibers; i += 1) {
      const ang = (i / fibers) * Math.PI * 2 + Math.sin(i * 12.9) * 0.04;
      const r0 = pupilR + eyeR * 0.02;
      const r1 = eyeR * (0.82 + (Math.sin(i * 7.7) * 0.5 + 0.5) * 0.16);
      const bright = 0.05 + (Math.sin(i * 3.3) * 0.5 + 0.5) * 0.1;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(ang) * r0, cy + Math.sin(ang) * r0);
      ctx.lineTo(cx + Math.cos(ang) * r1, cy + Math.sin(ang) * r1);
      ctx.strokeStyle = `rgba(120, 140, 210, ${bright})`;
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
    ctx.restore();

    // Pupil — deep black (no gold wash / aura)
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(cx, cy, Math.max(1, pupilR), 0, Math.PI * 2);
    ctx.fill();

    // Sigil inside pupil — glyph only, no halo / yellow disc
    if (sigilCanvas && state.sigilAlpha > 0.01) {
      const maxSize = minDim * lerp(0.22, 0.52, state.fill);
      const sz = maxSize * state.sigilScale;
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, Math.max(1, pupilR * 0.92), 0, Math.PI * 2);
      ctx.clip();
      ctx.globalAlpha = Math.min(1, state.sigilAlpha);
      ctx.drawImage(sigilCanvas, cx - sz / 2, cy - sz / 2, sz, sz);
      ctx.restore();
    }

    // Cornea highlights
    if (state.corneaWet > 0.05 && state.fill < 0.9) {
      const hlA = state.corneaWet * state.eyeFade * (1 - state.fill);
      const hx = cx - eyeR * 0.3;
      const hy = cy - eyeR * 0.32;
      const soft = ctx.createRadialGradient(hx, hy, 0, hx, hy, eyeR * 0.45);
      soft.addColorStop(0, `rgba(255,255,255,${0.28 * hlA})`);
      soft.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = soft;
      ctx.beginPath();
      ctx.arc(hx, hy, eyeR * 0.45, 0, Math.PI * 2);
      ctx.fill();
    }

    // Eyelids
    if (state.lidOpen < 0.98 && state.fill < 0.55) {
      const open = lerp(-eyeR * 0.15, eyeR * 1.25, state.lidOpen);
      const curve = eyeR * 0.4;
      const drawLid = (edgeY, dir) => {
        const skin = ctx.createLinearGradient(0, edgeY - dir * H * 0.4, 0, edgeY);
        skin.addColorStop(0, '#0b0705');
        skin.addColorStop(1, '#2a120c');
        ctx.fillStyle = skin;
        ctx.beginPath();
        if (dir < 0) {
          ctx.moveTo(0, 0);
          ctx.lineTo(W, 0);
          ctx.lineTo(W, edgeY);
          ctx.quadraticCurveTo(cx, edgeY + curve, 0, edgeY);
        } else {
          ctx.moveTo(0, H);
          ctx.lineTo(W, H);
          ctx.lineTo(W, edgeY);
          ctx.quadraticCurveTo(cx, edgeY - curve, 0, edgeY);
        }
        ctx.closePath();
        ctx.fill();
      };
      drawLid(cy - open, -1);
      drawLid(cy + open, 1);
    }

    // Soft dissolve of eye flesh — keep sigil readable, no hard black cut
    if (state.eyeFade < 0.995 && sigilCanvas && state.sigilAlpha > 0) {
      const reveal = 1 - state.eyeFade;
      const sz = minDim * 0.48 * state.sigilScale;
      ctx.save();
      ctx.globalAlpha = Math.min(1, reveal * state.sigilAlpha);
      ctx.drawImage(sigilCanvas, cx - sz / 2, cy - sz / 2, sz, sz);
      ctx.restore();
    }

    tex.needsUpdate = true;
  }

  return { tex, paint, canvas: cvs };
}

const VORTEX_SHADER = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uStrength: { value: 0 },
    uFlash: { value: 0 },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uCenter: { value: new THREE.Vector2(0.5, 0.5) },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }
  `,
  fragmentShader: /* glsl */ `
    precision highp float;
    uniform sampler2D tDiffuse;
    uniform float uTime,uStrength,uFlash;
    uniform vec2 uResolution,uCenter;
    varying vec2 vUv;
    void main(){
      vec2 uv=vUv; vec2 c=uCenter; vec2 d=uv-c;
      d.x*=uResolution.x/max(uResolution.y,1.);
      float r=length(d); float ang=atan(d.y,d.x);
      float twist=uStrength*(1.2-r)*2.8;
      float pull=uStrength*0.22*(1.-smoothstep(0.,1.1,r));
      ang+=twist; r=max(0.,r-pull);
      vec2 warped=vec2(cos(ang),sin(ang))*r;
      warped.x/=uResolution.x/max(uResolution.y,1.);
      warped+=c;
      vec4 color=texture2D(tDiffuse,clamp(warped,0.,1.));
      float streaks=pow(max(0.,1.-r),2.)*abs(sin(ang*18.+uTime*6.));
      color.rgb+=vec3(0.55,0.45,0.75)*streaks*uStrength*0.28;
      color.rgb+=vec3(0.9,0.88,0.82)*uFlash*0.55;
      gl_FragColor=color;
    }
  `,
};

const isMobile = () =>
  window.matchMedia('(max-width: 768px), (pointer: coarse)').matches;

function makeGoldenSigilTexture(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const s = 512;
      const off = document.createElement('canvas');
      off.width = s;
      off.height = s;
      const ctx = off.getContext('2d');
      const side = Math.min(img.naturalWidth || img.width, img.naturalHeight || img.height);
      const sx = ((img.naturalWidth || img.width) - side) / 2;
      const sy = ((img.naturalHeight || img.height) - side) / 2;
      ctx.clearRect(0, 0, s, s);
      ctx.drawImage(img, sx, sy, side, side, 0, 0, s, s);
      try {
        const data = ctx.getImageData(0, 0, s, s);
        const px = data.data;
        for (let i = 0; i < px.length; i += 4) {
          const lum = (px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114) / 255;
          // Glyph lines only — no filled gold disc / circular aura
          const a = Math.pow(Math.max(0, (lum - 0.28) / 0.72), 1.6);
          px[i] = 220;
          px[i + 1] = 190;
          px[i + 2] = 140;
          px[i + 3] = Math.round(255 * a);
        }
        ctx.putImageData(data, 0, 0);
      } catch (_) { /* leave */ }
      const tex = new THREE.CanvasTexture(off);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.needsUpdate = true;
      tex.premultiplyAlpha = true;
      resolve({ tex, canvas: off });
    };
    img.onerror = () => resolve({ tex: null, canvas: null });
    img.src = url;
  });
}

export async function startPortalTransition(options = {}) {
  const intro = document.getElementById(options.introId || 'intro');
  const canvas = document.getElementById(options.canvasId || 'introCanvas');
  const skipBtn = document.getElementById(options.skipId || 'introSkip');
  if (!intro || !canvas) return null;

  const base =
    options.base ||
    document.documentElement.getAttribute('data-portal-base') ||
    '';
  const sigilUrl = options.sigilUrl || `${base}assets/logo.png`;
  const eyeUrl = options.eyeUrl || `${base}assets/models/eye.glb`;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) {
    finishReduced(intro);
    return null;
  }

  const gsap = window.gsap;
  if (!gsap || !THREE) {
    console.warn('[SymvoliaPortal] GSAP/Three missing — falling back');
    finishReduced(intro);
    return null;
  }

  const mobile = isMobile();
  const particleCount = mobile ? 48 : 90;
  const dprCap = mobile ? 1.25 : 2;

  // ── State driven by GSAP ──
  const state = {
    dilate: 0,
    fill: 0,
    gold: 0,
    sigilAlpha: 0,
    sigilScale: 0.3,
    eyeFade: 1,
    corneaWet: 0.35,
    vortex: 0,
    flash: 0,
    camZ: -5,
    overlayOpacity: 1,
    lidOpen: 0,
  };

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: !mobile,
    alpha: false,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: true,
  });
  renderer.setClearColor(0x010101, 1);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dprCap));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 40);
  camera.position.set(0, 0, 5); // look from +Z; we animate camZ via state offset

  // Lights
  scene.add(new THREE.AmbientLight(0x1a1520, 0.55));
  const key = new THREE.DirectionalLight(0xc8d0ff, 0.85);
  key.position.set(-2.2, 1.8, 4);
  scene.add(key);

  const sigilPack = await makeGoldenSigilTexture(sigilUrl);
  const sigilTex = sigilPack.tex || new THREE.Texture();
  const eyePainter = createEyePainter(sigilPack.canvas);
  eyePainter.paint(state, 0);

  const eyeMat = new THREE.MeshBasicMaterial({
    map: eyePainter.tex,
    transparent: false,
  });
  const eyeMesh = new THREE.Mesh(new THREE.PlaneGeometry(3.8, 3.8), eyeMat);
  eyeMesh.position.z = 0;
  scene.add(eyeMesh);

  try {
    const gltf = await new GLTFLoader().loadAsync(eyeUrl);
    const shell = gltf.scene;
    shell.traverse((o) => {
      if (o.isMesh) {
        o.material = new THREE.MeshBasicMaterial({
          color: 0x050308,
          transparent: true,
          opacity: 0.12,
          depthWrite: false,
        });
      }
    });
    shell.scale.setScalar(1.2);
    shell.position.z = -0.4;
    scene.add(shell);
  } catch (_) { /* plane eye is enough */ }

  // Floating seal plane (glyph only — no yellow ring / aura mesh)
  const sealMat = new THREE.MeshBasicMaterial({
    map: sigilTex,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    premultipliedAlpha: true,
  });
  const seal = new THREE.Mesh(new THREE.PlaneGeometry(1.05, 1.05), sealMat);
  seal.position.z = 0.08;
  scene.add(seal);

  // Particle system — soft inflow / outburst (muted gold, mostly violet)
  const pGeo = new THREE.BufferGeometry();
  const positions = new Float32Array(particleCount * 3);
  const colors = new Float32Array(particleCount * 3);
  const seeds = [];
  for (let i = 0; i < particleCount; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const r = 1.2 + Math.random() * 2.2;
    positions[i * 3] = Math.cos(a) * r;
    positions[i * 3 + 1] = Math.sin(a) * r;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 0.6;
    const goldish = Math.random() > 0.72;
    colors[i * 3] = goldish ? 0.72 : 0.42;
    colors[i * 3 + 1] = goldish ? 0.58 : 0.28;
    colors[i * 3 + 2] = goldish ? 0.28 : 0.62;
    seeds.push({ a, r, speed: 0.4 + Math.random() * 0.8, phase: Math.random() * Math.PI * 2 });
  }
  pGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  pGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const pMat = new THREE.PointsMaterial({
    size: mobile ? 0.045 : 0.06,
    vertexColors: true,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(pGeo, pMat);
  scene.add(points);

  // Post: vortex + output (required for Three r16x+ color pipeline)
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const vortexPass = new ShaderPass(VORTEX_SHADER);
  composer.addPass(vortexPass);
  composer.addPass(new OutputPass());

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    vortexPass.uniforms.uResolution.value.set(w, h);
  }
  resize();
  window.addEventListener('resize', resize, { passive: true });

  // Audio
  const AudioCtor = window.SymvoliaPortalAudio;
  const audio = AudioCtor ? new AudioCtor() : null;
  if (audio && window.Symvolia && typeof window.Symvolia.isMuted === 'function') {
    audio.setMuted(window.Symvolia.isMuted());
  }
  window.addEventListener('symvolia:mute-change', (e) => {
    if (audio) audio.setMuted(!!(e.detail && e.detail.muted));
  });

  let raf = 0;
  let finished = false;
  let skipUnlocked = false;
  const clock = new THREE.Clock();
  const particleMode = { inflow: 0, outburst: 0 }; // 0..1

  function syncUniforms(t) {
    eyePainter.paint(state, t);

    seal.scale.setScalar(state.sigilScale);
    // Soft glyph reinforcement only — no glow disc
    sealMat.opacity = Math.min(0.85, state.sigilAlpha * (1 - state.eyeFade) * 0.9);

    camera.position.z = 5 + (state.camZ + 5) * 0.55;
    camera.position.x = Math.sin(t * 0.55) * 0.008 * state.eyeFade;
    camera.position.y = Math.cos(t * 0.42) * 0.006 * state.eyeFade;

    vortexPass.uniforms.uTime.value = t;
    vortexPass.uniforms.uStrength.value = state.vortex;
    vortexPass.uniforms.uFlash.value = state.flash * 0.45;

    // No CSS yellow blur aura — only opacity for handoff
    canvas.style.filter = 'none';
    canvas.style.opacity = String(state.overlayOpacity);

    const pos = pGeo.attributes.position.array;
    const inflow = particleMode.inflow;
    const outburst = particleMode.outburst;
    pMat.opacity = Math.min(0.75, inflow * 0.55 + outburst * 0.7);
    for (let i = 0; i < particleCount; i += 1) {
      const s = seeds[i];
      let r = s.r;
      if (inflow > 0) r = THREE.MathUtils.lerp(s.r, 0.15, inflow * (0.5 + 0.5 * Math.sin(s.phase + t * 3)));
      if (outburst > 0) r = THREE.MathUtils.lerp(r, s.r * 2.1, outburst);
      const a = s.a + t * s.speed * (0.15 + outburst * 1.2);
      pos[i * 3] = Math.cos(a) * r;
      pos[i * 3 + 1] = Math.sin(a) * r;
      pos[i * 3 + 2] = Math.sin(t * 2 + s.phase) * 0.12;
    }
    pGeo.attributes.position.needsUpdate = true;

    intro.style.opacity = String(state.overlayOpacity);
  }

  function frame() {
    if (finished) return;
    const t = clock.getElapsedTime();
    syncUniforms(t);
    composer.render();
    raf = requestAnimationFrame(frame);
  }

  function emit(name, detail) {
    try {
      window.dispatchEvent(new CustomEvent(name, { detail }));
    } catch (_) { /* ignore */ }
  }

  function cleanup() {
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', resize);
    document.removeEventListener('keydown', onKey, true);
    intro.removeEventListener('click', onClick);
  }

  function finish() {
    if (finished) return;
    if (/portalseek=/.test(window.location.search)) return; // keep frozen for QA
    finished = true;
    cleanup();

    // Seamless dissolve — stage already alive underneath (no black)
    state.overlayOpacity = 0;
    intro.classList.add('is-done');
    intro.classList.add('is-portal-handoff');
    document.documentElement.classList.remove('is-intro');

    if (audio) audio.handOff(1.2);
    emit('symvolia:intro-complete', { portal: true });

    window.setTimeout(() => {
      try {
        renderer.dispose();
        composer.dispose();
      } catch (_) { /* ignore */ }
      if (intro && intro.parentNode) intro.parentNode.removeChild(intro);
    }, 1400);
  }

  function onKey(e) {
    if (!skipUnlocked) return;
    if (e.key === 'Enter' || e.key === 'Escape' || e.key === ' ') {
      e.preventDefault();
      e.stopImmediatePropagation();
      tl.progress(1);
      finish();
    }
  }
  function onClick() {
    if (!skipUnlocked) return;
    tl.progress(1);
    finish();
  }

  if (skipBtn) {
    skipBtn.classList.add('is-locked');
    skipBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      onClick();
    });
  }
  document.addEventListener('keydown', onKey, true);
  intro.addEventListener('click', onClick);

  // ── GSAP master timeline — fluid overlapping phases ──
  const tl = gsap.timeline({
    onComplete: finish,
    defaults: { ease: 'sine.inOut' },
  });

  tl.call(() => {
    skipUnlocked = true;
    if (skipBtn) skipBtn.classList.remove('is-locked');
  }, null, 3.2);

  // PHASE A — awakening (organic, unhurried)
  tl.to(state, { lidOpen: 1, duration: 1.6, ease: 'sine.out' }, 0);
  tl.to(state, { dilate: 1, duration: 3.4, ease: 'sine.inOut' }, 0.15);
  tl.to(state, { fill: 0.88, duration: 2.8, ease: 'sine.in' }, 1.0);
  tl.to(state, { corneaWet: 0.8, duration: 2.0, ease: 'sine.out' }, 0.2);
  tl.to(state, { camZ: -1.8, duration: 3.6, ease: 'sine.inOut' }, 0);
  tl.call(() => {
    emit('symvolia:portal-phase', { phase: 'A' });
    if (audio) audio.startTimeline();
  }, null, 0);

  // PHASE B — seal reveals inside the pupil (crossfade, no cut)
  tl.to(state, { gold: 1, duration: 2.0, ease: 'sine.inOut' }, 3.3);
  tl.to(state, { sigilAlpha: 1, duration: 2.2, ease: 'sine.out' }, 3.4);
  tl.to(state, { sigilScale: 0.78, duration: 2.4, ease: 'sine.inOut' }, 3.3);
  tl.to(state, { eyeFade: 0.2, duration: 2.4, ease: 'sine.inOut' }, 3.4);
  tl.to(state, { fill: 1, duration: 1.8, ease: 'sine.in' }, 3.5);
  tl.to(state, { corneaWet: 0.12, duration: 1.8, ease: 'sine.inOut' }, 3.5);
  tl.call(() => emit('symvolia:portal-phase', { phase: 'B' }), null, 3.5);

  // PHASE C — soft peak (no yellow blast)
  tl.to(state, { vortex: 0.75, duration: 0.7, ease: 'sine.in' }, 5.4);
  tl.to(particleMode, { inflow: 1, duration: 0.65, ease: 'sine.in' }, 5.4);
  tl.to(state, { flash: 0.55, duration: 0.28, ease: 'sine.out' }, 5.9);
  tl.to(state, { flash: 0, duration: 0.7, ease: 'sine.inOut' }, 6.15);
  tl.to(particleMode, { outburst: 1, inflow: 0, duration: 0.55, ease: 'sine.out' }, 5.95);
  tl.to(state, { camZ: -3.8, duration: 1.2, ease: 'sine.inOut' }, 5.4);
  tl.to(state, { sigilScale: 0.72, duration: 1.0, ease: 'sine.out' }, 5.4);
  tl.to(state, { eyeFade: 0, duration: 1.0, ease: 'sine.inOut' }, 5.4);
  tl.call(() => {
    emit('symvolia:portal-phase', { phase: 'C' });
    if (window.Symvolia && typeof window.Symvolia.awaken === 'function') {
      window.Symvolia.awaken({ silent: true });
    }
  }, null, 5.5);

  // PHASE D — settle into living stage
  tl.to(state, { vortex: 0, duration: 1.5, ease: 'sine.out' }, 6.4);
  tl.to(particleMode, { outburst: 0, duration: 1.3, ease: 'sine.out' }, 6.4);
  tl.to(state, { sigilScale: 0.68, duration: 1.6, ease: 'sine.out' }, 6.4);
  tl.to(state, { camZ: -3.2, duration: 1.6, ease: 'sine.out' }, 6.4);
  tl.call(() => {
    emit('symvolia:portal-phase', { phase: 'D' });
    document.documentElement.classList.add('is-journey-alive');
  }, null, 6.7);

  // PHASE E — seamless dissolve
  tl.to(state, { overlayOpacity: 0, duration: 1.4, ease: 'sine.inOut' }, 8.3);
  tl.call(() => {
    emit('symvolia:portal-phase', { phase: 'E' });
    document.documentElement.classList.add('is-journey-cta');
    if (window.Symvolia && typeof window.Symvolia.showEnterCta === 'function') {
      window.Symvolia.showEnterCta();
    }
    if (window.Symvolia && typeof window.Symvolia.startStageAmbient === 'function') {
      window.Symvolia.startStageAmbient();
    }
  }, null, 8.3);

  // Safety net
  window.setTimeout(() => {
    if (!finished) finish();
  }, 12000);

  raf = requestAnimationFrame(frame);

  window.__symvoliaPortalDebug = {
    timeline: tl,
    state,
    getTime: () => tl.time(),
  };

  // Debug: ?portalseek=1.5 pauses the film at that second (for visual QA).
  const seekMatch = /portalseek=([\d.]+)/.exec(window.location.search);
  if (seekMatch) {
    const seekTo = parseFloat(seekMatch[1]);
    tl.eventCallback('onComplete', null);
    tl.pause(seekTo);
  }

  return {
    timeline: tl,
    state,
    finish,
    audio,
  };
}

function finishReduced(intro) {
  intro.classList.add('is-done');
  document.documentElement.classList.remove('is-intro');
  try {
    window.dispatchEvent(new CustomEvent('symvolia:intro-complete', { detail: { reduced: true } }));
  } catch (_) { /* ignore */ }
  window.setTimeout(() => {
    if (intro && intro.parentNode) intro.parentNode.removeChild(intro);
  }, 400);
}

// Auto-boot when used as site intro module
function waitFor(pred, tries) {
  return new Promise((resolve) => {
    let n = 0;
    const max = tries || 80;
    const tick = () => {
      if (pred()) return resolve(true);
      n += 1;
      if (n >= max) return resolve(false);
      window.setTimeout(tick, 40);
    };
    tick();
  });
}

const boot = async () => {
  if (/introdebug/.test(window.location.search)) return;
  const ready = await waitFor(() => !!window.gsap);
  if (!ready) {
    console.warn('[SymvoliaPortal] GSAP not ready');
    const intro = document.getElementById('intro');
    if (intro) finishReduced(intro);
    return;
  }
  try {
    await startPortalTransition();
  } catch (err) {
    console.error('[SymvoliaPortal]', err);
    const intro = document.getElementById('intro');
    if (intro) finishReduced(intro);
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}

window.SymvoliaPortal = { startPortalTransition };
