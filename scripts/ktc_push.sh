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

# ── 1. KTC Scrape ─────────────────────────────────────────────────────────────
if ! "$PYTHON" "$PROJECT_DIR/scripts/ktc_scrape.py" >> "$LOG_FILE" 2>&1; then
    log "ERROR: ktc_scrape.py failed — aborting"
    exit 1
fi

# ── 1b. Combine Scrape (only if file is missing or older than 7 days) ─────────
COMBINE_JSON="$PROJECT_DIR/public/combine_data.json"
if "$PYTHON" -c "
import sys, time
from pathlib import Path
p = Path('$COMBINE_JSON')
if not p.exists() or (time.time() - p.stat().st_mtime) > 7 * 86400:
    sys.exit(0)   # needs refresh
sys.exit(1)       # still fresh
"; then
    log "combine_data.json missing or stale — running combine_scrape.py"
    if ! "$PYTHON" "$PROJECT_DIR/scripts/combine_scrape.py" >> "$LOG_FILE" 2>&1; then
        log "WARNING: combine_scrape.py failed — continuing without combine refresh"
    fi
else
    log "combine_data.json is fresh (< 7 days) — skipping combine scrape"
fi

# ── 1c. Dynasty Domain monitor (new videos → dynasty_domain_rankings.json) ────
# Load ANTHROPIC_API_KEY from ~/.anthropic_key if not already in environment (launchd doesn't
# inherit shell vars, so the key must be stored in a separate file for daemon contexts).
if [ -z "${ANTHROPIC_API_KEY:-}" ] && [ -f "$HOME/.anthropic_key" ]; then
    export ANTHROPIC_API_KEY="$(cat "$HOME/.anthropic_key")"
    log "Loaded ANTHROPIC_API_KEY from ~/.anthropic_key"
fi
if [ -z "${ANTHROPIC_API_KEY:-}" ]; then
    log "WARNING: ANTHROPIC_API_KEY not set — skipping dynasty_domain_monitor.py"
else
    if ! "$PYTHON" "$PROJECT_DIR/scripts/dynasty_domain_monitor.py" >> "$LOG_FILE" 2>&1; then
        log "WARNING: dynasty_domain_monitor.py failed — continuing without rankings refresh"
    fi
fi

# ── 2. Stage ──────────────────────────────────────────────────────────────────
cd "$PROJECT_DIR"
"$GIT" add public/ktc_live.json public/combine_data.json public/dynasty_domain_rankings.json >> "$LOG_FILE" 2>&1

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

log "=== KTC push complete ==="
