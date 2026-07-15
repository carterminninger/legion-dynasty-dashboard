import { useState, useEffect, useCallback, useMemo } from "react";
import { Routes, Route, useParams, Link } from "react-router-dom";
import { useRoster } from "./hooks/useRoster";
import { PICKS }  from "./data/picks";
import { TRADES as FALLBACK_TRADES } from "./data/trades";
import PlayerModal    from "./components/PlayerModal";
import NeedsAnalysis  from "./components/NeedsAnalysis";
import ValueTrend     from "./components/ValueTrend";
import TradeCalc      from "./components/TradeCalc";
import LeagueLanding  from "./components/LeagueLanding";
import { pickKtcValue } from "./utils/pickValue";
import { cosmicApp as T, LABEL, NUM, MONO, GEORGIA } from "./kit/theme";
import { posColors, slotColors } from "./kit/tokens";
import { NavShell }   from "./kit/NavShell";
import { KpiCard }    from "./kit/KpiCard";
import { DataTable }  from "./kit/DataTable";
import { Skeleton }   from "./kit/Skeleton";
import { ToastStack } from "./kit/Toast";

const LEAGUE_NAME      = "Worm Up Dynasty 🪱🪱🪱";
const LEAGUE_SEASON    = "2026";
const DEFAULT_OWNER_ID = "1002171390751113216";
const LEAGUE_ID        = "1321707192847450112";
const FC_URL      = "https://api.fantasycalc.com/values/current?isDynasty=true&numQbs=2&ppr=1";
const KTC_URL     = "/ktc_live.json";
const COMBINE_URL = "/combine_data.json";
const DD_URL      = "/dynasty_domain_rankings.json";
const REFRESH_INTERVAL = 30 * 60 * 1000;

// KTC name normalization — strips generational suffixes and apostrophes so
// "Tre' Harris" matches "Tre Harris" and "Kenneth Walker III" matches "Kenneth Walker".
const _SUFFIX_RE = /\s+(jr\.?|sr\.?|i{2,3}|iv)$/i;
function normName(n) {
  return n.replace(_SUFFIX_RE, "").replace(/'/g, "").toLowerCase().trim();
}
const _ktcNormIdx = new WeakMap();
function getKtcIdx(ktcLive) {
  if (!ktcLive?.players) return {};
  if (_ktcNormIdx.has(ktcLive)) return _ktcNormIdx.get(ktcLive);
  const idx = {};
  for (const [k, v] of Object.entries(ktcLive.players)) { idx[normName(k)] = v; }
  _ktcNormIdx.set(ktcLive, idx);
  return idx;
}
function ktcEntry(name, ktcLive) {
  return ktcLive?.players?.[name] ?? getKtcIdx(ktcLive)[normName(name)] ?? null;
}
function ktcVal(player, ktcLive) {
  return ktcEntry(player.name, ktcLive)?.sf_value ?? player.ktc ?? 0;
}
function ktcRankStr(player, ktcLive) {
  const live = ktcEntry(player.name, ktcLive);
  if (live?.sf_pos_rank && live?.sf_rank) return `${player.pos}${live.sf_pos_rank} · #${live.sf_rank} overall`;
  return player.ktcRank;
}

// Build a roster array from a raw Sleeper roster object + playersDb
function slotFor(id, sleeperRoster) {
  if (sleeperRoster.reserve?.includes(id))  return "IR";
  if (sleeperRoster.taxi?.includes(id))     return "TAXI";
  if (sleeperRoster.starters?.includes(id)) return "STARTER";
  return "BENCH";
}
function buildTeamRoster(sleeperRoster, playersDb) {
  const allIds = (sleeperRoster.players || []).filter(id => id !== "0");
  return allIds
    .map(id => {
      const p = playersDb[id];
      if (!p) return null;
      return {
        id,
        name:    `${p.first_name} ${p.last_name}`,
        pos:     p.fantasy_positions?.[0] || p.position || "?",
        team:    p.team || "FA",
        age:     p.age ?? 0,
        slot:    slotFor(id, sleeperRoster),
        ktc:     null,
        ktcRank: null,
      };
    })
    .filter(Boolean);
}

// Map roster_id → team display name
function buildRosterNameMap(allRosters, leagueUsers) {
  return Object.fromEntries(
    allRosters.map(r => {
      const user = leagueUsers.find(u => u.user_id === r.owner_id);
      const name = user?.metadata?.team_name || user?.display_name || `Team ${r.roster_id}`;
      return [r.roster_id, name];
    })
  );
}

const SLOT_ORDER  = ["STARTER","BENCH","TAXI","IR"];
const POS_ORDER   = ["QB","RB","WR","TE","K"];
const ALL_NAV_TABS = [
  { key:"briefing",  label:"Briefing", icon:"📡" },
  { key:"roster",    label:"Roster",   icon:"👥" },
  { key:"picks",     label:"Picks",    icon:"🎯" },
  { key:"trades",    label:"Trades",   icon:"🔁" },
  { key:"tradecalc", label:"Calc",     icon:"⚖️" },
];
const navTabsFor = (isOwner) =>
  isOwner ? ALL_NAV_TABS : ALL_NAV_TABS.filter(t => t.key !== "picks");

const ROSTER_FILTER_TABS = [
  { key:"ALL",     label:"All"      },
  { key:"STARTER", label:"Starters" },
  { key:"BENCH",   label:"Bench"    },
  { key:"TAXI",    label:"Taxi"     },
  { key:"IR",      label:"IR"       },
  { key:"QB",      label:"QB"       },
  { key:"RB",      label:"RB"       },
  { key:"WR",      label:"WR"       },
  { key:"TE",      label:"TE"       },
];

// ── Primitives ────────────────────────────────────────────────────────────────

// Age is a data encoding: young asset = accent, aging = warm, else muted.
function AgeBadge({ age }) {
  const color = age <= 23 ? T.accent : age >= 27 ? T.warm : T.muted;
  return <span style={{ ...NUM, color, fontSize:12, fontWeight:700 }}>{age}</span>;
}

function PosBadge({ pos }) {
  const c = posColors[pos] || "#64748b";
  return (
    <span style={{
      background:c+"20", color:c, border:`1px solid ${c}50`,
      borderRadius:4, padding:"2px 6px", fontSize:11,
      fontFamily:MONO, fontWeight:700, letterSpacing:"0.06em",
    }}>{pos}</span>
  );
}

function SlotBadge({ slot }) {
  if (slot === "STARTER") return null;
  const c = slotColors[slot] || "#64748b";
  return (
    <span style={{
      background:c+"15", color:c, border:`1px solid ${c}40`,
      borderRadius:4, padding:"1px 5px", fontSize:9,
      fontFamily:MONO, fontWeight:700, letterSpacing:"0.08em",
    }}>{slot}</span>
  );
}

function PanelLabel({ children, right }) {
  return (
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
      <div style={{ ...LABEL, color:T.muted, fontSize:"10px" }}>{children}</div>
      {right}
    </div>
  );
}

function Panel({ children, style }) {
  return (
    <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:12, padding:"14px 16px", marginBottom:12, ...style }}>
      {children}
    </div>
  );
}

// ── Signature element: featured asset + 30-day KTC sparkline ────────────────
// The ONE restrained moment of this build (docs/design-revamp-plan.md).
// Draws the localStorage KTC snapshots the app has saved daily since launch.

function readKtcHistory(playerName) {
  const keys = Object.keys(localStorage).filter(k => k.startsWith("ktc_snapshot_")).sort();
  return keys
    .map(key => {
      try {
        const snap = JSON.parse(localStorage.getItem(key) || "{}");
        const val  = snap.players?.[playerName];
        return val != null ? { date: snap.date || key.replace("ktc_snapshot_", ""), value: val } : null;
      } catch { return null; }
    })
    .filter(Boolean);
}

function FeaturedAssetCard({ roster, ktcLive, onPlayerClick }) {
  const top = useMemo(
    () => [...roster].sort((a, b) => ktcVal(b, ktcLive) - ktcVal(a, ktcLive))[0] ?? null,
    [roster, ktcLive]
  );
  const history = useMemo(() => (top ? readKtcHistory(top.name) : []), [top]);
  if (!top) return null;

  const value = ktcVal(top, ktcLive);
  const W = 320, H = 56, PAD = 5;
  let spark = null;
  if (history.length >= 2) {
    const values = history.map(d => d.value);
    const min = Math.min(...values), max = Math.max(...values);
    const range = max - min || 1;
    const pts = history.map((d, i) => ({
      x: PAD + (i / (history.length - 1)) * (W - PAD * 2),
      y: H - PAD - ((d.value - min) / range) * (H - PAD * 2),
    }));
    const line = pts.map(p => `${p.x},${p.y}`).join(" ");
    const last = pts[pts.length - 1];
    spark = (
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${top.name} KTC value over the last ${history.length} days`}
        style={{ width:"100%", height:H, display:"block", overflow:"visible", marginTop:10 }} preserveAspectRatio="none">
        <defs>
          <linearGradient id="featGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={T.accent} stopOpacity="0.22"/>
            <stop offset="100%" stopColor={T.accent} stopOpacity="0"/>
          </linearGradient>
        </defs>
        <polygon points={`${pts[0].x},${H} ${line} ${last.x},${H}`} fill="url(#featGrad)"/>
        <polyline points={line} fill="none" stroke={T.accent} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round"/>
        <circle cx={last.x} cy={last.y} r="3" fill={T.accent}/>
      </svg>
    );
  }
  const delta = history.length >= 2 ? history[history.length - 1].value - history[0].value : 0;

  return (
    <Panel style={{ cursor:"pointer" }}>
      <div onClick={() => onPlayerClick && onPlayerClick(top)}>
        <PanelLabel right={
          history.length >= 2
            ? <span style={{ ...NUM, fontSize:11, color: delta >= 0 ? T.success : T.danger }}>{delta >= 0 ? "▲" : "▼"} {Math.abs(delta).toLocaleString()} · {history.length}d</span>
            : <span style={{ ...NUM, fontSize:10, color:T.muted, opacity:0.7 }}>day {Math.max(history.length,1)} of 30</span>
        }>Top asset — 30-day KTC</PanelLabel>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <PosBadge pos={top.pos}/>
          <span style={{ fontFamily:GEORGIA, fontStyle:"italic", fontWeight:700, fontSize:18, color:T.text }}>{top.name}</span>
          <span style={{ ...NUM, fontSize:18, fontWeight:800, color:T.text, marginLeft:"auto" }}>{value.toLocaleString()}</span>
        </div>
        <div style={{ ...NUM, fontSize:10, color:T.muted, opacity:0.7, marginTop:2 }}>{ktcRankStr(top, ktcLive) || top.team}</div>
        {spark ?? (
          <div style={{ fontFamily:GEORGIA, fontStyle:"italic", fontSize:13, color:T.muted, marginTop:10 }}>
            Value history builds daily — the trend line appears after two days of snapshots.
          </div>
        )}
      </div>
    </Panel>
  );
}

// ── Roster tab ────────────────────────────────────────────────────────────────

function HeadshotThumb({ id, pos, size = 32 }) {
  const [error, setError] = useState(false);
  const c = posColors[pos] || "#64748b";
  if (error || !id) {
    return (
      <div style={{
        width:size, height:size, borderRadius:"50%", flexShrink:0,
        background:c+"28", border:`1.5px solid ${c}55`,
        display:"flex", alignItems:"center", justifyContent:"center",
      }}>
        <span style={{ color:c, fontSize:8, fontFamily:MONO, fontWeight:700 }}>{pos}</span>
      </div>
    );
  }
  return (
    <img
      src={`https://sleepercdn.com/content/nfl/players/thumb/${id}.jpg`}
      alt=""
      onError={() => setError(true)}
      style={{ width:size, height:size, borderRadius:"50%", objectFit:"cover", flexShrink:0, border:`1.5px solid ${c}40` }}
    />
  );
}

function RosterTab({ roster, fcData, ktcLive, onPlayerClick, allRosters, playersDb, leagueUsers, myRosterId }) {
  const [filterTab,      setFilterTab]      = useState("ALL");
  const [selectedTeamId, setSelectedTeamId] = useState("mine");
  // 5 columns overflow 390px — on narrow screens the pos badge moves into the
  // player cell and FC drops (KTC is primary; FC is one tap away in the modal)
  const [narrow, setNarrow] = useState(
    typeof window !== "undefined" ? window.matchMedia("(max-width: 640px)").matches : true
  );
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const onChange = (e) => setNarrow(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const rosterNameMap = buildRosterNameMap(allRosters, leagueUsers);
  const teamOptions   = allRosters
    .map(r => ({ rosterId: r.roster_id, name: rosterNameMap[r.roster_id] || `Team ${r.roster_id}` }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const isMyTeam = selectedTeamId === "mine" || selectedTeamId === myRosterId;
  const activeRoster = (() => {
    if (isMyTeam) return roster;
    const oppSleeperRoster = allRosters.find(r => r.roster_id === selectedTeamId);
    if (!oppSleeperRoster || Object.keys(playersDb).length === 0) return [];
    return buildTeamRoster(oppSleeperRoster, playersDb);
  })();
  const effectiveFc = isMyTeam ? fcData : null;

  const counts = Object.fromEntries(
    ROSTER_FILTER_TABS.map(t => [
      t.key,
      t.key === "ALL" ? activeRoster.length
        : ["STARTER","BENCH","TAXI","IR"].includes(t.key)
          ? activeRoster.filter(p => p.slot === t.key).length
          : activeRoster.filter(p => p.pos  === t.key).length,
    ])
  );

  let filtered = activeRoster.filter(p => {
    if (filterTab === "ALL") return true;
    if (["STARTER","BENCH","TAXI","IR"].includes(filterTab)) return p.slot === filterTab;
    return p.pos === filterTab;
  });

  // Default order: slot then position (header sorts override via DataTable)
  filtered = [...filtered].sort((a, b) => {
    const sd = SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot);
    return sd !== 0 ? sd : POS_ORDER.indexOf(a.pos) - POS_ORDER.indexOf(b.pos);
  });

  const fcValOf = (p) => effectiveFc?.find(f => f.player?.name === p.name)?.value ?? 0;

  const tabColor = (key) => {
    if (["STARTER","BENCH","TAXI","IR"].includes(key)) return slotColors[key] || T.accent;
    if (["QB","RB","WR","TE"].includes(key))            return posColors[key]  || T.accent;
    return T.accent;
  };

  const loading = Object.keys(playersDb).length === 0 && activeRoster.length === 0;

  const playerCell = (p) => (
    <div style={{ display:"flex", alignItems:"center", gap:10, minWidth:0 }}>
      <HeadshotThumb id={p.id} pos={p.pos} size={32}/>
      <div style={{ minWidth:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          <span style={{ color:T.text, fontSize:14, fontWeight:600, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{p.name}</span>
          <SlotBadge slot={p.slot}/>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:2 }}>
          {narrow && <PosBadge pos={p.pos}/>}
          <span style={{ ...NUM, color:T.muted, opacity:0.7, fontSize:11 }}>{p.team}</span>
        </div>
      </div>
    </div>
  );

  const columns = [
    ...(!narrow ? [{ key:"pos", label:"Pos", width:64, sortable:true, sortValue:p => POS_ORDER.indexOf(p.pos), render:p => <PosBadge pos={p.pos}/> }] : []),
    { key:"player", label: isMyTeam ? "Player" : (rosterNameMap[selectedTeamId] || "Opponent"), sortable:true, sortValue:p => p.name, render:playerCell },
    // Chanel cut (Phase 4): 7d trend micro-arrows removed from this column —
    // illegible at 9px/table density; the signal stays full-size in the
    // featured asset card and PlayerModal.
    { key:"ktc", label:"KTC", width:narrow ? 92 : 104, numeric:true, sortable:true, sortValue:p => ktcVal(p, ktcLive),
      render:p => <span style={{ ...NUM, fontSize:13 }}>{ktcVal(p, ktcLive).toLocaleString()}</span> },
    ...(effectiveFc && !narrow ? [{ key:"fc", label:"FC", width:96, numeric:true, sortable:true, sortValue:fcValOf,
      render:p => <span style={{ ...NUM, fontSize:13, color:T.muted }}>{fcValOf(p) ? fcValOf(p).toLocaleString() : "—"}</span> }] : []),
    { key:"age", label:"Age", width:narrow ? 72 : 80, numeric:true, sortable:true, sortValue:p => p.age, render:p => <AgeBadge age={p.age}/> },
  ];

  return (
    <div>
      {/* Team selector */}
      {allRosters.length > 0 && (
        <div style={{ paddingTop:14, marginBottom:8, display:"flex", alignItems:"center", gap:8 }}>
          <span style={{ ...LABEL, color:T.muted, opacity:0.7, fontSize:"10px", flexShrink:0 }}>Scouting</span>
          <select
            value={isMyTeam ? "mine" : selectedTeamId}
            onChange={e => setSelectedTeamId(e.target.value === "mine" ? "mine" : Number(e.target.value))}
            style={{
              background:T.surface, border:`1px solid ${T.border}`, borderRadius:8,
              color:T.text, fontSize:12, fontFamily:MONO,
              padding:"0 10px", height:40, cursor:"pointer", flex:1,
            }}
          >
            <option value="mine">MY ROSTER</option>
            {teamOptions
              .filter(t => t.rosterId !== myRosterId)
              .map(t => (
                <option key={t.rosterId} value={t.rosterId}>{t.name.toUpperCase()}</option>
              ))
            }
          </select>
          {!isMyTeam && (
            <button
              onClick={() => setSelectedTeamId("mine")}
              aria-label="Back to my roster"
              style={{
                background:"transparent", border:`1px solid ${T.border}`, borderRadius:8,
                color:T.muted, fontSize:12, fontFamily:MONO,
                minWidth:44, height:40, cursor:"pointer", flexShrink:0,
              }}
            >✕</button>
          )}
        </div>
      )}

      <div style={{ display:"flex", gap:6, paddingTop:4, overflowX:"auto", paddingBottom:8 }}>
        {ROSTER_FILTER_TABS.map(tab => {
          const active = filterTab === tab.key;
          const c = tabColor(tab.key);
          return (
            <button key={tab.key} onClick={() => setFilterTab(tab.key)} style={{
              background: active ? c+"18" : T.surface,
              border:`1px solid ${active ? c+"66" : T.border}`,
              color: active ? c : T.muted,
              borderRadius:8, padding:"0 12px", minHeight:44, fontSize:11,
              fontFamily:MONO, fontWeight:700,
              letterSpacing:"0.06em", cursor:"pointer", whiteSpace:"nowrap",
            }}>
              {tab.label} <span style={{ opacity:0.6 }}>({counts[tab.key]})</span>
            </button>
          );
        })}
      </div>

      <DataTable
        columns={columns}
        rows={filtered}
        loading={loading}
        emptyTitle="No players match this filter"
        emptyBody="Pick another filter, or clear it with All."
        onRowClick={onPlayerClick}
        theme={T}
      />
    </div>
  );
}

// ── Player news helpers ───────────────────────────────────────────────────────

function timeAgo(ts) {
  if (!ts) return "—";
  const ms   = ts > 1e12 ? ts : ts * 1000;
  const diff = Date.now() - ms;
  const m    = Math.floor(diff / 60_000);
  const h    = Math.floor(diff / 3_600_000);
  const d    = Math.floor(diff / 86_400_000);
  if (m < 1)  return "just now";
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  if (d < 7)  return `${d}d ago`;
  return new Date(ms).toLocaleDateString("en-US", { month:"short", day:"numeric" });
}

function PlayerNewsSection({ news }) {
  if (news === null) {
    return (
      <Panel>
        <PanelLabel>Player news</PanelLabel>
        <Skeleton height="14px" width="85%" style={{ marginBottom:8 }}/>
        <Skeleton height="14px" width="60%"/>
      </Panel>
    );
  }
  if (!news.length) return null;

  const counts = {};
  const items = news
    .flatMap(({ player, items: playerItems }) =>
      playerItems.map(item => ({ ...item, player }))
    )
    .sort((a, b) => {
      const ta = a.published || a.date || 0;
      const tb = b.published || b.date || 0;
      const msa = ta > 1e12 ? ta : ta * 1000;
      const msb = tb > 1e12 ? tb : tb * 1000;
      return msb - msa;
    })
    .filter(item => {
      const key = item.player.id;
      counts[key] = (counts[key] || 0) + 1;
      return counts[key] <= 3;
    });

  if (!items.length) return null;

  return (
    <Panel>
      <PanelLabel>Player news</PanelLabel>
      {items.map((item, i) => (
        <div
          key={`${item.player.id}-${i}`}
          style={{
            borderBottom: i < items.length - 1 ? `1px solid ${T.border}` : "none",
            paddingBottom: i < items.length - 1 ? 12 : 0,
            marginBottom:  i < items.length - 1 ? 12 : 0,
          }}
        >
          <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:4 }}>
            <PosBadge pos={item.player.pos} />
            <span style={{ color:T.text, fontSize:12, fontWeight:600 }}>
              {item.player.name}
            </span>
            <span style={{ ...NUM, marginLeft:"auto", color:T.muted, opacity:0.7, fontSize:10, flexShrink:0 }}>
              {timeAgo(item.published || item.date || 0)}
            </span>
          </div>
          <div style={{ color:T.text, fontSize:13, lineHeight:1.5, marginBottom:4 }}>
            {item.title || item.headline || "—"}
          </div>
          {(item.source || item.source_type) && (
            <div style={{ ...LABEL, color:T.muted, opacity:0.6, fontSize:9 }}>
              {(item.source || item.source_type)}
            </div>
          )}
        </div>
      ))}
    </Panel>
  );
}

// ── League standings ──────────────────────────────────────────────────────────

const RANK_COLORS = { 0:"#f59e0b", 1:"#94a3b8", 2:"#cd7c3b" }; // medal encodings

function LeagueStandings({ allRosters, leagueUsers, playersDb, ktcLive, myRosterId }) {
  const ready = allRosters.length > 0 && Object.keys(playersDb).length > 0;

  const rosterNameMap = buildRosterNameMap(allRosters, leagueUsers);

  const standings = ready ? allRosters
    .map(r => {
      const players = (r.players || []).filter(id => id !== "0");
      const totalKtc = players.reduce((sum, id) => {
        const p = playersDb[id];
        if (!p) return sum;
        const name = `${p.first_name} ${p.last_name}`;
        return sum + (ktcEntry(name, ktcLive)?.sf_value ?? 0);
      }, 0);
      const wins   = r.settings?.wins   ?? 0;
      const losses = r.settings?.losses ?? 0;
      const ties   = r.settings?.ties   ?? 0;
      return {
        rosterId: r.roster_id,
        teamName: rosterNameMap[r.roster_id] || `Team ${r.roster_id}`,
        totalKtc,
        wins,
        losses,
        ties,
      };
    })
    .sort((a, b) => b.totalKtc - a.totalKtc)
    : [];

  return (
    <Panel>
      <PanelLabel>League standings — by roster KTC</PanelLabel>

      {!ready && (
        <>
          <Skeleton height="14px" style={{ marginBottom:8 }}/>
          <Skeleton height="14px" width="80%" style={{ marginBottom:8 }}/>
          <Skeleton height="14px" width="90%"/>
        </>
      )}

      {ready && standings.map((team, i) => {
        const isMe = team.rosterId === myRosterId;
        return (
          <div
            key={team.rosterId}
            style={{
              display:"flex", alignItems:"center", gap:8,
              padding:"6px 8px", marginBottom:3, borderRadius:6,
              background: isMe ? "rgba(0,229,255,0.08)" : "transparent",
              border: isMe ? `1px solid ${T.border}` : "1px solid transparent",
            }}
          >
            <div style={{
              ...NUM, width:24, textAlign:"center", fontSize:11,
              color: RANK_COLORS[i] ?? T.muted, opacity: RANK_COLORS[i] ? 1 : 0.6,
              fontWeight:700,
            }}>#{i+1}</div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{
                color: isMe ? T.accent : T.text,
                fontSize:12,
                fontWeight: isMe ? 700 : 400,
                whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis",
              }}>
                {team.teamName}{isMe ? " ★" : ""}
              </div>
            </div>
            <div style={{ ...NUM, color:T.text, fontSize:11, textAlign:"right", flexShrink:0 }}>
              {team.totalKtc.toLocaleString()}
            </div>
            <div style={{ ...NUM, color:T.muted, opacity:0.7, fontSize:10, minWidth:48, textAlign:"right" }}>
              {team.wins}-{team.losses}{team.ties ? `-${team.ties}` : ""}
            </div>
          </div>
        );
      })}
    </Panel>
  );
}

// ── Briefing tab ──────────────────────────────────────────────────────────────

function BriefingTab({ roster, fcData, lastUpdated, onRefresh, refreshing, ktcLive, today, allRosters, playersDb, leagueUsers, myRosterId, onPlayerClick }) {
  // memoized so the news effect can depend on it without refiring every render
  // (identity changes only with roster — exhaustive-deps ruling 2026-07-15)
  const starters   = useMemo(() => roster.filter(p => p.slot === "STARTER"), [roster]);
  const topAssets  = [...roster].sort((a,b) => ktcVal(b, ktcLive) - ktcVal(a, ktcLive)).slice(0, 8);
  const irPlayers  = roster.filter(p => p.slot === "IR");
  const totalKtc   = roster.reduce((s,p) => s + ktcVal(p, ktcLive), 0);

  const [playerNews, setPlayerNews] = useState(null);

  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          "https://site.api.espn.com/apis/site/v2/sports/football/nfl/news?limit=50"
        );
        if (!res.ok) { setPlayerNews([]); return; }
        const data = await res.json();
        const articles = data.articles || [];

        const starterByName = Object.fromEntries(starters.map(p => [p.name, p]));
        const grouped = {};

        for (const art of articles) {
          const cats = art.categories || [];
          const match = cats.find(c => c.type === "athlete" && starterByName[c.description]);
          if (!match) continue;
          const player = starterByName[match.description];
          if (!grouped[player.name]) grouped[player.name] = { player, items:[] };
          if (grouped[player.name].items.length < 3) {
            grouped[player.name].items.push({
              title:     art.headline || "—",
              source:    art.source || art.byline || "ESPN",
              published: art.published ? new Date(art.published).getTime() : 0,
            });
          }
        }

        setPlayerNews(Object.values(grouped));
      } catch {
        setPlayerNews([]);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [starters]);

  const movers = roster
    .map(p => {
      const fc = fcData?.find(f => f.player?.name === p.name)?.value;
      if (fc == null) return null;
      return { ...p, fc, delta: fc - ktcVal(p, ktcLive) };
    })
    .filter(Boolean)
    .sort((a,b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 5);

  return (
    <div style={{ paddingTop:14 }}>
      {/* Data status indicators */}
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:14, flexWrap:"wrap" }}>
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          <span style={{ width:6, height:6, borderRadius:"50%", background: fcData ? T.success : T.danger, display:"inline-block" }} />
          <span style={{ ...NUM, color:T.muted, opacity:0.8, fontSize:10 }}>
            FC {fcData ? "live" : "offline"}{lastUpdated ? ` · ${lastUpdated}` : ""}
          </span>
        </div>
        {(() => {
          const scrapedAt = ktcLive?.scraped_at;
          const isToday   = scrapedAt?.slice(0,10) === today;
          const color     = ktcLive ? (isToday ? T.success : T.warm) : T.danger;
          const label     = ktcLive ? (isToday ? "KTC live" : "KTC stale") : "KTC offline";
          const time      = scrapedAt ? new Date(scrapedAt).toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" }) : null;
          return (
            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
              <span style={{ width:6, height:6, borderRadius:"50%", background:color, display:"inline-block" }} />
              <span style={{ ...NUM, color:T.muted, opacity:0.8, fontSize:10 }}>
                {label}{isToday && time ? ` · ${time}` : ""}
              </span>
            </div>
          );
        })()}
        <button onClick={onRefresh} disabled={refreshing} style={{
          background:"transparent", border:`1px solid ${T.border}`, borderRadius:8,
          color: refreshing ? T.muted : T.accent, fontSize:11, cursor: refreshing ? "default" : "pointer",
          padding:"0 12px", minHeight:44, fontFamily:MONO, letterSpacing:"0.08em", marginLeft:"auto",
        }}>{refreshing ? "Refreshing…" : "↺ Refresh values"}</button>
      </div>

      {/* IR alert */}
      {irPlayers.length > 0 && (
        <Panel style={{ borderLeft:`3px solid ${T.danger}` }}>
          <PanelLabel>IR watch</PanelLabel>
          <div style={{ color:T.muted, fontSize:13 }}>
            {irPlayers.map((p,i) => (
              <span key={p.id}>
                <span style={{ color:T.text, fontWeight:600 }}>{p.name}</span> ({p.pos} · {p.team} · {p.age})
                {i < irPlayers.length - 1 ? " and " : ""}
              </span>
            ))} {irPlayers.length === 1 ? "is" : "are"} on reserve.
          </div>
        </Panel>
      )}

      {/* SIGNATURE: featured asset + 30-day KTC sparkline */}
      <FeaturedAssetCard roster={roster} ktcLive={ktcLive} onPlayerClick={onPlayerClick}/>

      <PlayerNewsSection news={playerNews} />

      <NeedsAnalysis roster={roster} />

      <LeagueStandings
        allRosters={allRosters}
        leagueUsers={leagueUsers}
        playersDb={playersDb}
        ktcLive={ktcLive}
        myRosterId={myRosterId}
      />

      {/* Top 8 assets */}
      <Panel>
        <PanelLabel>Top 8 assets</PanelLabel>
        {topAssets.map((p, i) => (
          <div key={p.id} style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
            <div style={{ ...NUM, color:T.muted, opacity:0.6, fontSize:11, width:16 }}>{i+1}</div>
            <PosBadge pos={p.pos} />
            <div style={{ flex:1, color:T.text, fontSize:13, fontWeight:600, display:"flex", alignItems:"center", gap:6 }}>
              {p.name}
              {p.slot !== "STARTER" && <SlotBadge slot={p.slot} />}
            </div>
            <span style={{ ...NUM, color:T.text, fontSize:12 }}>{ktcVal(p, ktcLive).toLocaleString()}</span>
          </div>
        ))}
        <div style={{ marginTop:8, paddingTop:8, borderTop:`1px solid ${T.border}`, display:"flex", justifyContent:"space-between" }}>
          <span style={{ ...LABEL, color:T.muted, opacity:0.7, fontSize:"10px" }}>Total roster KTC</span>
          <span style={{ ...NUM, color:T.text, fontSize:12, fontWeight:700 }}>{totalKtc.toLocaleString()}</span>
        </div>
      </Panel>

      <ValueTrend fcData={fcData} roster={roster} />

      {/* FC vs KTC divergence */}
      {movers.length > 0 && (
        <Panel>
          <PanelLabel>FC vs KTC divergence</PanelLabel>
          {movers.map(p => (
            <div key={p.id} style={{ display:"flex", alignItems:"center", gap:10, marginBottom:7 }}>
              <PosBadge pos={p.pos} />
              <div style={{ flex:1, color:T.text, fontSize:12 }}>{p.name}</div>
              <span style={{ ...NUM, color:T.muted, fontSize:11 }}>{ktcVal(p, ktcLive).toLocaleString()}</span>
              <span style={{ color:T.muted, opacity:0.5, fontSize:10 }}>→</span>
              <span style={{ ...NUM, color:T.muted, fontSize:11 }}>{p.fc.toLocaleString()}</span>
              <span style={{ ...NUM, color: p.delta > 0 ? T.success : T.danger, fontSize:11, minWidth:52, textAlign:"right" }}>
                {p.delta > 0 ? "+" : ""}{p.delta.toLocaleString()}
              </span>
            </div>
          ))}
        </Panel>
      )}
    </div>
  );
}

// ── Picks tab ─────────────────────────────────────────────────────────────────

const ROUND_COLORS = { 1:"#f59e0b", 2:"#3b82f6" }; // draft-capital encodings

function PicksTab() {
  const totalKtc = PICKS.reduce((s,p) => s + p.ktc, 0);
  const roundLabel = (r) => r === 1 ? "1ST" : r === 2 ? "2ND" : r === 3 ? "3RD" : "4TH";

  return (
    <div style={{ paddingTop:14 }}>
      <Panel style={{ padding:0, overflow:"hidden" }}>
        <div style={{ padding:"12px 16px", background:T.bg, borderBottom:`1px solid ${T.border}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div style={{ ...LABEL, color:T.muted, fontSize:"10px" }}>Draft capital</div>
          <div style={{ ...NUM, color:T.text, fontSize:12 }}>Total {totalKtc.toLocaleString()}</div>
        </div>
        {PICKS.map(pick => {
          const c = ROUND_COLORS[pick.round] || T.muted;
          return (
            <div key={pick.id} style={{ display:"flex", alignItems:"center", gap:12, padding:"11px 16px", minHeight:44, borderBottom:`1px solid ${T.border}` }}>
              <span style={{
                background:c+"20", color:c, border:`1px solid ${c}50`,
                borderRadius:6, padding:"3px 10px", fontSize:11,
                fontFamily:MONO, fontWeight:700, minWidth:44, textAlign:"center",
              }}>{roundLabel(pick.round)}</span>
              <div style={{ flex:1 }}>
                <div style={{ color:T.text, fontSize:13, fontWeight:600 }}>{pick.label}</div>
                {pick.note && <div style={{ ...NUM, color:T.muted, opacity:0.7, fontSize:11, marginTop:1 }}>{pick.note}</div>}
              </div>
              <div style={{ ...NUM, color:T.text, fontSize:13 }}>{pick.ktc.toLocaleString()}</div>
            </div>
          );
        })}
      </Panel>
      <Panel>
        <PanelLabel>Capital outlook</PanelLabel>
        <div style={{ fontFamily:GEORGIA, fontStyle:"italic", color:T.muted, fontSize:13, lineHeight:1.6 }}>
          Strong 2027 1st from Pitts trade. Own all picks through 2027. Contend-and-reload posture — not selling picks.
        </div>
      </Panel>
    </div>
  );
}

// ── Trades tab ────────────────────────────────────────────────────────────────

function TradesTab({ playersDb, myRosterId, allRosters, leagueUsers, ktcLive }) {
  const [trades,  setTrades]  = useState(null); // null = loading
  const [usingFallback, setUsingFallback] = useState(false);

  // memoized so the trades effect can depend on it: opponent names re-resolve
  // when rosters/users arrive instead of staying stale (ruling 2026-07-15)
  const rosterNameMap = useMemo(() => buildRosterNameMap(allRosters, leagueUsers), [allRosters, leagueUsers]);

  useEffect(() => {
    if (!myRosterId) return; // wait for roster data

    async function fetchTrades() {
      try {
        const res = await fetch(`/api/sleeper?path=/league/${LEAGUE_ID}/transactions/1`);
        if (!res.ok) throw new Error("fetch failed");
        const txns = await res.json();

        const liveTrades = txns
          .filter(t => t.type === "trade" && t.status === "complete" && (t.roster_ids || []).includes(myRosterId))
          .map(t => {
            const adds  = t.adds  || {};
            const drops = t.drops || {};
            const picks = t.draft_picks || [];

            // Players I received
            const playersGot = Object.entries(adds)
              .filter(([, rId]) => rId === myRosterId)
              .map(([id]) => {
                const p = playersDb[id];
                return p ? `${p.first_name} ${p.last_name}` : id;
              });

            // Players I sent
            const playersGave = Object.entries(drops)
              .filter(([, rId]) => rId === myRosterId)
              .map(([id]) => {
                const p = playersDb[id];
                return p ? `${p.first_name} ${p.last_name}` : id;
              });

            // Picks I received
            const picksGot = picks
              .filter(pk => pk.owner_id === myRosterId)
              .map(pk => `${pk.season} Round ${pk.round}`);

            // Picks I sent
            const picksGave = picks
              .filter(pk => pk.previous_owner_id === myRosterId)
              .map(pk => `${pk.season} Round ${pk.round}`);

            const got  = [...playersGot,  ...picksGot];
            const gave = [...playersGave, ...picksGave];

            // Picks carry KTC market value too (Mid-tier RDP entries) — summing
            // players only was the picks-valued-at-0 verdict bug (fixed 2026-07-14)
            const picksGotVal = picks
              .filter(pk => pk.owner_id === myRosterId)
              .reduce((s, pk) => s + (pickKtcValue(pk.season, pk.round, ktcLive) ?? 0), 0);
            const picksGaveVal = picks
              .filter(pk => pk.previous_owner_id === myRosterId)
              .reduce((s, pk) => s + (pickKtcValue(pk.season, pk.round, ktcLive) ?? 0), 0);

            const gotKtc  = playersGot.reduce((s, name) => s + (ktcEntry(name, ktcLive)?.sf_value ?? 0), 0) + picksGotVal;
            const gaveKtc = playersGave.reduce((s, name) => s + (ktcEntry(name, ktcLive)?.sf_value ?? 0), 0) + picksGaveVal;

            const oppRosterId = (t.roster_ids || []).find(id => id !== myRosterId);
            const oppName = rosterNameMap[oppRosterId] || "Opponent";

            let verdict = "FAIR";
            let verdictColor = "#f59e0b";
            if (gotKtc > gaveKtc * 1.1)  { verdict = "WIN";  verdictColor = "#10b981"; }
            if (gaveKtc > gotKtc  * 1.1) { verdict = "LOSS"; verdictColor = "#ef4444"; }

            const ts = t.status_updated || t.created || 0;
            const dateStr = ts
              ? new Date(ts > 1e12 ? ts : ts * 1000).toISOString().slice(0, 10)
              : "—";

            return {
              id:    t.transaction_id || String(ts),
              label: `vs. ${oppName}`,
              gave,
              got,
              gaveKtc,
              gotKtc,
              verdict,
              verdictColor,
              note:  "",
              date:  dateStr,
            };
          });

        if (liveTrades.length > 0) {
          setTrades(liveTrades);
          setUsingFallback(false);
        } else {
          setTrades(FALLBACK_TRADES);
          setUsingFallback(true);
        }
      } catch {
        setTrades(FALLBACK_TRADES);
        setUsingFallback(true);
      }
    }

    fetchTrades();
  }, [myRosterId, playersDb, ktcLive, rosterNameMap]);

  const displayTrades = trades ?? [];

  return (
    <div style={{ paddingTop:14 }}>
      {trades === null && (
        <Panel>
          <Skeleton height="16px" width="55%" style={{ marginBottom:10 }}/>
          <Skeleton height="13px" width="80%" style={{ marginBottom:6 }}/>
          <Skeleton height="13px" width="70%"/>
        </Panel>
      )}
      {usingFallback && trades !== null && (
        <div style={{ fontFamily:GEORGIA, fontStyle:"italic", color:T.muted, fontSize:13, marginBottom:12 }}>
          No in-season trades yet — offseason history below.
        </div>
      )}
      {displayTrades.map(trade => (
        <Panel key={trade.id}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
            <div style={{ color:T.text, fontSize:15, fontWeight:700 }}>{trade.label}</div>
            <span style={{
              background:trade.verdictColor+"18", color:trade.verdictColor,
              border:`1px solid ${trade.verdictColor}40`,
              borderRadius:4, padding:"2px 8px", fontSize:10,
              fontFamily:MONO, fontWeight:700,
            }}>{trade.verdict}</span>
          </div>
          <div style={{ display:"flex", gap:12, marginBottom:10 }}>
            <div style={{ flex:1 }}>
              <div style={{ ...LABEL, color:T.danger, fontSize:"9px", marginBottom:4 }}>Gave</div>
              {(trade.gave || []).map(n => <div key={n} style={{ color:T.muted, fontSize:12 }}>{n}</div>)}
              {trade.gave?.length === 0 && <div style={{ ...NUM, color:T.muted, opacity:0.5, fontSize:11 }}>—</div>}
              <div style={{ ...NUM, color:T.text, fontSize:11, marginTop:4 }}>{(trade.gaveKtc||0).toLocaleString()}</div>
            </div>
            <div style={{ flex:1 }}>
              <div style={{ ...LABEL, color:T.success, fontSize:"9px", marginBottom:4 }}>Got</div>
              {(trade.got || []).map(n => <div key={n} style={{ color:T.muted, fontSize:12 }}>{n}</div>)}
              {trade.got?.length === 0 && <div style={{ ...NUM, color:T.muted, opacity:0.5, fontSize:11 }}>—</div>}
              <div style={{ ...NUM, color:T.text, fontSize:11, marginTop:4 }}>{(trade.gotKtc||0).toLocaleString()}</div>
            </div>
          </div>
          {trade.note && <div style={{ color:T.muted, fontSize:11 }}>{trade.note}</div>}
          <div style={{ ...NUM, color:T.muted, opacity:0.6, fontSize:10, marginTop:6 }}>{trade.date}</div>
        </Panel>
      ))}
    </div>
  );
}

// ── Not found (designed 404 — SPA catch-all route) ───────────────────────────

function NotFound() {
  return (
    <div style={{ minHeight:"100vh", background:T.bg, color:T.text, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
      <div style={{ textAlign:"center", maxWidth:420 }}>
        <div style={{ ...NUM, fontSize:48, fontWeight:800, color:T.accent, marginBottom:12 }}>404</div>
        <div style={{ fontFamily:GEORGIA, fontStyle:"italic", fontSize:17, marginBottom:8 }}>This route isn't on the roster.</div>
        <div style={{ color:T.muted, fontSize:13, marginBottom:24 }}>The page you're after doesn't exist — it may have been traded away.</div>
        <Link to="/" style={{ display:"inline-flex", alignItems:"center", justifyContent:"center", minHeight:44, padding:"0 24px", background:T.warm, color:T.bg, borderRadius:8, textDecoration:"none", fontFamily:MONO, fontWeight:700, letterSpacing:"0.08em", fontSize:12 }}>
          ← Back to the league
        </Link>
      </div>
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

function Dashboard() {
  const { ownerId }                          = useParams();
  const resolvedOwner                        = ownerId ?? DEFAULT_OWNER_ID;
  const isOwner                              = resolvedOwner === DEFAULT_OWNER_ID;
  const navTabs                              = navTabsFor(isOwner);
  const [navTab,          setNavTab]         = useState("briefing");
  const [fcData,          setFcData]         = useState(null);
  const [lastUpdated,     setLastUpdated]    = useState(null);
  const [refreshing,      setRefreshing]     = useState(false);
  const [selectedPlayer,  setSelectedPlayer] = useState(null);
  const [ktcLive,         setKtcLive]        = useState(null);
  const [combineData,     setCombineData]    = useState(null);
  const [dynastyDomain,   setDynastyDomain]  = useState(null);
  const [toasts,          setToasts]         = useState([]);
  const { roster, rosterLoading, record, allRosters, playersDb, leagueUsers, myRosterId } = useRoster(resolvedOwner);

  const today = new Date().toISOString().slice(0, 10);

  const pushToast = useCallback((kind, text) => {
    setToasts(prev => [...prev, { id: `${Date.now()}-${Math.random()}`, kind, text }]);
  }, []);
  const dismissToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const teamUser = leagueUsers.find(u => u.user_id === resolvedOwner);
  const teamName = teamUser?.metadata?.team_name || teamUser?.display_name || (isOwner ? "LEGION OF CMINN" : "UNKNOWN TEAM");

  const saveSnapshot = useCallback((data) => {
    const snapshot = {
      date: today,
      players: Object.fromEntries(
        data.map(p => [p.player?.name, { value: p.value, rank: p.overallRank }])
      ),
    };
    localStorage.setItem(`fc_snapshot_${today}`, JSON.stringify(snapshot));
    const keys = Object.keys(localStorage).filter(k => k.startsWith("fc_snapshot_")).sort();
    if (keys.length > 7) keys.slice(0, keys.length - 7).forEach(k => localStorage.removeItem(k));
  }, [today]);

  const fetchFc = useCallback(async (announce = false) => {
    setRefreshing(true);
    try {
      const res  = await fetch(FC_URL);
      const data = await res.json();
      setFcData(data);
      saveSnapshot(data);
      const time = new Date().toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" });
      setLastUpdated(time);
      localStorage.setItem("fc_last_known", JSON.stringify(data));
      if (announce) pushToast("success", `Values refreshed at ${time}.`);
    } catch {
      const cached = localStorage.getItem("fc_last_known");
      if (cached && !fcData) {
        setFcData(JSON.parse(cached));
        setLastUpdated("STALE");
      }
      if (announce) pushToast("error", "Value refresh failed — showing the last saved values. Check your connection and try again.");
    } finally {
      setRefreshing(false);
    }
    // fcData is read at call time only as an error-path don't-clobber guard;
    // adding it as a dep would recreate fetchFc after every successful fetch
    // and the [fetchFc] polling effect below would refetch in a tight loop.
    // Suppressed per exhaustive-deps ruling 2026-07-15 (W3).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveSnapshot, pushToast]);

  useEffect(() => {
    // deferred a tick: fetchFc's first line is setRefreshing(true), which must
    // not run inside the effect's sync body (react-hooks/set-state-in-effect)
    const initial = setTimeout(fetchFc, 0);
    const interval = setInterval(fetchFc, REFRESH_INTERVAL);
    return () => { clearTimeout(initial); clearInterval(interval); };
  }, [fetchFc]);

  useEffect(() => {
    fetch(KTC_URL)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setKtcLive(data); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch(COMBINE_URL)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setCombineData(data); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch(DD_URL)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setDynastyDomain(data); })
      .catch(() => {});
  }, []);

  // Save a daily KTC snapshot to localStorage for sparkline history
  useEffect(() => {
    if (!ktcLive?.players) return;
    const key = `ktc_snapshot_${today}`;
    if (localStorage.getItem(key)) return;
    const snapshot = { date: today, players: {} };
    for (const [name, data] of Object.entries(ktcLive.players)) {
      snapshot.players[name] = data.sf_value;
    }
    localStorage.setItem(key, JSON.stringify(snapshot));
    const keys = Object.keys(localStorage).filter(k => k.startsWith("ktc_snapshot_")).sort();
    if (keys.length > 30) keys.slice(0, keys.length - 30).forEach(k => localStorage.removeItem(k));
  }, [ktcLive, today]);

  const starterCount  = roster.filter(p => p.slot === "STARTER").length;
  const avgAge        = roster.length ? (roster.reduce((s,p) => s + p.age, 0) / roster.length).toFixed(1) : "—";
  const starterAvgAge = starterCount  ? (roster.filter(p => p.slot === "STARTER").reduce((s,p) => s + p.age, 0) / starterCount).toFixed(1) : "—";
  const totalKtc      = roster.reduce((s,p) => s + ktcVal(p, ktcLive), 0);

  return (
    <NavShell
      brand={LEAGUE_NAME}
      brandSub={`Season ${LEAGUE_SEASON}`}
      items={navTabs}
      activeKey={navTab}
      onSelect={setNavTab}
      theme={T}
    >
      {/* HEADER BAND — compact, ≤200px */}
      <div style={{
        background:`linear-gradient(135deg, rgba(0,229,255,0.06) 0%, rgba(123,47,255,0.08) 60%, transparent 100%)`,
        border:`1px solid ${T.border}`, borderRadius:12, padding:"16px 16px 14px", marginBottom:16,
      }}>
        <Link to="/" style={{ ...LABEL, display:"inline-flex", alignItems:"center", minHeight:24, color:T.muted, fontSize:"10px", marginBottom:6, textDecoration:"none" }}>
          ← All teams
        </Link>
        <h1 style={{ fontFamily:GEORGIA, fontStyle:"italic", fontWeight:900, fontSize:"clamp(24px,6vw,32px)", letterSpacing:"-0.02em", color:T.text, lineHeight:1.05 }}>{teamName}</h1>
        <div style={{ ...LABEL, color:T.muted, opacity:0.8, fontSize:"10px", marginTop:4 }}>{LEAGUE_NAME} · {LEAGUE_SEASON}</div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(140px, 1fr))", gap:8, marginTop:14 }}>
          <KpiCard label="Record"     value={record} theme={T}/>
          <KpiCard label="Roster KTC" value={rosterLoading ? "…" : totalKtc.toLocaleString()} sub={`${roster.length} players`} theme={T}/>
          <KpiCard label="Avg age"    value={avgAge} sub={`starters ${starterAvgAge}`} theme={T}/>
          {isOwner && <KpiCard label="FAAB" value="$300" sub="unspent" theme={T}/>}
        </div>
      </div>

      {/* CONTENT */}
      {navTab === "briefing"  && (
        <BriefingTab
          roster={roster} fcData={fcData} lastUpdated={lastUpdated}
          onRefresh={() => fetchFc(true)} refreshing={refreshing} ktcLive={ktcLive} today={today}
          allRosters={allRosters} playersDb={playersDb} leagueUsers={leagueUsers} myRosterId={myRosterId}
          onPlayerClick={setSelectedPlayer}
        />
      )}
      {navTab === "roster"    && (
        <RosterTab
          roster={roster} fcData={fcData} ktcLive={ktcLive} onPlayerClick={setSelectedPlayer}
          allRosters={allRosters} playersDb={playersDb} leagueUsers={leagueUsers} myRosterId={myRosterId}
        />
      )}
      {navTab === "picks"     && <PicksTab />}
      {navTab === "trades"    && (
        <TradesTab
          playersDb={playersDb} myRosterId={myRosterId}
          allRosters={allRosters} leagueUsers={leagueUsers} ktcLive={ktcLive}
        />
      )}
      {navTab === "tradecalc" && <TradeCalc  fcData={fcData} ktcLive={ktcLive} roster={roster} />}

      {selectedPlayer && (
        <PlayerModal player={selectedPlayer} fcData={fcData} ktcLive={ktcLive} combineData={combineData} dynastyDomain={dynastyDomain} onClose={() => setSelectedPlayer(null)} />
      )}

      <ToastStack items={toasts} onDismiss={dismissToast} theme={T}/>

      <div style={{ ...LABEL, padding:"20px 0 0", color:T.muted, opacity:0.4, fontSize:"9px" }}>
        {LEAGUE_NAME} · Season {LEAGUE_SEASON}{ktcLive?.scraped_at ? ` · KTC ${ktcLive.scraped_at.slice(0,10)}` : ""}
      </div>
    </NavShell>
  );
}

// ── App (router shell) ────────────────────────────────────────────────────────

export default function App() {
  return (
    <Routes>
      <Route path="/"               element={<LeagueLanding />} />
      <Route path="/team/:ownerId"  element={<Dashboard />} />
      <Route path="*"               element={<NotFound />} />
    </Routes>
  );
}
