/**
 * validatePlayerData.js
 * Purpose:  Cross-validates every player across all 12 league rosters against
 *           Sleeper, KTC, and FantasyCalc. Returns a structured report of
 *           missing entries, name mismatches, and value divergences.
 * Inputs:   None — fetches all data internally using the same endpoints the
 *           dashboard uses.
 * Outputs:  ValidationReport object (see typedef below).
 * Dependencies: Runs in-browser; uses /api/sleeper, /api/players, /ktc_live.json,
 *               and api.fantasycalc.com (all used by existing dashboard code).
 */

const LEAGUE_ID  = "1321707192847450112";
const FC_URL     = "https://api.fantasycalc.com/values/current?isDynasty=true&numQbs=2&ppr=1";
const KTC_URL    = "/ktc_live.json";
const SUFFIX_RE  = /\s+(jr\.?|sr\.?|i{2,3}|iv)$/i;

/**
 * @typedef {{ type: string, playerName: string, sleeperId: string, detail: string }} Issue
 * @typedef {{ checked: number, errors: Issue[], warnings: Issue[], clean: number, timestamp: string }} ValidationReport
 */

/** Normalise a player name for fuzzy matching. */
function normName(n) {
  return n.replace(SUFFIX_RE, "").replace(/'/g, "").toLowerCase().trim();
}

/** Levenshtein-based similarity ratio in [0, 1]. */
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

/** Load persisted name aliases from localStorage (written by fixPlayerData). */
function loadAliases() {
  try { return JSON.parse(localStorage.getItem("player_aliases") ?? "{}"); }
  catch { return {}; }
}

/** Build KTC lookup: normalisedName → { entry, originalKey }. */
function buildKtcIndex(ktcPlayers) {
  const idx = {};
  for (const [key, entry] of Object.entries(ktcPlayers))
    idx[normName(key)] = { entry, originalKey: key };
  return idx;
}

/** Build FC lookup maps: by Sleeper ID and by normalised name (fallback). */
function buildFcMaps(fcData) {
  const byId = {}, byName = {};
  for (const item of fcData) {
    if (item.player?.sleeperId) byId[item.player.sleeperId]      = item;
    if (item.player?.name)      byName[normName(item.player.name)] = item;
  }
  return { byId, byName };
}

/** Fetch all four data sources in parallel. */
async function fetchAllData() {
  const [rostersRes, playersRes, ktcRes, fcRes] = await Promise.all([
    fetch(`/api/sleeper?path=/league/${LEAGUE_ID}/rosters`),
    fetch("/api/players"),
    fetch(KTC_URL),
    fetch(FC_URL),
  ]);
  if (!rostersRes.ok || !playersRes.ok || !ktcRes.ok || !fcRes.ok)
    throw new Error("One or more data sources failed to load");
  const [rosters, playersDb, ktcLive, fcData] = await Promise.all([
    rostersRes.json(), playersRes.json(), ktcRes.json(), fcRes.json(),
  ]);
  return { rosters, playersDb, ktcLive, fcData };
}

/**
 * Check a single player against KTC and FC.
 * @param {string} id - Sleeper player ID
 * @param {string} name - Sleeper player name
 * @param {Object} ktcPlayers - ktcLive.players object
 * @param {Object} ktcIdx - pre-built normalised KTC index
 * @param {{ byId: Object, byName: Object }} fcMaps
 * @param {Object} aliases - name alias map from fixPlayerData (sleeperName → ktcKey)
 * @returns {{ errors: Issue[], warnings: Issue[] }}
 */
function checkPlayer(id, name, ktcPlayers, ktcIdx, fcMaps, aliases = {}) {
  const errors = [], warnings = [];
  const mk = (type, detail) => ({ type, playerName: name, sleeperId: id, detail });

  const ktcLookupName = aliases[name] ?? name;
  const ktcExact = ktcPlayers[ktcLookupName];
  const ktcNorm  = !ktcExact ? ktcIdx[normName(ktcLookupName)] : null;
  const ktcEntry = ktcExact ?? ktcNorm?.entry ?? null;
  if (!ktcEntry) {
    errors.push(mk("MISSING_KTC", "No KTC entry found (exact or normalised)"));
  } else if (ktcNorm && !ktcExact) {
    if (similarity(name, ktcNorm.originalKey) < 0.8)
      errors.push(mk("NAME_MISMATCH", `Sleeper: "${name}" → KTC: "${ktcNorm.originalKey}"`));
  }

  const fcEntry = fcMaps.byId[id] ?? fcMaps.byName[normName(name)] ?? null;
  if (!fcEntry) {
    errors.push(mk("MISSING_FC", "No FantasyCalc entry found (by Sleeper ID or name)"));
  } else {
    if (similarity(name, fcEntry.player.name) < 0.8)
      errors.push(mk("NAME_MISMATCH", `Sleeper: "${name}" → FC: "${fcEntry.player.name}"`));
    if (ktcEntry && fcEntry.value && ktcEntry.sf_value) {
      const pct = Math.abs(ktcEntry.sf_value - fcEntry.value) / Math.max(ktcEntry.sf_value, fcEntry.value);
      if (pct > 0.3)
        warnings.push(mk("VALUE_DIVERGENCE", `KTC: ${ktcEntry.sf_value} / FC: ${fcEntry.value} (${Math.round(pct * 100)}% diff)`));
    }
  }

  return { errors, warnings };
}

/**
 * Run validation across all 12 rosters.
 * @returns {Promise<ValidationReport>}
 */
export async function validatePlayerData() {
  const { rosters, playersDb, ktcLive, fcData } = await fetchAllData();
  const ktcPlayers = ktcLive.players ?? {};
  const ktcIdx     = buildKtcIndex(ktcPlayers);
  const fcMaps     = buildFcMaps(Array.isArray(fcData) ? fcData : []);
  const aliases    = loadAliases();

  const seen     = new Set();
  const errors   = [];
  const warnings = [];
  let clean = 0, aliasesApplied = 0;

  for (const roster of rosters) {
    for (const id of (roster.players ?? []).filter(i => i !== "0")) {
      if (seen.has(id)) continue;
      seen.add(id);

      const p = playersDb[id];
      if (!p) continue;
      const name = `${p.first_name} ${p.last_name}`;
      if (aliases[name]) aliasesApplied++;
      const result = checkPlayer(id, name, ktcPlayers, ktcIdx, fcMaps, aliases);

      errors.push(...result.errors);
      warnings.push(...result.warnings);
      if (result.errors.length === 0 && result.warnings.length === 0) clean++;
    }
  }

  return {
    checked: seen.size, errors, warnings, clean, timestamp: new Date().toISOString(),
    aliasesLoaded: Object.keys(aliases).length, aliasesApplied,
  };
}
