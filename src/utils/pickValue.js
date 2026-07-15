/**
 * pickValue.js
 * Purpose:  Maps Sleeper draft-pick objects (season + round) to KTC's pick
 *           naming and market value. KTC publishes pick values as position
 *           "RDP" entries named "{season} {Early|Mid|Late} {1st..4th}"
 *           (36 entries: 2026–2028 × 3 tiers × rounds 1–4, already collected
 *           by scripts/ktc_scrape.py — no scraper change needed).
 * Inputs:   season (string|number), round (1–4), ktcLive (parsed ktc_live.json)
 * Outputs:  pickToKtcName() → KTC key string; pickKtcValue() → sf_value or
 *           null when unresolvable. null, never 0 — unknown ≠ zero; callers
 *           decide how to surface it and the validator flags it.
 * Dependencies: none (pure functions).
 *
 * Tier convention: Sleeper future picks carry no draft-slot information until
 * the draft order exists, so the MID tier is used as the unbiased estimate.
 */

const ROUND_ORDINALS = { 1: "1st", 2: "2nd", 3: "3rd", 4: "4th" };

export function pickToKtcName(season, round) {
  const ord = ROUND_ORDINALS[round];
  if (!ord) return null;
  return `${season} Mid ${ord}`;
}

export function pickKtcValue(season, round, ktcLive) {
  const name = pickToKtcName(season, round);
  if (!name) return null;
  return ktcLive?.players?.[name]?.sf_value ?? null;
}
