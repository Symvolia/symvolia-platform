#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
APP_SUPPORT="$HOME/Library/Application Support/Symvolia"
SITE_DIR="$APP_SUPPORT/site"
LOG="$APP_SUPPORT/.run/tunnel.log"
LINK_FILE="$PROJECT_DIR/assets/site-link-tunnel.txt"
LABEL="com.symvolia.site"

sync_files() {
  mkdir -p "$SITE_DIR"
  rsync -a --delete \
    --exclude '.git' \
    --exclude '.run' \
    --exclude 'bin' \
    --exclude 'scripts' \
    "$PROJECT_DIR/" "$SITE_DIR/"
}

save_public_url() {
  local url=""
  if [[ -f "$LOG" ]]; then
    url="$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$LOG" | tail -1)"
  fi
  if [[ -n "$url" ]]; then
    printf '%s\n' "$url" > "$LINK_FILE"
    mkdir -p "$SITE_DIR/assets"
    printf '%s\n' "$url" > "$SITE_DIR/assets/site-link-tunnel.txt"
    return 0
  fi
  return 1
}

echo "Syncing latest site files…"
sync_files

launchctl kickstart -k "gui/$(id -u)/${LABEL}" 2>/dev/null || \
  "$PROJECT_DIR/scripts/install-service.sh"

echo "Attendo nuovo link pubblico…"
for _ in $(seq 1 20); do
  if save_public_url; then
    break
  fi
  sleep 1
done

sync_files

echo "Sito aggiornato e servizio riavviato."
echo ""
echo "Locale:  http://localhost:8765"
if [[ -f "$LINK_FILE" ]]; then
  url="$(cat "$LINK_FILE")"
  echo "Pubblico: $url"
  echo "Share:    ${url}/share.html"
else
  echo "Pubblico: ./scripts/show-url.sh"
fi
