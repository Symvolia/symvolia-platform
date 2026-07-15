#!/usr/bin/env bash
# Symvolia — one-command publish.
# Syncs the live local service AND pushes to GitHub Pages in a single step.
#
# Usage:
#   ./scripts/publish.sh                 # auto commit message
#   ./scripts/publish.sh "your message"  # custom commit message
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
APP_SUPPORT="$HOME/Library/Application Support/Symvolia"
SITE_DIR="$APP_SUPPORT/site"
PERMANENT_URL="https://symvoliaplatform.com/"

cd "$PROJECT_DIR"

MSG="${1:-Update Symvolia site ($(date '+%Y-%m-%d %H:%M'))}"

# 1. Sync the running local copy (tunnel + localhost), if the service dir exists.
if [[ -d "$SITE_DIR" ]]; then
  echo "→ Aggiorno la copia locale in esecuzione…"
  rsync -a --delete \
    --exclude '.git' \
    --exclude '.run' \
    --exclude 'bin' \
    --exclude 'scripts' \
    "$PROJECT_DIR/" "$SITE_DIR/"
fi

# 2. Commit local changes (skip if nothing changed).
if [[ -n "$(git status --porcelain)" ]]; then
  echo "→ Registro le modifiche…"
  git add -A
  git commit -m "$MSG"
else
  echo "→ Nessuna modifica nuova da registrare."
fi

# 3. Push to GitHub — GitHub Actions auto-deploys to Pages.
echo "→ Pubblico su GitHub…"
git push origin main

echo ""
echo "Pubblicato. Il sito permanente si aggiorna tra 1–2 minuti:"
echo "  $PERMANENT_URL"
