#!/usr/bin/env bash
# Symvolia site — local server + public tunnel (launchd, no Documents TCC)
set -euo pipefail

APP_SUPPORT="$HOME/Library/Application Support/Symvolia"
SITE_DIR="$APP_SUPPORT/site"
LOG_DIR="$APP_SUPPORT/.run"
PORT=8765
CLOUDFLARED="$APP_SUPPORT/bin/cloudflared"
SERVER_PID_FILE="$LOG_DIR/server.pid"
TUNNEL_PID_FILE="$LOG_DIR/tunnel.pid"

mkdir -p "$LOG_DIR"
cd "$SITE_DIR"

if [[ ! -x "$CLOUDFLARED" ]]; then
  echo "cloudflared missing at $CLOUDFLARED" >> "$LOG_DIR/error.log"
  exit 1
fi

if [[ ! -f "$SITE_DIR/index.html" ]]; then
  echo "site missing at $SITE_DIR" >> "$LOG_DIR/error.log"
  exit 1
fi

if [[ -f "$SERVER_PID_FILE" ]]; then
  kill "$(cat "$SERVER_PID_FILE")" 2>/dev/null || true
fi
if [[ -f "$TUNNEL_PID_FILE" ]]; then
  kill "$(cat "$TUNNEL_PID_FILE")" 2>/dev/null || true
fi

lsof -ti :"$PORT" 2>/dev/null | xargs kill -9 2>/dev/null || true
sleep 1

/usr/bin/python3 -m http.server "$PORT" >> "$LOG_DIR/server.log" 2>&1 &
SERVER_PID=$!
echo "$SERVER_PID" > "$SERVER_PID_FILE"

sleep 1

if ! kill -0 "$SERVER_PID" 2>/dev/null; then
  echo "HTTP server failed to start" >> "$LOG_DIR/error.log"
  exit 1
fi

"$CLOUDFLARED" tunnel --url "http://localhost:$PORT" >> "$LOG_DIR/tunnel.log" 2>&1 &
TUNNEL_PID=$!
echo "$TUNNEL_PID" > "$TUNNEL_PID_FILE"

while true; do
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    /usr/bin/python3 -m http.server "$PORT" >> "$LOG_DIR/server.log" 2>&1 &
    SERVER_PID=$!
    echo "$SERVER_PID" > "$SERVER_PID_FILE"
    sleep 1
  fi

  if ! kill -0 "$TUNNEL_PID" 2>/dev/null; then
    "$CLOUDFLARED" tunnel --url "http://localhost:$PORT" >> "$LOG_DIR/tunnel.log" 2>&1 &
    TUNNEL_PID=$!
    echo "$TUNNEL_PID" > "$TUNNEL_PID_FILE"
  fi

  sleep 10
done
