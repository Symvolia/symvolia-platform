(function () {
  'use strict';

  const canvas = document.getElementById('serpentCanvas');
  if (!canvas) return;
  if (typeof THREE === 'undefined') return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isSmall = Math.min(window.innerWidth, window.innerHeight) < 640;

  // Ouroboros parameters — a single serpent biting its own tail
  const RING_R = 0.9;         // ring radius (mean, sits between sigil and runes)
  const BODY_R = 0.05;        // max body thickness
  const HEAD_R = 0.088;       // head size
  const GAP = THREE.MathUtils.degToRad(20); // gap the head reaches across to bite the tail
  const SEG = isSmall ? 260 : 380;
  const RADIAL = isSmall ? 9 : 13;

  let renderer, scene, camera, group;
  let bodyMat, headMat, eyeMat, envMap;
  let bodyMesh = null;
  let headMesh = null;

  const clock = { start: null };
  let rafId = null;
  let lastBuild = 0;
  let phase = 0;

  function smoothstep(a, b, x) {
    const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  }

  // Body radius profile: pointed tail → full belly → neck narrows into head
  function bodyRadius(u) {
    const tailTip = smoothstep(0.0, 0.07, u);
    const headTaper = 1.0 - 0.4 * smoothstep(0.82, 1.0, u);
    const belly = 0.66 + 0.34 * Math.sin(Math.PI * Math.pow(u, 0.92));
    return BODY_R * tailTip * headTaper * belly * 1.4;
  }

  function makeCurve(phaseNow) {
    const start = Math.PI * 0.5;
    const span = Math.PI * 2 - GAP;
    const pts = [];
    for (let i = 0; i <= SEG; i++) {
      const u = i / SEG;
      const ang = start + span * u;
      const rr = RING_R + Math.sin(u * Math.PI * 11 - phaseNow) * 0.009;
      const z = Math.sin(u * Math.PI * 7 - phaseNow) * 0.026;
      pts.push(new THREE.Vector3(Math.cos(ang) * rr, Math.sin(ang) * rr, z));
    }
    const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.5);
    curve.arcLengthDivisions = SEG * 2;
    curve.updateArcLengths();
    return curve;
  }

  function buildBodyGeometry(phaseNow) {
    const curve = makeCurve(phaseNow);
    const frames = curve.computeFrenetFrames(SEG, false);
    const positions = [];
    const normals = [];
    const uvs = [];
    const indices = [];

    for (let i = 0; i <= SEG; i++) {
      const u = i / SEG;
      const p = curve.getPointAt(u);
      const normal = frames.normals[i];
      const binormal = frames.binormals[i];
      const r = bodyRadius(u);
      for (let j = 0; j <= RADIAL; j++) {
        const v = j / RADIAL;
        const a = v * Math.PI * 2;
        const cos = Math.cos(a);
        const sin = Math.sin(a);
        const nx = cos * normal.x + sin * binormal.x;
        const ny = cos * normal.y + sin * binormal.y;
        const nz = cos * normal.z + sin * binormal.z;
        positions.push(p.x + r * nx, p.y + r * ny, p.z + r * nz);
        normals.push(nx, ny, nz);
        uvs.push(u, v);
      }
    }

    for (let i = 0; i < SEG; i++) {
      for (let j = 0; j < RADIAL; j++) {
        const a = (RADIAL + 1) * i + j;
        const b = (RADIAL + 1) * (i + 1) + j;
        const c = (RADIAL + 1) * (i + 1) + j + 1;
        const d = (RADIAL + 1) * i + j + 1;
        indices.push(a, b, d);
        indices.push(b, c, d);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    return { geo, curve, frames };
  }

  function placeHead(curve, frames) {
    const headP = curve.getPointAt(1);
    const headT = frames.tangents[SEG].clone().normalize();
    headMesh.position.copy(headP);
    headMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), headT);
    // nudge the snout forward so it reaches over the tail (the bite)
    headMesh.position.addScaledVector(headT, HEAD_R * 0.45);
  }

  function rebuild(phaseNow) {
    const built = buildBodyGeometry(phaseNow);
    if (bodyMesh) {
      bodyMesh.geometry.dispose();
      bodyMesh.geometry = built.geo;
    } else {
      bodyMesh = new THREE.Mesh(built.geo, bodyMat);
      group.add(bodyMesh);
    }
    placeHead(built.curve, built.frames);
  }

  function makeHead() {
    const head = new THREE.Group();

    const skull = new THREE.Mesh(new THREE.SphereGeometry(HEAD_R, 20, 16), headMat);
    skull.scale.set(0.82, 0.62, 1.4); // elongated snout along +z
    head.add(skull);

    const eyeGeo = new THREE.SphereGeometry(HEAD_R * 0.2, 14, 12);
    const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
    const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
    eyeL.position.set(HEAD_R * 0.42, HEAD_R * 0.3, HEAD_R * 0.55);
    eyeR.position.set(-HEAD_R * 0.42, HEAD_R * 0.3, HEAD_R * 0.55);
    head.add(eyeL);
    head.add(eyeR);

    return head;
  }

  function makeScaleTexture() {
    const s = 256;
    const c = document.createElement('canvas');
    c.width = s;
    c.height = s;
    const g = c.getContext('2d');
    g.fillStyle = '#7f7f7f';
    g.fillRect(0, 0, s, s);

    const cols = 18;
    const rows = 14;
    const rw = s / cols;
    const rh = s / rows;
    for (let y = -1; y <= rows; y++) {
      for (let x = -1; x <= cols; x++) {
        const ox = (((y % 2) + 2) % 2) * rw * 0.5;
        const cxp = x * rw + ox + rw * 0.5;
        const cyp = y * rh + rh * 0.5;
        const grd = g.createRadialGradient(cxp, cyp - rh * 0.22, 1, cxp, cyp + rh * 0.1, rw * 0.66);
        grd.addColorStop(0, '#efefef');
        grd.addColorStop(0.55, '#a2a2a2');
        grd.addColorStop(1, '#454545');
        g.beginPath();
        g.ellipse(cxp, cyp, rw * 0.52, rh * 0.64, 0, 0, Math.PI * 2);
        g.fillStyle = grd;
        g.fill();
      }
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return tex;
  }

  function makeEnvironment() {
    const c = document.createElement('canvas');
    c.width = 32;
    c.height = 256;
    const g = c.getContext('2d');
    const grd = g.createLinearGradient(0, 0, 0, 256);
    grd.addColorStop(0.0, '#40392f');
    grd.addColorStop(0.24, '#efe9dc');
    grd.addColorStop(0.32, '#4a4238');
    grd.addColorStop(0.6, '#12100e');
    grd.addColorStop(1.0, '#000000');
    g.fillStyle = grd;
    g.fillRect(0, 0, 32, 256);

    const tex = new THREE.CanvasTexture(c);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    const pmrem = new THREE.PMREMGenerator(renderer);
    const env = pmrem.fromEquirectangular(tex).texture;
    tex.dispose();
    pmrem.dispose();
    return env;
  }

  function sizeRenderer() {
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(1, rect.width);
    const h = Math.max(1, rect.height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function init() {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setClearColor(0x000000, 0);
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;

    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
    camera.position.set(0, 0, 4.25);
    camera.lookAt(0, 0, 0);

    envMap = makeEnvironment();
    scene.environment = envMap;

    // Polished, photorealistic silver metal (like before) with only a faint
    // micro-scale texture so the reflections stay clean and glossy.
    const scaleTex = makeScaleTexture();
    scaleTex.repeat.set(150, 7);

    bodyMat = new THREE.MeshStandardMaterial({
      color: 0xcdc7bb,
      metalness: 0.96,
      roughness: 0.28,
      envMap: envMap,
      envMapIntensity: 1.3,
      bumpMap: scaleTex,
      bumpScale: 0.012,
    });

    headMat = new THREE.MeshStandardMaterial({
      color: 0xcdc7bb,
      metalness: 0.96,
      roughness: 0.28,
      envMap: envMap,
      envMapIntensity: 1.3,
    });

    eyeMat = new THREE.MeshStandardMaterial({
      color: 0x120b04,
      metalness: 0.3,
      roughness: 0.12,
      emissive: 0x2a1606,
      emissiveIntensity: 0.35,
    });

    // Lights
    const key = new THREE.DirectionalLight(0xfff4e6, 2.1);
    key.position.set(-2.5, 3.5, 3);
    scene.add(key);

    const rim = new THREE.DirectionalLight(0x9fb0c8, 1.2);
    rim.position.set(2.5, -1.5, -3);
    scene.add(rim);

    const hemi = new THREE.HemisphereLight(0xb9b2a4, 0x0a0908, 0.7);
    scene.add(hemi);

    group = new THREE.Group();
    scene.add(group);

    headMesh = makeHead();
    group.add(headMesh);

    sizeRenderer();
    rebuild(0);

    if (reducedMotion) {
      group.rotation.x = -0.12;
      renderer.render(scene, camera);
      return;
    }
    rafId = window.requestAnimationFrame(frame);
  }

  function frame(now) {
    if (clock.start === null) clock.start = now;
    const t = (now - clock.start) / 1000;

    // Subtle slither travelling along the body
    phase = t * 0.9;
    if (now - lastBuild > 32) {
      rebuild(phase);
      lastBuild = now;
    }

    // Slow rotation + a gentle 3D undulation for the "graphic motion 3d" feel,
    // kept subtle so the whole ouroboros stays visible around the sigil.
    group.rotation.z = t * 0.1;
    group.rotation.x = -0.14 + Math.sin(t * 0.45) * 0.07;
    group.rotation.y = Math.sin(t * 0.32) * 0.06;

    renderer.render(scene, camera);
    rafId = window.requestAnimationFrame(frame);
  }

  let resizeTimer = null;
  window.addEventListener('resize', () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      if (!renderer) return;
      sizeRenderer();
      if (reducedMotion) renderer.render(scene, camera);
    }, 150);
  });

  document.addEventListener('visibilitychange', () => {
    if (reducedMotion || !renderer) return;
    if (document.hidden) {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
        rafId = null;
      }
    } else if (rafId === null) {
      clock.start = null;
      rafId = window.requestAnimationFrame(frame);
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
