# Symvolia Platform

Permanent site: **https://symvolia.github.io/symvolia-platform/**

Static HTML/CSS/JS — no build step.

## Local preview

```bash
python3 -m http.server 8765
```

## Publish (permanent link)

```bash
./scripts/publish-platform.sh
```

1. Create public repo `symvolia-platform` on GitHub (if missing): https://github.com/new?name=symvolia-platform
2. Run the script above (PAT as password when prompted)
3. Enable Pages: **Settings → Pages → GitHub Actions**

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
