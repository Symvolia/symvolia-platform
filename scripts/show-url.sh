#!/usr/bin/env bash
APP_SUPPORT="$HOME/Library/Application Support/Symvolia"
LOG="$APP_SUPPORT/.run/tunnel.log"
LINK_FILE="$(cd "$(dirname "$0")/.." && pwd)/assets/site-link-tunnel.txt"
PERMANENT_URL="https://symvolia.xyz/"

echo "Locale: http://localhost:8765"
echo "Permanente: symvolia.xyz"
echo ""

url=""
if [[ -f "$LOG" ]]; then
  url="$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$LOG" | tail -1)"
fi

if [[ -n "$url" ]]; then
  printf '%s\n' "$url" > "$LINK_FILE"
  echo "Pubblico: $url"
  echo "Share:    ${url}/share.html"
  exit 0
fi

echo "Pubblico: URL non trovato — attendi qualche secondo e riprova."
