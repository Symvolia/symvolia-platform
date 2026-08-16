#!/usr/bin/env bash
# Publish to GitHub Pages — permanent URL: https://symvolia.xyz/
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
REPO="Symvolia/symvolia-platform"
PERMANENT_URL="https://symvolia.xyz/"
LINK_FILE="$PROJECT_DIR/assets/site-link.txt"

cd "$PROJECT_DIR"

printf '%s\n' "$PERMANENT_URL" > "$LINK_FILE"

if ! git rev-parse --git-dir &>/dev/null; then
  git init
  git branch -M main
fi

if [[ -n "$(git status --porcelain)" ]]; then
  git add -A
  git commit -m "$(cat <<'EOF'
Publish Symvolia platform site for GitHub Pages.

Permanent URL: https://symvolia.xyz/
EOF
)" || true
fi

if git remote get-url origin &>/dev/null; then
  git remote set-url origin "https://github.com/${REPO}.git"
else
  git remote add origin "https://github.com/${REPO}.git"
fi

echo "Repository: https://github.com/${REPO}"
echo "Permanent URL: ${PERMANENT_URL}"
echo ""
echo "Push su GitHub…"
echo "  Username: Symvolia"
echo "  Password: Personal Access Token (scope: repo)"
echo ""

git push -u origin main

echo ""
echo "Ultimo passo (solo la prima volta):"
echo "  https://github.com/${REPO}/settings/pages"
echo "  Source → GitHub Actions"
echo ""
echo "Dopo 1–2 minuti: ${PERMANENT_URL}"
