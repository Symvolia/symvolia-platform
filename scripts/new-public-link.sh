#!/usr/bin/env bash
# Rotate Cloudflare quick tunnel and save new public URL for share page
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
APP_SUPPORT="$HOME/Library/Application Support/Symvolia"
SERVE_DIR="$APP_SUPPORT/site"
LOG_DIR="$APP_SUPPORT/.run"
LOG="$LOG_DIR/tunnel.log"
LINK_FILE="$PROJECT_DIR/assets/site-link-tunnel.txt"
PORT=8765
CLOUDFLARED="$APP_SUPPORT/bin/cloudflared"
LABEL="com.symvolia.site"
PLIST="$HOME/Library/LaunchAgents/${LABEL}.plist"

if [[ ! -x "$CLOUDFLARED" ]]; then
  echo "cloudflared non trovato. Esegui prima: ./scripts/install-service.sh"
  exit 1
fi

echo "Rotazione tunnel…"

if [[ -f "$PLIST" ]]; then
  launchctl bootout "gui/$(id -u)/${LABEL}" 2>/dev/null || true
fi

pkill -f "cloudflared tunnel --url http://localhost:${PORT}" 2>/dev/null || true
sleep 1

"$CLOUDFLARED" tunnel --url "http://localhost:${PORT}" >> "$LOG" 2>&1 &
TUNNEL_PID=$!
echo "$TUNNEL_PID" > "$LOG_DIR/tunnel.pid"

echo "Generazione nuovo link…"

url=""
for _ in $(seq 1 45); do
  if [[ -f "$LOG" ]]; then
    url="$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$LOG" | tail -1)"
    if [[ -n "$url" ]]; then
      break
    fi
  fi
  sleep 1
done

if [[ -z "$url" ]]; then
  echo "Errore: URL non generato. Controlla $LOG"
  exit 1
fi

printf '%s\n' "$url" > "$LINK_FILE"

SERVE_DIR="$APP_SUPPORT/site"
if [[ -d "$SERVE_DIR" ]]; then
  rsync -a --delete \
    --exclude '.git' \
    --exclude '.run' \
    --exclude 'bin' \
    --exclude 'scripts' \
    "$PROJECT_DIR/" "$SERVE_DIR/"
fi

echo ""
echo "Nuovo link pubblico (adattabile):"
echo "  $url"
echo ""
echo "Pagina di condivisione:"
echo "  ${url}/share.html"
echo "  oppure locale: http://localhost:${PORT}/share.html"
