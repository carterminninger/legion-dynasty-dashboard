"""
dynasty_domain_parse.py — Parse an enhanced Obsidian YouTube note and extract dynasty rankings.
Purpose:  Read the Key People & Mentions table from an enhanced note, extract tier/category
          per player, and write (merging) structured JSON to public/dynasty_domain_rankings.json.
Inputs:   Path to an enhanced Obsidian markdown file (positional arg, or auto-detects most recent)
Outputs:  ~/Projects/legion-dynasty-dashboard/public/dynasty_domain_rankings.json
Dependencies: stdlib only: re, json, logging, argparse, pathlib
"""

import argparse
import json
import logging
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

# ── Config ───────────────────────────────────────────────────────────────────

OUT_PATH      = Path(__file__).parent.parent / "public" / "dynasty_domain_rankings.json"
VAULT_YOUTUBE = Path(
    "/Users/carterminninger/Library/Mobile Documents/"
    "iCloud~md~obsidian/Documents/Second Brain/Resources/YouTube Notes"
)

LOG_FORMAT = "%(asctime)s  %(levelname)-8s  %(message)s"
logging.basicConfig(level=logging.INFO, format=LOG_FORMAT)
log = logging.getLogger(__name__)

# Tier extraction patterns
_RE_CORNERSTONE  = re.compile(r'\b([SABCD])-tier\s+cornerstone', re.IGNORECASE)
_RE_FOUNDATIONAL = re.compile(r'\bFoundational\s+([SABCD])-tier', re.IGNORECASE)
_RE_UPSIDE       = re.compile(r'\bupside\s+premier\b', re.IGNORECASE)
_RE_DEPRECIATING = re.compile(r'\bdepreciating\s+pillar\b', re.IGNORECASE)


# ── Parsers ──────────────────────────────────────────────────────────────────

def parse_frontmatter(text: str) -> dict:
    m = re.match(r'^---\s*\n(.*?)\n---', text, re.DOTALL)
    if not m:
        return {}
    front = m.group(1)
    result: dict = {}
    for key in ("title", "source", "date"):
        km = re.search(rf'^{key}:\s*"?(.+?)"?\s*$', front, re.MULTILINE)
        if km:
            result[key] = km.group(1).strip().strip('"')
    return result


def parse_key_people_table(text: str) -> list[dict]:
    """Find ## Key People & Mentions section and parse its markdown table rows."""
    section_m = re.search(
        r'##\s+Key People.*?\n(.*?)(?=\n##\s|\Z)',
        text, re.DOTALL | re.IGNORECASE
    )
    if not section_m:
        log.warning("No 'Key People & Mentions' section found")
        return []

    rows: list[dict] = []
    in_table = False
    for line in section_m.group(1).splitlines():
        line = line.strip()
        if not line.startswith("|"):
            continue
        # Header row
        if "Name" in line and ("Role" in line or "Context" in line):
            in_table = True
            continue
        # Separator row
        if re.match(r'^\|[\s\-|]+\|$', line):
            continue
        if not in_table:
            continue
        cells = [c.strip() for c in line.strip("|").split("|")]
        if len(cells) < 3:
            continue
        rows.append({
            "name":    cells[0],
            "role":    cells[1],
            "context": cells[2],
        })
    return rows


def extract_tier(context: str) -> Optional[dict]:
    """
    Return {category, tier, depreciating_pillar} if a tier pattern is found, else None.
    """
    m = _RE_CORNERSTONE.search(context)
    if m:
        return {
            "category": "Cornerstone",
            "tier": m.group(1).upper(),
            "depreciating_pillar": bool(_RE_DEPRECIATING.search(context)),
        }

    m = _RE_FOUNDATIONAL.search(context)
    if m:
        return {
            "category": "Foundational",
            "tier": m.group(1).upper(),
            "depreciating_pillar": bool(_RE_DEPRECIATING.search(context)),
        }

    if _RE_UPSIDE.search(context):
        return {
            "category": "Upside Premier",
            "tier": "S",
            "depreciating_pillar": False,
        }

    return None


# ── Core ─────────────────────────────────────────────────────────────────────

def parse_note(note_path: Path) -> dict:
    text  = note_path.read_text(encoding="utf-8")
    meta  = parse_frontmatter(text)
    rows  = parse_key_people_table(text)

    players: dict[str, dict] = {}
    skipped = 0

    for row in rows:
        name    = row["name"]
        context = row["context"]
        if not name or not context:
            continue

        tier_info = extract_tier(context)
        if tier_info is None:
            skipped += 1
            continue

        players[name] = {
            "name":               name,
            "category":           tier_info["category"],
            "tier":               tier_info["tier"],
            "depreciating_pillar": tier_info["depreciating_pillar"],
            "context":            context,
            "source_video":       meta.get("title", ""),
            "source_date":        meta.get("date", ""),
            "source_url":         meta.get("source", ""),
        }

    log.info("Parsed %d players, skipped %d non-tier rows", len(players), skipped)
    return {
        "scraped_at":   datetime.now(timezone.utc).isoformat(),
        "video_title":  meta.get("title", ""),
        "video_url":    meta.get("source", ""),
        "source_date":  meta.get("date", ""),
        "player_count": len(players),
        "players":      players,
    }


def merge_and_write(new_data: dict, out_path: Path) -> None:
    """Merge new_data into the existing file (new data wins per player name)."""
    existing: dict = {"players": {}}
    if out_path.exists():
        try:
            existing = json.loads(out_path.read_text())
        except json.JSONDecodeError:
            log.warning("Existing rankings file is corrupt — overwriting")

    merged_players = {**existing.get("players", {}), **new_data["players"]}

    payload = {
        "scraped_at":   new_data["scraped_at"],
        "video_title":  new_data["video_title"],
        "video_url":    new_data["video_url"],
        "source_date":  new_data["source_date"],
        "player_count": len(merged_players),
        "players":      merged_players,
    }

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(payload, indent=2))
    log.info("Wrote %d total players to %s", len(merged_players), out_path)


# ── CLI ──────────────────────────────────────────────────────────────────────

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Parse an enhanced Obsidian YouTube note and extract dynasty rankings JSON"
    )
    parser.add_argument(
        "note_path", nargs="?", default=None,
        help="Path to enhanced markdown file (default: most recent in vault YouTube Notes)",
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Parse and print results without writing output file",
    )
    parser.add_argument(
        "--out", type=Path, default=OUT_PATH,
        metavar="PATH", help=f"Output JSON path (default: {OUT_PATH})",
    )
    return parser.parse_args()


def resolve_note_path(arg: Optional[str]) -> Path:
    if arg:
        return Path(arg)
    notes = list(VAULT_YOUTUBE.glob("*.md"))
    if not notes:
        raise FileNotFoundError(f"No .md files found in {VAULT_YOUTUBE}")
    return max(notes, key=lambda p: p.stat().st_mtime)


def main() -> None:
    args      = parse_args()
    note_path = resolve_note_path(args.note_path)
    log.info("Parsing: %s", note_path.name)

    data = parse_note(note_path)
    log.info("Video   : %s", data["video_title"])
    log.info("Players : %d", data["player_count"])

    if args.dry_run:
        log.info("Dry run — skipping file write")
        for name, p in data["players"].items():
            log.info(
                "  %-26s  %-15s  %s-tier%s",
                name, p["category"], p["tier"],
                "  [DEPR]" if p["depreciating_pillar"] else "",
            )
    else:
        merge_and_write(data, args.out)


if __name__ == "__main__":
    main()

# CHANGELOG: initial implementation — parses Key People table tier patterns, merges into existing rankings JSON
