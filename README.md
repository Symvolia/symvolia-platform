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
