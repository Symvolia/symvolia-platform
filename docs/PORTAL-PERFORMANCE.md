# Symvolia Portal — Performance Audit

Cinematic transition: eye → seal (Three.js + GSAP + Web Audio), target **8–10s**, no black cuts.

## Architecture

| Layer | Role |
|-------|------|
| Canvas 2D painter → `CanvasTexture` | Requiem macro eye (lids, iris fibers, wet cornea, pupil fill, in-pupil sigil) |
| Three.js scene | Camera immersion, seal/ring meshes, additive particles, `eye.glb` depth shell |
| `ShaderPass` vortex + `OutputPass` | Inward spiral distortion + golden flash peak @ 6.0s |
| GSAP timeline | Phases A→E orchestration (absolute seconds) |
| Web Audio (`portal-audio.js`) | Drone / heartbeat / pad / bass+cymbal peak, −3 dB headroom |

Shaders on disk (`shaders/pupil*.glsl`, `vortex.frag.glsl`, `iris.frag.glsl`) are the reference GLSL sources; the runtime vortex pass embeds the fragment for zero-fetch boot.

## Targets

| Surface | Target FPS | Pixel ratio cap | Particles |
|---------|------------|-----------------|-----------|
| Desktop | 60 | 2 | ~90 |
| Mobile / coarse pointer | 30+ | 1.25 | ~48 |

## Continuity (no black)

- Pupil fill → gold → seal growth is one continuous morph (painter + seal mesh)
- Vortex/flash never clears to flat black liminal holds
- At 5.5s `Symvolia.awaken({ silent: true })` starts Ouroboros under the portal
- At 8.5s overlay opacity → 0 while seal/ouroboros already match the stage

## Audio mix

- Master gain **0.707 (−3 dB headroom)**
- Cross-fades only (drone → pad → peak → decay → ambient handoff)
- Peak locked to **t = 6.0s**

## QA seeks

```
/demo/portal-demo.html?portalseek=1.5   # Phase A eye
/demo/portal-demo.html?portalseek=4.5   # Phase B seal in pupil
/demo/portal-demo.html?portalseek=6.0   # Phase C peak
```

## Preview

```bash
python3 -m http.server 8777
# http://127.0.0.1:8777/
# http://127.0.0.1:8777/demo/portal-demo.html
```

## Reduced motion

`prefers-reduced-motion: reduce` skips the portal and fires `symvolia:intro-complete` immediately.
