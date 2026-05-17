import { useState, useEffect } from "react";
import { ROSTER as FALLBACK_ROSTER } from "../data/roster";

const LEAGUE_ID = "1321707192847450112";
const OWNER_ID  = "1002171390751113216";

function slotFor(id, sleeperRoster) {
  if (sleeperRoster.reserve?.includes(id))  return "IR";
  if (sleeperRoster.taxi?.includes(id))     return "TAXI";
  if (sleeperRoster.starters?.includes(id)) return "STARTER";
  return "BENCH";
}

export function useRoster() {
  const [roster,        setRoster]        = useState(FALLBACK_ROSTER);
  const [source,        setSource]        = useState("fallback");
  const [rosterLoading, setRosterLoading] = useState(true);
  const [record,        setRecord]        = useState("—");
  const [allRosters,    setAllRosters]    = useState([]);
  const [playersDb,     setPlayersDb]     = useState({});
  const [leagueUsers,   setLeagueUsers]   = useState([]);
  const [myRosterId,    setMyRosterId]    = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [rostersRes, playersRes, usersRes] = await Promise.all([
          fetch(`/api/sleeper?path=/league/${LEAGUE_ID}/rosters`),
          fetch("/api/players"),
          fetch(`/api/sleeper?path=/league/${LEAGUE_ID}/users`),
        ]);
        if (!rostersRes.ok || !playersRes.ok || !usersRes.ok) throw new Error("fetch failed");

        const rosters = await rostersRes.json();
        const players = await playersRes.json();
        const users   = await usersRes.json();

        const mine = rosters.find(r => r.owner_id === OWNER_ID);
        if (!mine) throw new Error("roster not found");

        const wins   = mine.settings?.wins   ?? 0;
        const losses = mine.settings?.losses ?? 0;
        const ties   = mine.settings?.ties   ?? 0;

        const allIds = (mine.players || []).filter(id => id !== "0");
        const built = allIds
          .map(id => {
            const p = players[id];
            if (!p) return null;
            return {
              id,
              name:    `${p.first_name} ${p.last_name}`,
              pos:     p.fantasy_positions?.[0] || p.position || "?",
              team:    p.team || "FA",
              age:     p.age    ?? 0,
              height:  p.height ?? null,
              weight:  p.weight ?? null,
              slot:    slotFor(id, mine),
              ktc:     null,
              ktcRank: null,
            };
          })
          .filter(Boolean);

        if (!cancelled) {
          setRoster(built);
          setSource("live");
          setRecord(`${wins}-${losses}-${ties}`);
          setAllRosters(rosters);
          setPlayersDb(players);
          setLeagueUsers(Array.isArray(users) ? users : []);
          setMyRosterId(mine.roster_id);
        }
      } catch {
        if (!cancelled) setSource("fallback");
      } finally {
        if (!cancelled) setRosterLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  return { roster, source, rosterLoading, record, allRosters, playersDb, leagueUsers, myRosterId };
}
