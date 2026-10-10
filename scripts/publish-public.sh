#!/usr/bin/env bash
# Publish a clean snapshot of the current HEAD to the public GitHub repo (and so to GitHub Pages).
# - tracked files of HEAD only (git archive), so ignored local-only stock/licensed files never leave the machine;
# - QA raster images under docs/qa are dropped (may contain licensed local captures, and are heavy);
# - history on the public repo is a chain of snapshot commits (the private working history is not pushed).
# Usage: bash scripts/publish-public.sh [owner/repo] [--dry-run]
set -euo pipefail

REPO="${1:-uladzemer/CoverHit}"
DRY=0
for a in "$@"; do [ "$a" = "--dry-run" ] && DRY=1; done
case "$REPO" in --dry-run) REPO="uladzemer/CoverHit";; esac

SRC="$(git rev-parse --show-toplevel)"
SHA="$(git -C "$SRC" rev-parse --short HEAD)"
SUBJECT="$(git -C "$SRC" log -1 --pretty=%s)"
TMP="$(mktemp -d)"
PUB="$TMP/pub"

if [ "$DRY" = 0 ] && gh repo view "$REPO" >/dev/null 2>&1; then
  git clone --quiet "https://github.com/$REPO.git" "$PUB"
else
  mkdir -p "$PUB"; git -C "$PUB" init -q -b main
fi

find "$PUB" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
git -C "$SRC" archive HEAD | tar -x -C "$PUB"
if [ -d "$PUB/docs/qa" ]; then
  find "$PUB/docs/qa" -type f \( -iname '*.png' -o -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.gif' \) -delete
fi

echo "snapshot: $PUB ($(find "$PUB" -type f ! -path '*/.git/*' | wc -l) files)"
if [ "$DRY" = 1 ]; then echo "dry run - nothing pushed"; exit 0; fi

git -C "$PUB" add --all
if git -C "$PUB" diff --cached --quiet; then echo "no changes to publish"; exit 0; fi
git -C "$PUB" -c user.name="$(git -C "$SRC" config user.name || echo uladzemer)" \
  -c user.email="$(git -C "$SRC" config user.email || echo noreply@users.noreply.github.com)" \
  commit -q -m "snapshot $SHA: $SUBJECT"

if gh repo view "$REPO" >/dev/null 2>&1; then
  git -C "$PUB" push origin HEAD:main
else
  gh repo create "$REPO" --public --description "CoverHit - выбей советский ковёр: браузерная 3D-аркада (three.js + Ammo.js)" \
    --source "$PUB" --remote origin --push
fi
echo "published $SHA to https://github.com/$REPO"
