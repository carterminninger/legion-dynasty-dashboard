"""
Tests for scripts/ktc_scrape.py parse_players — both page shapes.

Purpose:      Prove parse_players reads (1) the ktc-players JSON script element
              (KTC markup since ~2026-09-08) and (2) the older inline
              `var playersArray = [...]` literal, prefers (1) when both exist,
              and fails loud with a message naming both shapes when neither is
              present. Fixtures are minimal synthetic pages, not the 2.6 MB
              captured artifact (that proof is run locally, not committed).
Inputs:       None.
Outputs:      unittest results (exit 0 = all pass).
Dependencies: Python stdlib only. ktc_scrape imports cloudscraper at module
              top; when it is not installed (local dev has no scripts/venv) a
              stub module is injected so the pure parsing code can be tested.
              CI installs the pinned cloudscraper, so the stub is inert there.

Run:  python3 -m unittest scripts/test_ktc_scrape.py -v
"""

from __future__ import annotations

import json
import sys
import types
import unittest
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parent
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))
if "cloudscraper" not in sys.modules:
    try:
        import cloudscraper  # noqa: F401
    except ModuleNotFoundError:
        sys.modules["cloudscraper"] = types.ModuleType("cloudscraper")

import ktc_scrape  # noqa: E402

_PLAYERS = [
    {"playerName": "Alpha One", "playerID": 1, "position": "WR", "team": "CIN", "age": 26.4,
     "superflexValues": {"value": 9999, "rank": 1, "positionalRank": 1, "overall7DayTrend": 3}},
    {"playerName": "Beta Two", "playerID": 2, "position": "RB", "team": None, "age": 24.1,
     "superflexValues": {"value": 9000, "rank": 2, "positionalRank": 1, "overall7DayTrend": -2}},
    # A rookie-draft-pick entry in the post-2026-09-08 shape: no rank/positionalRank.
    {"playerName": "2027 Early 1st", "playerID": 3, "position": "RDP", "team": None, "age": None,
     "superflexValues": {"value": 6500, "pickRank": 40, "overall7DayTrend": 0}},
]
_JSON = json.dumps(_PLAYERS)


# The opening tag below is copied BYTE-FOR-BYTE from the captured live page
# (legion run 34345698308 evidence artifact scrape_evidence/ktc_raw.html, 2,613,609 B,
# sha256 95bec962cd65b209ccbf43c97cfb22c80a728efc0a66f84aea8047c67b8d5582, fetched
# 2026-09-09); only the payload is synthetic. Re-copy it if KTC's markup moves again.
_REAL_OPENING_TAG = '<script type="application/json" id="ktc-players">'


def _page_json_element(payload: str = _JSON) -> str:
    return (
        "<html><head><title>Dynasty Rankings - KeepTradeCut</title></head><body>\n"
        f"{_REAL_OPENING_TAG}{payload}</script>\n"
        "<script>var playersArray = JSON.parse("
        "document.getElementById('ktc-players').textContent);</script>\n"
        "</body></html>"
    )


def _page_inline_literal(payload: str = _JSON) -> str:
    return (
        "<html><body>\n<script>\nvar somethingElse = 1;\n"
        f"var playersArray = {payload};\nvar after = 2;\n</script>\n</body></html>"
    )


class ParsePlayersTests(unittest.TestCase):
    def test_json_script_element(self) -> None:
        raw = ktc_scrape.parse_players(_page_json_element())
        self.assertEqual([p["playerName"] for p in raw], ["Alpha One", "Beta Two", "2027 Early 1st"])

    def test_inline_literal_fallback(self) -> None:
        raw = ktc_scrape.parse_players(_page_inline_literal())
        self.assertEqual([p["playerName"] for p in raw], ["Alpha One", "Beta Two", "2027 Early 1st"])

    def test_json_element_preferred_when_both_present(self) -> None:
        element_only = json.dumps([{"playerName": "From Element", "superflexValues": {"value": 1}}])
        literal_only = json.dumps([{"playerName": "From Literal", "superflexValues": {"value": 1}}])
        html = _page_json_element(element_only) + _page_inline_literal(literal_only)
        raw = ktc_scrape.parse_players(html)
        self.assertEqual([p["playerName"] for p in raw], ["From Element"])

    def test_duplicate_id_elements_first_wins(self) -> None:
        first  = json.dumps([{"playerName": "First Element", "superflexValues": {"value": 1}}])
        second = json.dumps([{"playerName": "Second Element", "superflexValues": {"value": 1}}])
        html = _page_json_element(first) + _page_json_element(second)
        raw = ktc_scrape.parse_players(html)
        self.assertEqual([p["playerName"] for p in raw], ["First Element"])

    def test_data_id_attribute_does_not_false_match(self) -> None:
        html = (
            '<html><body><div data-id="ktc-players"></div>'
            '<script data-id="ktc-players">not json</script>'
            f"<script>var playersArray = {_JSON};</script></body></html>"
        )
        raw = ktc_scrape.parse_players(html)
        self.assertEqual(len(raw), 3)

    def test_neither_shape_fails_loud_naming_both(self) -> None:
        html = "<html><body><script>var playersArray = JSON.parse(missing);</script></body></html>"
        with self.assertRaises(ValueError) as ctx:
            ktc_scrape.parse_players(html)
        msg = str(ctx.exception)
        self.assertIn("ktc-players", msg)
        self.assertIn("playersArray", msg)

    def test_normalize_unchanged_and_pick_rank_fields_are_honest_absence(self) -> None:
        players = ktc_scrape.normalize(ktc_scrape.parse_players(_page_json_element()))
        self.assertEqual(players["Alpha One"]["sf_value"], 9999)
        self.assertEqual(players["Alpha One"]["sf_rank"], 1)
        self.assertEqual(players["Beta Two"]["team"], "FA")
        self.assertEqual(players["Beta Two"]["sf_trend_7d"], -2)
        pick = players["2027 Early 1st"]
        self.assertEqual(pick["sf_value"], 6500)
        self.assertIsNone(pick["sf_rank"])
        self.assertIsNone(pick["sf_pos_rank"])


if __name__ == "__main__":
    unittest.main()

# CHANGELOG
# 2026-09-10  Created with the JSON-script-element parse fix (KTC markup change
#             ~2026-09-08). Covers both page shapes, preference order, the
#             loud-failure message, and normalize() on a rank-less pick entry.
#             Same day, advisor conditions: real opening tag + artifact sha256 (C5),
#             duplicate-id first-wins + data-id no-false-match tests (C6/C3).
