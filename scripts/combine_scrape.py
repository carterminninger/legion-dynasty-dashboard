"""
NFL Combine Data Scraper
Purpose:  Download the nflverse combine CSV (all years 2000–present) and write
          public/combine_data.json keyed by player name for dashboard consumption.
Inputs:   None (fetches from nflverse GitHub releases via HTTP)
Outputs:  ../public/combine_data.json — top-level keys: scraped_at, player_count, players
          players is a dict keyed by player full name (e.g. "Bijan Robinson")
Dependencies: requests (pip, scripts/venv), stdlib: csv, io, re, json, logging, argparse, pathlib
"""

import argparse
import csv
import io
import json
import logging
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import requests

# ── Config ────────────────────────────────────────────────────────────────────

CSV_URL    = "https://github.com/nflverse/nflverse-data/releases/download/combine/combine.csv"
OUT_PATH   = Path(__file__).parent.parent / "public" / "combine_data.json"
MIN_SEASON = 2018                      # only keep players from this year forward
LOG_FORMAT = "%(asctime)s  %(levelname)-8s  %(message)s"

logging.basicConfig(level=logging.INFO, format=LOG_FORMAT)
log = logging.getLogger(__name__)

UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)

# ── Helpers ───────────────────────────────────────────────────────────────────

def _float(val: str) -> Optional[float]:
    """Return float or None for blank/non-numeric cells."""
    v = val.strip()
    if not v:
        return None
    try:
        return float(v)
    except ValueError:
        return None


def _int(val: str) -> Optional[int]:
    f = _float(val)
    return int(f) if f is not None else None


def parse_height(ht: str) -> Optional[int]:
    """Convert nflverse height string '6-4' to integer inches (76)."""
    if not ht:
        return None
    m = re.match(r'^(\d+)-(\d+)$', ht.strip())
    if m:
        return int(m.group(1)) * 12 + int(m.group(2))
    return None


# ── Core ──────────────────────────────────────────────────────────────────────

def fetch_csv() -> str:
    log.info("Fetching combine CSV from nflverse: %s", CSV_URL)
    res = requests.get(CSV_URL, headers={"User-Agent": UA}, timeout=30)
    res.raise_for_status()
    log.info("HTTP %s  %d bytes", res.status_code, len(res.content))
    return res.text


def parse_players(csv_text: str, min_season: int) -> dict[str, dict]:
    """
    Parse the nflverse combine CSV and return a dict keyed by player_name.
    When a player appears in multiple seasons, the most recent entry wins.
    Only players from min_season onward are included.
    """
    reader   = csv.DictReader(io.StringIO(csv_text))
    combined: dict[str, dict] = {}

    for row in reader:
        season = _int(row.get("season", ""))
        if season is None or season < min_season:
            continue

        name = row.get("player_name", "").strip()
        if not name:
            continue

        entry = {
            "name":       name,
            "season":     season,
            "pos":        row.get("pos",    "").strip() or None,
            "school":     row.get("school", "").strip() or None,
            "height_in":  parse_height(row.get("ht", "")),
            "weight_lbs": _int(row.get("wt",      "")),
            "forty":      _float(row.get("forty",  "")),
            "bench":      _int(row.get("bench",    "")),
            "vertical":   _float(row.get("vertical",   "")),
            "broad_jump": _int(row.get("broad_jump",   "")),
            "three_cone": _float(row.get("cone",   "")),
            "shuttle":    _float(row.get("shuttle", "")),
        }

        existing = combined.get(name)
        if existing is None or (entry["season"] or 0) >= (existing.get("season") or 0):
            combined[name] = entry

    return combined


def write_output(players: dict[str, dict]) -> None:
    payload = {
        "scraped_at":   datetime.now(timezone.utc).isoformat(),
        "player_count": len(players),
        "players":      players,
    }
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(payload, indent=2))
    log.info("Wrote %d players to %s", len(players), OUT_PATH)


# ── CLI ───────────────────────────────────────────────────────────────────────

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Download and cache NFL combine data from nflverse (2018–present)"
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Fetch and parse but do not write output file",
    )
    parser.add_argument(
        "--min-season", type=int, default=MIN_SEASON,
        metavar="YEAR", help=f"Earliest season to include (default: {MIN_SEASON})",
    )
    parser.add_argument(
        "--names", nargs="+", metavar="NAME",
        help='Test name lookups, e.g. --names "Bijan Robinson" "Ja\'Marr Chase"',
    )
    return parser.parse_args()


def main() -> None:
    args    = parse_args()
    csv_txt = fetch_csv()
    players = parse_players(csv_txt, args.min_season)

    log.info("Parsed %d players (season >= %d)", len(players), args.min_season)

    if args.names:
        log.info("--- Name lookup test ---")
        for name in args.names:
            result = players.get(name)
            if result:
                log.info("  FOUND %r: %s", name, json.dumps(result))
            else:
                log.info("  NOT FOUND: %r", name)
        return

    with_forty = sum(1 for p in players.values() if p.get("forty"))
    log.info("Players with 40-time: %d / %d", with_forty, len(players))

    if not args.dry_run:
        write_output(players)
    else:
        log.info("Dry run — skipping file write")
        log.info("Top 5 by forty time:")
        fastest = sorted(
            [(n, p) for n, p in players.items() if p.get("forty")],
            key=lambda x: x[1]["forty"]
        )
        for name, p in fastest[:5]:
            log.info("  %-22s %s  %s  forty=%.2f", name, p.get("season"), p.get("pos"), p["forty"])


if __name__ == "__main__":
    main()

# CHANGELOG: rewrote to use nflverse CSV (single URL, all years) after nflcombineresults.com deprecated year param
