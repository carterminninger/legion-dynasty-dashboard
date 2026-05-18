"""
dynasty_domain_monitor.py — Monitor @thedynastydomain for new YouTube videos and update dynasty rankings.
Purpose:  Fetch recent videos from the Dynasty Domain channel, transcribe new ones, enhance with
          Claude API, and extract dynasty player rankings into dynasty_domain_rankings.json.
Inputs:   None (reads YouTube via yt-dlp; reads scripts/seen_videos.json for state)
          --manual: skip API, parse most recent vault note, commit+push (no API key needed)
Outputs:  Updates public/dynasty_domain_rankings.json; updates scripts/seen_videos.json
          Appends to scripts/dynasty_domain_monitor.log
Dependencies: anthropic>=0.100 (scripts/venv, normal mode only), yt-dlp (CLI),
              stdlib: argparse, json, logging, re, subprocess, pathlib
NOTE: Normal mode makes at most MAX_API_CALLS Anthropic API calls per run — one per new video.
      Cost estimate: ~$0.10-0.15 per video at claude-sonnet-4-6 pricing.
"""

import argparse
import json
import logging
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import anthropic

# ── Config ───────────────────────────────────────────────────────────────────

PROJECT_DIR   = Path(__file__).parent.parent
SCRIPTS_DIR   = Path(__file__).parent
VAULT_YOUTUBE = Path(
    "/Users/carterminninger/Library/Mobile Documents/"
    "iCloud~md~obsidian/Documents/Second Brain/Resources/YouTube Notes"
)
YT_OBSIDIAN  = Path("/Users/carterminninger/Projects/tools/yt_to_obsidian.py")
PARSE_SCRIPT = SCRIPTS_DIR / "dynasty_domain_parse.py"
SEEN_FILE    = SCRIPTS_DIR / "seen_videos.json"
RANKINGS_OUT = PROJECT_DIR / "public" / "dynasty_domain_rankings.json"
LOG_FILE     = SCRIPTS_DIR / "dynasty_domain_monitor.log"

CHANNEL_URL    = "https://www.youtube.com/@thedynastydomain/videos"
PLAYLIST_LIMIT = 10
MAX_API_CALLS  = 10  # hard stop: never exceed this per run
MODEL          = "claude-sonnet-4-6"

RANKING_KEYWORDS = [
    "rankings", "tiers", "cornerstone", "foundational",
    "dynasty ranks", "buy", "sell", "tier list",
]

LOG_FORMAT = "%(asctime)s  %(levelname)-8s  %(message)s"
_file_handler   = logging.FileHandler(LOG_FILE)
_stream_handler = logging.StreamHandler(sys.stdout)
logging.basicConfig(level=logging.INFO, format=LOG_FORMAT,
                    handlers=[_file_handler, _stream_handler])
log = logging.getLogger(__name__)


# ── Helpers ──────────────────────────────────────────────────────────────────

def is_ranking_video(title: str) -> bool:
    t = title.lower()
    return any(kw in t for kw in RANKING_KEYWORDS)


def load_seen() -> dict:
    if SEEN_FILE.exists():
        return json.loads(SEEN_FILE.read_text())
    return {"videos": {}}


def save_seen(seen: dict) -> None:
    SEEN_FILE.write_text(json.dumps(seen, indent=2))


def get_recent_videos() -> list[dict]:
    """Return up to PLAYLIST_LIMIT most recent videos from the channel."""
    result = subprocess.run(
        ["yt-dlp", "--flat-playlist", f"--playlist-end={PLAYLIST_LIMIT}", "-J", CHANNEL_URL],
        capture_output=True, text=True,
    )
    if result.returncode != 0:
        log.error("yt-dlp failed: %s", result.stderr[:400])
        return []
    data = json.loads(result.stdout)
    return data.get("entries") or []


def run_yt_to_obsidian(video_url: str) -> Optional[Path]:
    """Run yt_to_obsidian.py and return the path of the saved note file."""
    result = subprocess.run(
        [sys.executable, str(YT_OBSIDIAN), video_url],
        capture_output=True, text=True,
    )
    if result.returncode != 0:
        log.error("yt_to_obsidian.py failed: %s", result.stderr[:300])
        return None
    m = re.search(r"Saved to:\s*(.+\.md)", result.stdout)
    if not m:
        log.error("Could not parse saved path from yt_to_obsidian output: %s", result.stdout[:300])
        return None
    return Path(m.group(1).strip())


_ENHANCE_SYSTEM = """\
You are enhancing a dynasty fantasy football YouTube transcript note for an Obsidian vault.
You produce structured enhanced notes that can be machine-parsed. Be precise and consistent
with tier labels — these are consumed by a downstream parser."""

_ENHANCE_TEMPLATE = """\
Read the dynasty fantasy football YouTube transcript note below and produce a fully enhanced version.

Return ONLY the complete enhanced markdown file — no explanation, no preamble, no code fences.

OUTPUT STRUCTURE (use exactly these section headers):

---
[copy original frontmatter; ADD these three fields if not already present:]
summary: "[one sentence]"
key_people: []
related_notes: []
---

## Summary
3-5 sentence plain English overview of what this video covers.

## Key Takeaways
7-10 bullet points of the most important dynasty fantasy football concepts or rankings discussed.

## Key People & Mentions
Markdown table with EXACTLY these three columns — spacing doesn't matter but column order does:
| Name | Role / Team | Context |
|------|-------------|---------|
| [player name] | [position, NFL team or empty] | [tier label]; [brief context] |

TIER LABEL RULES — the Context column MUST start with one of these exact formats for ranked players:
  Cornerstone tiers:  "S-tier cornerstone", "A-tier cornerstone", "B-tier cornerstone", "C-tier cornerstone", "D-tier cornerstone"
  Foundational tiers: "Foundational S-tier", "Foundational A-tier", "Foundational B-tier", "Foundational C-tier", "Foundational D-tier"
  Upside Premier:     "Upside premier"
  Depreciating flag:  append "(depreciating pillar)" to the tier label when the video explicitly calls out a player as aging/declining dynasty value

Include ONLY players who are clearly assigned a tier in the video. Skip analysts, tools, or mentions without a tier.
Format: "[tier label]; [brief one-line context]"

## Related Notes
No approved vault nodes are topically connected to dynasty fantasy football content.

## Raw Transcript
[copy the original transcript content VERBATIM — do not alter a single word]

---
NOTE TO ENHANCE:

{note_text}"""


def enhance_with_claude(note_path: Path, client: anthropic.Anthropic) -> bool:
    """
    Call Claude API to add Summary, Key Takeaways, and Key People table.
    Overwrites the note file in place. Returns True on success.
    """
    text = note_path.read_text(encoding="utf-8")
    prompt = _ENHANCE_TEMPLATE.format(note_text=text)

    message = client.messages.create(
        model=MODEL,
        max_tokens=8192,
        system=_ENHANCE_SYSTEM,
        messages=[{"role": "user", "content": prompt}],
    )
    enhanced = message.content[0].text.strip()

    # Validate the critical section exists
    if "## Key People" not in enhanced:
        log.error("Enhanced output missing Key People section — not writing")
        return False

    note_path.write_text(enhanced, encoding="utf-8")
    log.info("Enhanced and saved: %s", note_path.name)
    return True


def run_parse(note_path: Path) -> bool:
    """Run dynasty_domain_parse.py on the enhanced note."""
    result = subprocess.run(
        [sys.executable, str(PARSE_SCRIPT), str(note_path)],
        capture_output=True, text=True,
    )
    if result.returncode != 0:
        log.error("dynasty_domain_parse.py failed: %s", result.stderr[:300])
        return False
    # Forward parse output to log
    for line in (result.stdout + result.stderr).splitlines():
        if line.strip():
            log.info("[parse] %s", line.strip())
    return True


# ── Core ─────────────────────────────────────────────────────────────────────

def process_video(
    video: dict,
    seen: dict,
    client: anthropic.Anthropic,
    api_calls: list[str],
) -> None:
    vid_id = video.get("id", "")
    title  = video.get("title", "")
    url    = f"https://www.youtube.com/watch?v={vid_id}"
    log.info("Processing: %s | %s", vid_id, title)

    # Step 1 — download transcript
    note_path = run_yt_to_obsidian(url)
    if not note_path:
        seen["videos"][vid_id] = _seen_entry(title, url, "transcript_failed")
        return

    # Step 2 — enhance with Claude (hard stop)
    if len(api_calls) >= MAX_API_CALLS:
        log.warning("MAX_API_CALLS (%d) reached — skipping %s", MAX_API_CALLS, vid_id)
        seen["videos"][vid_id] = _seen_entry(title, url, "api_limit_hit")
        return

    ok = enhance_with_claude(note_path, client)
    api_calls.append(vid_id)
    log.info("API calls this run: %d / %d", len(api_calls), MAX_API_CALLS)

    if not ok:
        seen["videos"][vid_id] = _seen_entry(title, url, "enhance_failed")
        return

    # Step 3 — extract rankings only for ranking-content videos
    rankings_updated = False
    if is_ranking_video(title):
        log.info("Ranking video detected — running parser")
        rankings_updated = run_parse(note_path)
    else:
        log.info("Non-ranking video — skipping rankings extraction")

    seen["videos"][vid_id] = {
        **_seen_entry(title, url, "ok"),
        "note_path":        str(note_path),
        "rankings_updated": rankings_updated,
    }
    log.info("Done: %s", vid_id)


def _seen_entry(title: str, url: str, status: str) -> dict:
    return {
        "title":        title,
        "url":          url,
        "processed_at": datetime.now(timezone.utc).isoformat(),
        "status":       status,
    }


# ── CLI arg parsing ───────────────────────────────────────────────────────────

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Monitor @thedynastydomain and update dynasty rankings"
    )
    parser.add_argument(
        "--manual", action="store_true",
        help=(
            "Skip API enhancement. Parse the most recently modified note in the "
            "vault YouTube Notes folder, then commit and push the updated rankings. "
            "No ANTHROPIC_API_KEY required."
        ),
    )
    return parser.parse_args()


# ── Manual mode ───────────────────────────────────────────────────────────────

def _git(args: list[str]) -> subprocess.CompletedProcess:
    return subprocess.run(
        ["/usr/bin/git", "-C", str(PROJECT_DIR)] + args,
        capture_output=True, text=True,
    )


def run_manual() -> None:
    """Parse the most recently modified vault note and commit+push rankings."""
    log.info("=== Manual mode — no API call ===")

    notes = sorted(VAULT_YOUTUBE.glob("*.md"), key=lambda p: p.stat().st_mtime, reverse=True)
    if not notes:
        log.error("No .md files found in %s", VAULT_YOUTUBE)
        sys.exit(1)

    note_path = notes[0]
    log.info("Most recent note: %s", note_path.name)

    if not run_parse(note_path):
        log.error("Parse failed — aborting")
        sys.exit(1)

    # Stage rankings file
    r = _git(["add", str(RANKINGS_OUT)])
    if r.returncode != 0:
        log.error("git add failed: %s", r.stderr.strip())
        sys.exit(1)

    # Nothing staged → no-op
    if _git(["diff", "--cached", "--quiet"]).returncode == 0:
        log.info("dynasty_domain_rankings.json unchanged — nothing to commit")
        log.info("=== done (no-op) ===")
        return

    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    r = _git(["commit", "-m", f"chore: dynasty rankings refresh {timestamp}"])
    if r.returncode != 0:
        log.error("git commit failed: %s", r.stderr.strip())
        sys.exit(1)
    log.info("Committed: %s", r.stdout.strip())

    r = _git(["push", "origin", "main"])
    if r.returncode != 0:
        log.error("git push failed: %s", r.stderr.strip())
        sys.exit(1)
    log.info("Pushed to origin/main")
    log.info("=== done ===")


def main() -> None:
    args = parse_args()

    if args.manual:
        run_manual()
        return

    log.info("=== Dynasty Domain monitor started ===")

    client = anthropic.Anthropic()  # reads ANTHROPIC_API_KEY from env

    seen = load_seen()
    log.info("seen_videos.json: %d previously processed", len(seen.get("videos", {})))

    videos = get_recent_videos()
    log.info("Recent videos fetched: %d", len(videos))

    new_videos = [v for v in videos if v.get("id") not in seen.get("videos", {})]
    log.info("New videos to process: %d", len(new_videos))

    if not new_videos:
        log.info("No new videos — nothing to do")
        log.info("=== done (no-op) ===")
        return

    api_calls: list[str] = []

    for video in new_videos:
        try:
            process_video(video, seen, client, api_calls)
        except anthropic.AuthenticationError as exc:
            # Auth failure means ANTHROPIC_API_KEY is missing/invalid — do NOT mark as seen
            # so the video will be retried once the key is configured.
            log.error("Auth error — ANTHROPIC_API_KEY not set or invalid: %s", exc)
            log.error("Set ANTHROPIC_API_KEY in the environment and re-run. Stopping.")
            save_seen(seen)
            sys.exit(1)
        except Exception as exc:
            log.error("Unhandled error for %s: %s", video.get("id"), exc, exc_info=True)
            seen["videos"][video["id"]] = _seen_entry(
                video.get("title", ""), f"https://www.youtube.com/watch?v={video.get('id','')}",
                f"error: {exc}",
            )
        finally:
            save_seen(seen)  # save after each video so crashes don't lose state

    log.info(
        "=== done — %d new videos, %d API calls used ===",
        len(new_videos), len(api_calls),
    )


if __name__ == "__main__":
    main()

# CHANGELOG: added --manual flag — skips API, parses most recent vault note, commits and pushes
