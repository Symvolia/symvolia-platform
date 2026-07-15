# Symvolia Platform

Permanent site: **https://symvolia.github.io/symvolia-platform/**

Static HTML/CSS/JS — no build step.

## Publish everything (one command)

```bash
./scripts/publish.sh "optional commit message"
```

Syncs the running local copy (localhost + tunnel) **and** pushes to GitHub.
GitHub Actions then auto-deploys to the permanent link within 1–2 minutes.

## Local preview

```bash
python3 -m http.server 8765
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
