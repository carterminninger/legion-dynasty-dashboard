"""
KTC Dynasty Rankings Scraper
Purpose:  Scrape live SF values from keeptradecut.com/dynasty-rankings
          and write a keyed JSON file for the dashboard to consume.
Inputs:   None (hits KTC over HTTP)
Outputs:  ../public/ktc_live.json
Dependencies: cloudscraper (installed in scripts/venv/)
"""

import argparse
import json
import logging
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

import cloudscraper

# ── Config ────────────────────────────────────────────────────────────────────

KTC_URL    = "https://keeptradecut.com/dynasty-rankings"
OUT_PATH   = Path(__file__).parent.parent / "public" / "ktc_live.json"
LOG_FORMAT = "%(asctime)s  %(levelname)-8s  %(message)s"

logging.basicConfig(level=logging.INFO, format=LOG_FORMAT)
log = logging.getLogger(__name__)

# ── Core ──────────────────────────────────────────────────────────────────────

def fetch_html() -> str:
    log.info("Fetching %s", KTC_URL)
    scraper = cloudscraper.create_scraper(
        browser={"browser": "chrome", "platform": "darwin", "mobile": False}
    )
    res = scraper.get(KTC_URL, timeout=30)
    res.raise_for_status()
    log.info("HTTP %s  %d bytes", res.status_code, len(res.text))
    return res.text


def parse_players(html: str) -> list[dict]:
    m = re.search(r"var playersArray\s*=\s*(\[.+?\]);", html, re.DOTALL)
    if not m:
        raise ValueError("playersArray not found in page — KTC may have changed their markup")
    raw: list[dict] = json.loads(m.group(1))
    log.info("Parsed %d players from playersArray", len(raw))
    return raw


def normalize(raw: list[dict]) -> dict:
    """Return a dict keyed by player name for O(1) dashboard lookup."""
    players: dict[str, dict] = {}
    for p in raw:
        name = p.get("playerName")
        if not name:
            continue
        sf = p.get("superflexValues") or {}
        players[name] = {
            "playerID":    p.get("playerID"),
            "position":    p.get("position"),
            "team":        p.get("team") or "FA",
            "age":         p.get("age"),
            "sf_value":    sf.get("value"),
            "sf_rank":     sf.get("rank"),
            "sf_pos_rank": sf.get("positionalRank"),
            "sf_trend_7d": sf.get("overall7DayTrend", 0),
        }
    return players


def write_output(players: dict) -> None:
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
    parser = argparse.ArgumentParser(description="Scrape KTC dynasty SF values")
    parser.add_argument("--dry-run", action="store_true",
                        help="Fetch and parse but do not write output file")
    parser.add_argument("--top", type=int, default=10,
                        help="Print top N players after scraping (default 10)")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    try:
        html    = fetch_html()
        raw     = parse_players(html)
        players = normalize(raw)

        if len(players) < 100:
            log.error(
                "Parsed only %d players — expected at least 100; "
                "aborting to avoid overwriting %s with incomplete data",
                len(players), OUT_PATH,
            )
            sys.exit(1)

        if not args.dry_run:
            write_output(players)
        else:
            log.info("Dry run — skipping file write (%d players validated)", len(players))

        # Print preview sorted by SF value
        ranked = sorted(players.items(), key=lambda x: x[1]["sf_value"] or 0, reverse=True)
        log.info("Top %d by SF value:", args.top)
        for i, (name, p) in enumerate(ranked[: args.top], 1):
            trend = p["sf_trend_7d"] or 0
            sign  = "+" if trend > 0 else ""
            log.info("  #%-3d %-22s %s  %-4s  SF:%-6d  7d:%s%d",
                     i, name, p["position"], p["team"],
                     p["sf_value"] or 0, sign, trend)

    except Exception as exc:
        log.error("Scrape failed: %s", exc)
        sys.exit(1)


if __name__ == "__main__":
    main()
