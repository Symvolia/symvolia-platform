(function () {
  'use strict';

  const canvas = document.getElementById('serpentCanvas');
  if (!canvas) return;
  if (typeof THREE === 'undefined') return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isSmall = Math.min(window.innerWidth, window.innerHeight) < 640;

  // Double-helix torus parameters
  const RING_R = 0.92;        // ring radius (mean sits between sigil and runes)
  const HELIX_R = 0.086;      // how far each serpent coils from the ring center
  const TUBE_R = 0.036;       // serpent body thickness (slender)
  const COILS = 8;            // number of intertwining coils around the ring
  const TUBULAR = isSmall ? 200 : 320;
  const RADIAL = isSmall ? 8 : 12;

  let renderer, scene, camera, group, material, envMap;
  let serpentA = null;
  let serpentB = null;

  const clock = { start: null };
  let rafId = null;
  let lastBuild = 0;
  let phase = 0;

  function makeCurve(offset, phaseNow) {
    const pts = [];
    const seg = TUBULAR;
    for (let i = 0; i <= seg; i++) {
      const th = (i / seg) * Math.PI * 2;
      const c = Math.cos(th);
      const s = Math.sin(th);
      const coil = COILS * th + offset + phaseNow;
      const rad = RING_R + HELIX_R * Math.cos(coil);
      pts.push(new THREE.Vector3(rad * c, rad * s, HELIX_R * Math.sin(coil)));
    }
    return new THREE.CatmullRomCurve3(pts, true, 'catmullrom', 0.5);
  }

  function buildTube(offset, phaseNow, existing) {
    const curve = makeCurve(offset, phaseNow);
    const geo = new THREE.TubeGeometry(curve, TUBULAR, TUBE_R, RADIAL, true);
    if (existing) {
      existing.geometry.dispose();
      existing.geometry = geo;
      return existing;
    }
    const mesh = new THREE.Mesh(geo, material);
    mesh.castShadow = false;
    return mesh;
  }

  function rebuild(phaseNow) {
    serpentA = buildTube(0, phaseNow, serpentA);
    serpentB = buildTube(Math.PI, phaseNow, serpentB);
    if (!serpentA.parent) group.add(serpentA);
    if (!serpentB.parent) group.add(serpentB);
  }

  function makeScaleTexture() {
    const s = 256;
    const c = document.createElement('canvas');
    c.width = s;
    c.height = s;
    const g = c.getContext('2d');
    // Neutral mid-gray = flat; brighter = raised scale
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
    grd.addColorStop(0.24, '#efe9dc'); // bright reflection band → silver sheen
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

    const scaleTex = makeScaleTexture();
    scaleTex.repeat.set(170, 9);
    const scaleRough = makeScaleTexture();
    scaleRough.repeat.set(170, 9);

    material = new THREE.MeshStandardMaterial({
      color: 0xc9c3b7,
      metalness: 0.82,
      roughness: 0.42,
      envMap: envMap,
      envMapIntensity: 1.15,
      bumpMap: scaleTex,
      bumpScale: 0.045,
      roughnessMap: scaleRough,
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

    // Slither: the helix phase travels so the serpents coil on themselves
    phase = t * 0.9;

    // Rebuild geometry (throttled) to animate the spiral weave
    if (now - lastBuild > 28) {
      rebuild(phase);
      lastBuild = now;
    }

    // Slow in-plane rotation only, so the whole ring stays visible
    // (a small constant tilt gives depth without hiding anything behind the sigil)
    group.rotation.z = t * 0.12;
    group.rotation.x = -0.12;
    group.rotation.y = 0;

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
