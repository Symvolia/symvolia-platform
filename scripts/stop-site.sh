#!/usr/bin/env bash
set -euo pipefail

LABEL="com.symvolia.site"
PLIST="$HOME/Library/LaunchAgents/${LABEL}.plist"
APP_SUPPORT="$HOME/Library/Application Support/Symvolia"
PORT=8765

if [[ -f "$PLIST" ]]; then
  launchctl bootout "gui/$(id -u)/${LABEL}" 2>/dev/null || launchctl unload "$PLIST" 2>/dev/null || true
fi

LOG_DIR="$APP_SUPPORT/.run"
[[ -f "$LOG_DIR/server.pid" ]] && kill "$(cat "$LOG_DIR/server.pid")" 2>/dev/null || true
[[ -f "$LOG_DIR/tunnel.pid" ]] && kill "$(cat "$LOG_DIR/tunnel.pid")" 2>/dev/null || true
lsof -ti :"$PORT" 2>/dev/null | xargs kill -9 2>/dev/null || true
pkill -f "cloudflared tunnel --url http://localhost:8765" 2>/dev/null || true

echo "Symvolia site service stopped."
