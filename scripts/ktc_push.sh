#!/bin/bash
# Scrape KTC values, commit ktc_live.json, and push to GitHub.
# Designed to run via launchd on Mac wake. Logs to scripts/ktc_scrape.log.

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LOG_FILE="$PROJECT_DIR/scripts/ktc_scrape.log"
PYTHON="$PROJECT_DIR/scripts/venv/bin/python3"
GIT="/usr/bin/git"

log() { printf '%s  %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" >> "$LOG_FILE"; }

log "=== KTC push started ==="

# ── 1. Scrape ─────────────────────────────────────────────────────────────────
if ! "$PYTHON" "$PROJECT_DIR/scripts/ktc_scrape.py" >> "$LOG_FILE" 2>&1; then
    log "ERROR: ktc_scrape.py failed — aborting"
    exit 1
fi

# ── 2. Stage ──────────────────────────────────────────────────────────────────
cd "$PROJECT_DIR"
"$GIT" add public/ktc_live.json >> "$LOG_FILE" 2>&1

if "$GIT" diff --cached --quiet; then
    log "No changes detected in ktc_live.json — skipping commit"
    log "=== done (no-op) ==="
    exit 0
fi

# ── 3. Commit ─────────────────────────────────────────────────────────────────
TIMESTAMP="$(date '+%Y-%m-%d %H:%M UTC')"
if ! "$GIT" commit -m "chore: KTC values refresh $TIMESTAMP" >> "$LOG_FILE" 2>&1; then
    log "ERROR: git commit failed"
    exit 1
fi

# ── 4. Push ───────────────────────────────────────────────────────────────────
if ! "$GIT" push origin main >> "$LOG_FILE" 2>&1; then
    log "ERROR: git push failed"
    exit 1
fi

log "Push to GitHub complete"

# ── 5. Deploy to Vercel ───────────────────────────────────────────────────────
# Runs every time so deploys are reliable regardless of GitHub-Vercel link status.
# Once GitHub auto-deploy is wired in Vercel dashboard, this becomes a no-op safety net.
VERCEL="/opt/homebrew/bin/vercel"
if [[ -x "$VERCEL" ]]; then
    if ! "$VERCEL" deploy --prod --yes >> "$LOG_FILE" 2>&1; then
        log "WARNING: vercel deploy failed — ktc_live.json is committed to GitHub but Vercel may be stale"
    else
        log "Vercel production deploy triggered"
    fi
else
    log "WARNING: vercel CLI not found at $VERCEL — skipping deploy"
fi

log "=== KTC push complete ==="
