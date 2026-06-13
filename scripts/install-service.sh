#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
APP_SUPPORT="$HOME/Library/Application Support/Symvolia"
SITE_DIR="$APP_SUPPORT/site"
LABEL="com.symvolia.site"
PLIST_SRC="$PROJECT_DIR/scripts/${LABEL}.plist"
PLIST_DST="$HOME/Library/LaunchAgents/${LABEL}.plist"
CLOUDFLARED="$APP_SUPPORT/bin/cloudflared"

echo "Syncing site to Application Support…"
mkdir -p "$APP_SUPPORT/bin" "$SITE_DIR" "$APP_SUPPORT/scripts"
rsync -a --delete \
  --exclude '.git' \
  --exclude '.run' \
  --exclude 'bin' \
  --exclude 'scripts' \
  "$PROJECT_DIR/" "$SITE_DIR/"

cp "$PROJECT_DIR/scripts/run-site.sh" "$APP_SUPPORT/scripts/run-site.sh"
chmod +x "$APP_SUPPORT/scripts/run-site.sh"

if [[ ! -x "$CLOUDFLARED" ]]; then
  echo "Downloading cloudflared…"
  ARCH="$(uname -m)"
  if [[ "$ARCH" == "arm64" ]]; then CF_ARCH="arm64"; else CF_ARCH="amd64"; fi
  curl -fsSL -o /tmp/cloudflared.tgz \
    "https://github.com/cloudflare/cloudflared/releases/download/2025.4.0/cloudflared-darwin-${CF_ARCH}.tgz"
  tar -xzf /tmp/cloudflared.tgz -C /tmp cloudflared
  mv /tmp/cloudflared "$CLOUDFLARED"
  chmod +x "$CLOUDFLARED"
fi

mkdir -p "$HOME/Library/LaunchAgents"
cp "$PLIST_SRC" "$PLIST_DST"

"$PROJECT_DIR/scripts/stop-site.sh" 2>/dev/null || true
sleep 1

launchctl bootstrap "gui/$(id -u)" "$PLIST_DST" 2>/dev/null || launchctl load "$PLIST_DST"

echo ""
echo "Servizio installato. Il sito resta attivo anche se chiudi Cursor."
echo ""
echo "Locale:  http://localhost:8765"
echo ""
echo "Link pubblico (dopo ~10s):"
echo "  $PROJECT_DIR/scripts/show-url.sh"
echo ""
echo "Dopo modifiche al sito, aggiorna la copia in esecuzione:"
echo "  $PROJECT_DIR/scripts/refresh-service.sh"
echo ""
echo "Per fermare:"
echo "  $PROJECT_DIR/scripts/stop-site.sh"
