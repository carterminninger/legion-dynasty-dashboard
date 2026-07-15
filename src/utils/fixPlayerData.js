/**
 * fixPlayerData.js
 * Purpose:  Reads a ValidationReport from validatePlayerData() and auto-resolves
 *           NAME_MISMATCH and MISSING_KTC errors via alias mapping and fuzzy search.
 *           MISSING_FC errors have no fix path (FC doesn't track low-value backups)
 *           and always go to manual review.
 *           Aliases persist to localStorage under 'player_aliases'.
 *           Manual-review items persist under 'player_manual_review'.
 * Inputs:   ValidationReport from validatePlayerData()
 * Outputs:  FixReport { resolved, manualReview, aliases, timestamp }
 * Dependencies: fetch (browser); /ktc_live.json endpoint.
 */

const KTC_URL   = "/ktc_live.json";
const SUFFIX_RE = /\s+(jr\.?|sr\.?|i{2,3}|iv)$/i;

/**
 * @typedef {{ type: string, playerName: string, sleeperId: string, detail: string, suggestedFix?: string }} ReviewItem
 * @typedef {{ resolved: number, manualReview: ReviewItem[], aliases: Object, timestamp: string }} FixReport
 */

/** Levenshtein similarity ratio in [0, 1]. Intentionally duplicated from validator for module independence. */
function similarity(a, b) {
  const s = a.toLowerCase(), t = b.toLowerCase();
  if (s === t) return 1;
  const m = s.length, n = t.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => Array.from({ length: n + 1 }, (_, j) => i === 0 ? j : j === 0 ? i : 0));
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = s[i-1] === t[j-1] ? dp[i-1][j-1] : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
  return 1 - dp[m][n] / Math.max(m, n);
}

/** Fetch KTC players object. */
async function fetchKtcPlayers() {
  const res = await fetch(KTC_URL);
  if (!res.ok) throw new Error("KTC data unavailable");
  const data = await res.json();
  return data.players ?? {};
}

/** Extract { from, to } alias from a NAME_MISMATCH KTC detail string. Returns null for FC mismatches (no alias needed — sleeperId handles FC lookups). */
function parseAliasPair(detail) {
  const match = detail.match(/Sleeper: "([^"]+)" → KTC: "([^"]+)"/);
  return match ? { from: match[1], to: match[2] } : null;
}

/** Search KTC players by last name (suffix-stripped), return best fuzzy match above 0.85 threshold. */
function fuzzyKtcSearch(name, ktcPlayers) {
  const clean    = name.replace(SUFFIX_RE, "");
  const lastName = clean.split(" ").at(-1).toLowerCase();
  const candidates = Object.keys(ktcPlayers).filter(k =>
    k.replace(SUFFIX_RE, "").split(" ").at(-1).toLowerCase() === lastName
  );
  if (!candidates.length) return null;
  let best = null, bestScore = 0;
  for (const c of candidates) {
    const score = similarity(name, c);
    if (score > bestScore) { bestScore = score; best = c; }
  }
  return bestScore > 0.85 ? { ktcKey: best, score: bestScore } : null;
}

/** Resolve NAME_MISMATCH: extract KTC alias from detail string. FC mismatches return null — sleeperId lookup already works. */
function resolveNameMismatch(error) {
  return parseAliasPair(error.detail);
}

/** Resolve MISSING_KTC: fuzzy-search by last name; alias if found above threshold, manual-review otherwise. */
function resolveMissingKtc(error, ktcPlayers) {
  const hit = fuzzyKtcSearch(error.playerName, ktcPlayers);
  if (hit) return { alias: { from: error.playerName, to: hit.ktcKey } };
  return { manualReview: { ...error, suggestedFix: "No KTC match found — likely rookie, recently cut, or non-standard name" } };
}

/** Merge new aliases into localStorage, preserving existing entries. */
function persistAliases(newAliases) {
  try {
    const existing = JSON.parse(localStorage.getItem("player_aliases") ?? "{}");
    localStorage.setItem("player_aliases", JSON.stringify({ ...existing, ...newAliases }));
  } catch { /* localStorage unavailable */ }
}

/** Merge new manual-review items into localStorage, de-duplicating by sleeperId. */
function persistManualReview(newItems) {
  try {
    const existing = JSON.parse(localStorage.getItem("player_manual_review") ?? "[]");
    const merged = [
      ...existing.filter(e => !newItems.some(n => n.sleeperId === e.sleeperId)),
      ...newItems,
    ];
    localStorage.setItem("player_manual_review", JSON.stringify(merged));
  } catch { /* localStorage unavailable */ }
}

/**
 * Run the fixer agent against a ValidationReport.
 * Processes NAME_MISMATCH and MISSING_KTC errors automatically.
 * MISSING_FC always goes to manual review — no fix path exists in FC's dataset.
 * @param {{ errors: Array, warnings: Array }} report - Output of validatePlayerData()
 * @returns {Promise<FixReport>}
 */
export async function fixPlayerData(report) {
  const ktcPlayers  = await fetchKtcPlayers();
  const aliases     = {};
  const manualReview = [];

  for (const error of report.errors) {
    if (error.type === "NAME_MISMATCH") {
      const alias = resolveNameMismatch(error);
      if (alias) aliases[alias.from] = alias.to;
    } else if (error.type === "MISSING_KTC") {
      const result = resolveMissingKtc(error, ktcPlayers);
      if (result.alias) aliases[result.alias.from] = result.alias.to;
      else              manualReview.push(result.manualReview);
    } else if (error.type === "MISSING_FC") {
      manualReview.push({ ...error, suggestedFix: "Not in FC database — low-value backup or very recent roster addition" });
    } else if (error.type === "PICK_VALUE_UNRESOLVED") {
      // No auto-fix: pick values come from the KTC scrape — a miss means the
      // scraper or naming drifted, which a browser fixer must not paper over.
      manualReview.push({ ...error, suggestedFix: "Check scripts/ktc_scrape.py collects the picks table and pickToKtcName() still matches KTC's naming" });
    }
  }

  persistAliases(aliases);
  persistManualReview(manualReview);

  return { resolved: Object.keys(aliases).length, manualReview, aliases, timestamp: new Date().toISOString() };
}
