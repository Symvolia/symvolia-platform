# Symvolia Platform

The official website of **Symvolia**, my music and sound-design project — live at **[symvolia.xyz](https://symvolia.xyz)**.

An immersive, cinematic site built without frameworks: a WebGL opening sequence, an audio-reactive interface and a browsable sound archive of albums, tracks, soundtracks and podcasts.

## Highlights

- **Cinematic intro** — an "eye → seal" metamorphosis built with Three.js shaders, GSAP timelines and the Web Audio API
- **Sound archive** — dedicated sections for albums, tracks, soundtracks, podcasts and poetic pieces, with an in-site player
- **Performance work** — lossless WebP twins served through `<picture>` / `image-set()`, lazy media loading, notes in [`docs/PORTAL-PERFORMANCE.md`](docs/PORTAL-PERFORMANCE.md)
- **Zero build step** — plain HTML, CSS and ES modules, deployed to GitHub Pages by a GitHub Actions workflow

## Stack

HTML · CSS · JavaScript (ES modules) · Three.js · GLSL · GSAP · Web Audio API · GitHub Actions · GitHub Pages

## Structure

```
index.html, archive*.html   pages
css/  js/  shaders/          styles, scripts, GLSL shaders
assets/                      images, covers, audio, video
docs/                        performance, DNS and operations notes
scripts/                     local preview and publish helpers
```

## Run locally

```bash
python3 -m http.server 8777
# open http://localhost:8777
```

Pushing to `main` deploys automatically (`.github/workflows/pages.yml`). Publishing helpers, tunnels and caching/security notes are in [`docs/OPERATIONS.md`](docs/OPERATIONS.md).

## Author

**Nicolò Peruzzi (Symvolia)** — artist, sound designer & web developer · [npdevelopment.xyz](https://npdevelopment.xyz)

© Symvolia. Music, artwork and media in this repository are not licensed for reuse.
