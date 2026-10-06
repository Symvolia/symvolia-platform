# Symvolia Platform

Permanent site: **https://symvolia.xyz/**

Static HTML/CSS/JS — no build step.

## Opening portal

Cinematic **eye → seal** metamorphosis (~9–10s): Three.js + GSAP + Web Audio.
No black cuts · no yellow aura ring. See `docs/PORTAL-PERFORMANCE.md`.

## Publish

```bash
./scripts/publish.sh "optional commit message"
```

Pushes to GitHub; Actions deploys Pages in 1–2 minutes.

> Custom domain: **symvolia.xyz** (`CNAME` in repo root).
> At your registrar, set apex DNS to GitHub Pages (A/AAAA below), then confirm
> the domain + HTTPS in GitHub → Settings → Pages.

## Local preview

```bash
python3 -m http.server 8777
```

## Temporary public link (tunnel)

```bash
./scripts/show-url.sh
./scripts/refresh-service.sh
```

## Local service (runs without Cursor)

```bash
./scripts/install-service.sh
./scripts/stop-site.sh
```

## Caching & security notes

- **Cache-Control.** Static assets (`css/`, `js/`, `assets/`, fonts, audio, video)
  should be served with long-lived caching, e.g.
  `Cache-Control: public, max-age=31536000, immutable`, and be **content-hashed**
  (`site.3f9a1c.css`) instead of relying on the manual `?v=N` query strings.
  Keep HTML short-lived (`max-age=0, must-revalidate`) so a new deploy picks up the
  new hashed filenames. GitHub Pages cannot set these headers — put Cloudflare (or
  another CDN) in front of `symvolia.xyz` and add a cache rule / transform rule.
- **Content-Security-Policy.** There is no CSP yet. A starting point (tighten after
  testing; inline `<script>`/`<style>` blocks in `index.html` and `archive.html`
  need hashes or nonces, or a `'unsafe-inline'` allowance until they are moved out):
  `default-src 'self'; img-src 'self' data:; media-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; script-src 'self' 'unsafe-inline' https://www.youtube.com; frame-src https://www.youtube.com https://player.vimeo.com https://w.soundcloud.com; base-uri 'self'; object-src 'none'`.
- **Images.** The big PNGs now have lossless WebP twins (`*.webp`, pixel-identical)
  served through `<picture>` / `image-set()`. A lossy WebP/AVIF re-export would cut
  another ~60–70 % but needs a visual check on the dark gradients (banding):
  `home-corona-bg-desktop/mobile`, `symvolia-emblem-corona-hd`, `logo-seal`
  (still PNG: it is also referenced from the SVG `<image>` in the intro eye),
  `logo.png` (1.7 MB, shown at 64 px — export a 128 px version), `ouroboros-3d.png`.

