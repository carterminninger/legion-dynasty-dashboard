import { useState, useEffect, useCallback } from "react";
import { useRoster } from "./hooks/useRoster";
import { PICKS }  from "./data/picks";
import { TRADES } from "./data/trades";
import PlayerModal   from "./components/PlayerModal";
import NeedsAnalysis from "./components/NeedsAnalysis";
import ValueTrend    from "./components/ValueTrend";
import TradeCalc     from "./components/TradeCalc";

const LEAGUE  = { name:"Worm Up Dynasty 🪱🪱🪱", season:"2026", record:"0-0-0", faab:300, waiver:7 };
const FC_URL  = "https://api.fantasycalc.com/values/current?isDynasty=true&numQbs=2&ppr=1";
const KTC_URL = "/ktc_live.json";
const REFRESH_INTERVAL = 30 * 60 * 1000;

// Return live KTC SF value for a player, falling back to roster value then 0
function ktcVal(player, ktcLive) {
  return ktcLive?.players?.[player.name]?.sf_value ?? player.ktc ?? 0;
}
function ktcRankStr(player, ktcLive) {
  const live = ktcLive?.players?.[player.name];
  if (live?.sf_pos_rank && live?.sf_rank) return `${player.pos}${live.sf_pos_rank} · #${live.sf_rank} overall`;
  return player.ktcRank;
}

const POS_COLORS  = { QB:"#f59e0b", RB:"#10b981", WR:"#3b82f6", TE:"#a855f7" };
const SLOT_COLORS = { STARTER:"#10b981", BENCH:"#475569", TAXI:"#f59e0b", IR:"#ef4444" };
const SLOT_ORDER  = ["STARTER","BENCH","TAXI","IR"];
const POS_ORDER   = ["QB","RB","WR","TE","K"];
const NAV_TABS = [
  { key:"briefing",  label:"BRIEFING"   },
  { key:"roster",    label:"ROSTER"     },
  { key:"picks",     label:"PICKS"      },
  { key:"trades",    label:"TRADES"     },
  { key:"tradecalc", label:"TRADE CALC" },
];

const ROSTER_FILTER_TABS = [
  { key:"ALL",     label:"ALL"      },
  { key:"STARTER", label:"STARTERS" },
  { key:"BENCH",   label:"BENCH"    },
  { key:"TAXI",    label:"TAXI"     },
  { key:"IR",      label:"IR"       },
  { key:"QB",      label:"QB"       },
  { key:"RB",      label:"RB"       },
  { key:"WR",      label:"WR"       },
  { key:"TE",      label:"TE"       },
];

// ── Primitives ────────────────────────────────────────────────────────────────

function AgeBadge({ age }) {
  const color = age <= 22 ? "#10b981" : age <= 24 ? "#3b82f6" : age <= 26 ? "#f59e0b" : "#ef4444";
  return <span style={{ color, fontSize:12, fontFamily:"'Space Mono',monospace", fontWeight:700 }}>{age}</span>;
}

function PosBadge({ pos }) {
  const c = POS_COLORS[pos] || "#64748b";
  return (
    <span style={{
      background:c+"20", color:c, border:`1px solid ${c}50`,
      borderRadius:4, padding:"2px 6px", fontSize:11,
      fontFamily:"'Space Mono',monospace", fontWeight:700, letterSpacing:"0.06em",
    }}>{pos}</span>
  );
}

function SlotBadge({ slot }) {
  if (slot === "STARTER") return null;
  const c = SLOT_COLORS[slot] || "#475569";
  return (
    <span style={{
      background:c+"15", color:c, border:`1px solid ${c}40`,
      borderRadius:4, padding:"1px 5px", fontSize:9,
      fontFamily:"'Space Mono',monospace", fontWeight:700, letterSpacing:"0.08em",
    }}>{slot}</span>
  );
}

function StatCard({ label, value, sub, color }) {
  return (
    <div style={{
      background:"#0c1828", border:"1px solid #1a2d40", borderRadius:10,
      padding:"12px 14px", flex:1, minWidth:75,
    }}>
      <div style={{ color:color||"#3b82f6", fontSize:9, fontFamily:"'Space Mono',monospace", letterSpacing:"0.15em", marginBottom:4 }}>{label}</div>
      <div style={{ color:"#f1f5f9", fontSize:24, fontFamily:"'Bebas Neue',cursive", lineHeight:1 }}>{value}</div>
      {sub && <div style={{ color:"#334155", fontSize:10, fontFamily:"'Space Mono',monospace", marginTop:3 }}>{sub}</div>}
    </div>
  );
}

// ── Roster tab ────────────────────────────────────────────────────────────────

function PlayerRow({ player, rank, fcData, ktcLive, onClick }) {
  const fc      = fcData?.find(p => p.player?.name === player.name);
  const fcVal   = fc?.value;
  const liveKtc = ktcVal(player, ktcLive);
  const delta   = fcVal != null ? fcVal - liveKtc : null;
  const trend   = ktcLive?.players?.[player.name]?.sf_trend_7d ?? 0;
  return (
    <div
      onClick={() => onClick(player)}
      style={{
        display:"flex", alignItems:"center", gap:10,
        padding:"10px 16px", borderBottom:"1px solid #0d1825",
        transition:"background 0.12s", cursor:"pointer",
      }}
      onMouseEnter={e => e.currentTarget.style.background = "#0d1825"}
      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
    >
      <div style={{ width:20, color:"#1e3a5f", fontSize:11, fontFamily:"'Space Mono',monospace", textAlign:"right" }}>{rank}</div>
      <div style={{ width:44 }}><PosBadge pos={player.pos} /></div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ color:"#e2e8f0", fontSize:14, fontWeight:600, fontFamily:"'DM Sans',sans-serif", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
          {player.name}
        </div>
        <div style={{ color:"#334155", fontSize:11, fontFamily:"'Space Mono',monospace", marginTop:1 }}>{player.team}</div>
      </div>
      <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:3 }}>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          <span style={{ color:"#c084fc", fontSize:11, fontFamily:"'Space Mono',monospace" }}>
            {liveKtc.toLocaleString()}
            {trend !== 0 && (
              <span style={{ color: trend > 0 ? "#10b981" : "#ef4444", fontSize:9, marginLeft:2 }}>
                {trend > 0 ? "▲" : "▼"}
              </span>
            )}
          </span>
          {fcVal != null && <span style={{ color:"#60a5fa", fontSize:11, fontFamily:"'Space Mono',monospace" }}>{fcVal.toLocaleString()}</span>}
          {delta != null && (
            <span style={{ color: delta > 200 ? "#10b981" : delta < -200 ? "#ef4444" : "#334155", fontSize:10 }}>
              {delta > 0 ? "▲" : delta < 0 ? "▼" : "·"}
            </span>
          )}
        </div>
        <div style={{ display:"flex", gap:4, alignItems:"center" }}>
          <AgeBadge age={player.age} />
          <SlotBadge slot={player.slot} />
        </div>
      </div>
    </div>
  );
}

function RosterTab({ roster, fcData, ktcLive, onPlayerClick }) {
  const [filterTab, setFilterTab] = useState("ALL");
  const [sortBy,    setSortBy]    = useState("slot");

  const counts = Object.fromEntries(
    ROSTER_FILTER_TABS.map(t => [
      t.key,
      t.key === "ALL" ? roster.length
        : ["STARTER","BENCH","TAXI","IR"].includes(t.key)
          ? roster.filter(p => p.slot === t.key).length
          : roster.filter(p => p.pos  === t.key).length,
    ])
  );

  let filtered = roster.filter(p => {
    if (filterTab === "ALL") return true;
    if (["STARTER","BENCH","TAXI","IR"].includes(filterTab)) return p.slot === filterTab;
    return p.pos === filterTab;
  });

  filtered = [...filtered].sort((a, b) => {
    if (sortBy === "age") return a.age - b.age;
    if (sortBy === "pos") return POS_ORDER.indexOf(a.pos) - POS_ORDER.indexOf(b.pos);
    if (sortBy === "ktc") return ktcVal(b, ktcLive) - ktcVal(a, ktcLive);
    if (sortBy === "fc") {
      const fa = fcData?.find(f => f.player?.name === a.name)?.value ?? 0;
      const fb = fcData?.find(f => f.player?.name === b.name)?.value ?? 0;
      return fb - fa;
    }
    const sd = SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot);
    return sd !== 0 ? sd : POS_ORDER.indexOf(a.pos) - POS_ORDER.indexOf(b.pos);
  });

  const tabColor = (key) => {
    if (["STARTER","BENCH","TAXI","IR"].includes(key)) return SLOT_COLORS[key] || "#3b82f6";
    if (["QB","RB","WR","TE"].includes(key))            return POS_COLORS[key]  || "#3b82f6";
    return "#3b82f6";
  };

  return (
    <div>
      <div style={{ display:"flex", gap:5, paddingTop:14, overflowX:"auto", paddingBottom:4 }}>
        {ROSTER_FILTER_TABS.map(tab => {
          const active = filterTab === tab.key;
          const c = tabColor(tab.key);
          return (
            <button key={tab.key} onClick={() => setFilterTab(tab.key)} style={{
              background: active ? c+"18" : "#0c1828",
              border:`1px solid ${active ? c+"66" : "#1a2d40"}`,
              color: active ? c : "#334155",
              borderRadius:6, padding:"5px 10px", fontSize:10,
              fontFamily:"'Space Mono',monospace", fontWeight:700,
              letterSpacing:"0.06em", cursor:"pointer", whiteSpace:"nowrap",
            }}>
              {tab.label} <span style={{ opacity:0.6 }}>({counts[tab.key]})</span>
            </button>
          );
        })}
      </div>

      <div style={{ display:"flex", gap:5, marginTop:8, alignItems:"center" }}>
        <span style={{ color:"#1e3a5f", fontSize:9, fontFamily:"'Space Mono',monospace" }}>SORT</span>
        {[["slot","SLOT"],["pos","POS"],["age","AGE"],["ktc","KTC"],["fc","FC"]].map(([key,label]) => (
          <button key={key} onClick={() => setSortBy(key)} style={{
            background: sortBy===key ? "#1e3a5f" : "transparent",
            border:`1px solid ${sortBy===key ? "#3b82f6" : "#1a2d40"}`,
            color: sortBy===key ? "#93c5fd" : "#334155",
            borderRadius:4, padding:"3px 8px", fontSize:9,
            fontFamily:"'Space Mono',monospace", fontWeight:700, cursor:"pointer",
          }}>{label}</button>
        ))}
        <span style={{ color:"#1e3a5f", fontSize:9, fontFamily:"'Space Mono',monospace", marginLeft:"auto" }}>
          <span style={{ color:"#c084fc" }}>■</span> KTC <span style={{ color:"#60a5fa" }}>■</span> FC
        </span>
      </div>

      <div style={{ marginTop:10, border:"1px solid #1a2d40", borderRadius:10, overflow:"hidden", background:"#080e1a" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, padding:"7px 16px", background:"#0c1828", borderBottom:"1px solid #1a2d40" }}>
          <div style={{ width:20 }} />
          <div style={{ width:44, color:"#1e3a5f", fontSize:9, fontFamily:"'Space Mono',monospace" }}>POS</div>
          <div style={{ flex:1,  color:"#1e3a5f", fontSize:9, fontFamily:"'Space Mono',monospace" }}>PLAYER</div>
          <div style={{ color:"#1e3a5f", fontSize:9, fontFamily:"'Space Mono',monospace" }}>KTC / FC / AGE</div>
        </div>
        {filtered.map((player, i) => (
          <PlayerRow key={player.id} player={player} rank={i+1} fcData={fcData} ktcLive={ktcLive} onClick={onPlayerClick} />
        ))}
      </div>
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
      <div style={{ background:"#0a1525", border:"1px solid #1a2d40", borderRadius:10, padding:"14px 16px", marginBottom:12 }}>
        <div style={{ color:"#60a5fa", fontSize:9, fontFamily:"'Space Mono',monospace", letterSpacing:"0.18em", marginBottom:8 }}>PLAYER NEWS</div>
        <div style={{ color:"#1e3a5f", fontSize:10, fontFamily:"'Space Mono',monospace" }}>LOADING...</div>
      </div>
    );
  }
  if (!news.length) return null;

  // Flatten all items, sort by recency, enforce 3-per-player cap
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
    <div style={{ background:"#0a1525", border:"1px solid #1a2d40", borderRadius:10, padding:"14px 16px", marginBottom:12 }}>
      <div style={{ color:"#60a5fa", fontSize:9, fontFamily:"'Space Mono',monospace", letterSpacing:"0.18em", marginBottom:12 }}>PLAYER NEWS</div>
      {items.map((item, i) => (
        <div
          key={`${item.player.id}-${i}`}
          style={{
            borderBottom: i < items.length - 1 ? "1px solid #0d1825" : "none",
            paddingBottom: i < items.length - 1 ? 12 : 0,
            marginBottom:  i < items.length - 1 ? 12 : 0,
          }}
        >
          <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:4 }}>
            <PosBadge pos={item.player.pos} />
            <span style={{ color:"#94a3b8", fontSize:11, fontFamily:"'DM Sans',sans-serif", fontWeight:600 }}>
              {item.player.name}
            </span>
            <span style={{ marginLeft:"auto", color:"#1e3a5f", fontSize:10, fontFamily:"'Space Mono',monospace", flexShrink:0 }}>
              {timeAgo(item.published || item.date || 0)}
            </span>
          </div>
          <div style={{ color:"#e2e8f0", fontSize:12, fontFamily:"'DM Sans',sans-serif", lineHeight:1.5, marginBottom:4 }}>
            {item.title || item.headline || "—"}
          </div>
          {(item.source || item.source_type) && (
            <div style={{ color:"#334155", fontSize:9, fontFamily:"'Space Mono',monospace", letterSpacing:"0.06em" }}>
              {(item.source || item.source_type).toUpperCase()}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Briefing tab ──────────────────────────────────────────────────────────────

function BriefingTab({ roster, fcData, lastUpdated, onRefresh, refreshing, ktcLive, today }) {
  const starters   = roster.filter(p => p.slot === "STARTER");
  const topAssets  = [...roster].sort((a,b) => ktcVal(b, ktcLive) - ktcVal(a, ktcLive)).slice(0, 8);
  const irPlayers  = roster.filter(p => p.slot === "IR");
  const totalKtc   = roster.reduce((s,p) => s + ktcVal(p, ktcLive), 0);

  const [playerNews, setPlayerNews] = useState(null);

  useEffect(() => {
    // Single ESPN fetch after initial render; athlete categories let us match to our starters.
    // Section renders nothing during offseason when starters aren't in the news cycle.
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
  }, [roster]); // re-runs once when live roster replaces fallback

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
        {/* FC status */}
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          <span style={{ width:6, height:6, borderRadius:"50%", background: fcData ? "#10b981" : "#ef4444", display:"inline-block" }} />
          <span style={{ color:"#334155", fontSize:9, fontFamily:"'Space Mono',monospace" }}>
            FC {fcData ? "LIVE" : "OFFLINE"}{lastUpdated ? ` · ${lastUpdated}` : ""}
          </span>
        </div>
        {/* KTC status */}
        {(() => {
          const scrapedAt = ktcLive?.scraped_at;
          const isToday   = scrapedAt?.slice(0,10) === today;
          const color     = ktcLive ? (isToday ? "#10b981" : "#f59e0b") : "#ef4444";
          const label     = ktcLive ? (isToday ? "KTC LIVE" : "KTC STALE") : "KTC OFFLINE";
          const time      = scrapedAt ? new Date(scrapedAt).toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" }) : null;
          return (
            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
              <span style={{ width:6, height:6, borderRadius:"50%", background:color, display:"inline-block" }} />
              <span style={{ color:"#334155", fontSize:9, fontFamily:"'Space Mono',monospace" }}>
                {label}{isToday && time ? ` · ${time}` : ""}
              </span>
            </div>
          );
        })()}
        <button onClick={onRefresh} disabled={refreshing} style={{
          background:"transparent", border:"1px solid #1a2d40", borderRadius:4,
          color: refreshing ? "#1e3a5f" : "#334155", fontSize:10, cursor:"pointer",
          padding:"2px 8px", fontFamily:"'Space Mono',monospace",
        }}>{refreshing ? "..." : "↺ REFRESH"}</button>
      </div>

      {/* IR alert */}
      {irPlayers.length > 0 && (
        <div style={{ background:"#0c1020", border:"1px solid #2d1a3a", borderRadius:8, padding:"10px 14px", display:"flex", gap:10, alignItems:"flex-start", marginBottom:12 }}>
          <span style={{ color:"#ef4444", fontSize:14 }}>⚠</span>
          <div>
            <div style={{ color:"#a855f7", fontSize:11, fontFamily:"'Space Mono',monospace", fontWeight:700, marginBottom:3 }}>IR WATCH</div>
            <div style={{ color:"#64748b", fontSize:12 }}>
              {irPlayers.map((p,i) => (
                <span key={p.id}>
                  <span style={{ color:"#e2e8f0", fontWeight:600 }}>{p.name}</span> ({p.pos} · {p.team} · {p.age})
                  {i < irPlayers.length - 1 ? " and " : ""}
                </span>
              ))} {irPlayers.length === 1 ? "is" : "are"} on reserve.
            </div>
          </div>
        </div>
      )}

      <PlayerNewsSection news={playerNews} />

      <NeedsAnalysis roster={roster} />

      {/* Top 8 assets */}
      <div style={{ background:"#0a1525", border:"1px solid #1a2d40", borderRadius:10, padding:"14px 16px", marginBottom:12 }}>
        <div style={{ color:"#60a5fa", fontSize:9, fontFamily:"'Space Mono',monospace", letterSpacing:"0.18em", marginBottom:10 }}>TOP 8 ASSETS</div>
        {topAssets.map((p, i) => (
          <div key={p.id} style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
            <div style={{ color:"#1e3a5f", fontSize:11, fontFamily:"'Space Mono',monospace", width:16 }}>{i+1}</div>
            <PosBadge pos={p.pos} />
            <div style={{ flex:1, color:"#e2e8f0", fontSize:13, fontFamily:"'DM Sans',sans-serif", fontWeight:600, display:"flex", alignItems:"center", gap:6 }}>
              {p.name}
              {p.slot !== "STARTER" && <SlotBadge slot={p.slot} />}
            </div>
            <span style={{ color:"#c084fc", fontSize:11, fontFamily:"'Space Mono',monospace" }}>{ktcVal(p, ktcLive).toLocaleString()}</span>
          </div>
        ))}
        <div style={{ marginTop:8, paddingTop:8, borderTop:"1px solid #1a2d40", display:"flex", justifyContent:"space-between" }}>
          <span style={{ color:"#1e3a5f", fontSize:9, fontFamily:"'Space Mono',monospace" }}>TOTAL ROSTER KTC</span>
          <span style={{ color:"#c084fc", fontSize:11, fontFamily:"'Space Mono',monospace" }}>{totalKtc.toLocaleString()}</span>
        </div>
      </div>

      <ValueTrend fcData={fcData} roster={roster} />

      {/* FC vs KTC divergence */}
      {movers.length > 0 && (
        <div style={{ background:"#0a1525", border:"1px solid #1a2d40", borderRadius:10, padding:"14px 16px", marginBottom:12 }}>
          <div style={{ color:"#60a5fa", fontSize:9, fontFamily:"'Space Mono',monospace", letterSpacing:"0.18em", marginBottom:10 }}>FC vs KTC DIVERGENCE</div>
          {movers.map(p => (
            <div key={p.id} style={{ display:"flex", alignItems:"center", gap:10, marginBottom:7 }}>
              <PosBadge pos={p.pos} />
              <div style={{ flex:1, color:"#94a3b8", fontSize:12, fontFamily:"'DM Sans',sans-serif" }}>{p.name}</div>
              <span style={{ color:"#c084fc", fontSize:10, fontFamily:"'Space Mono',monospace" }}>{ktcVal(p, ktcLive).toLocaleString()}</span>
              <span style={{ color:"#334155", fontSize:10 }}>→</span>
              <span style={{ color:"#60a5fa", fontSize:10, fontFamily:"'Space Mono',monospace" }}>{p.fc.toLocaleString()}</span>
              <span style={{ color: p.delta > 0 ? "#10b981" : "#ef4444", fontSize:10, fontFamily:"'Space Mono',monospace", minWidth:52, textAlign:"right" }}>
                {p.delta > 0 ? "+" : ""}{p.delta.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Picks tab ─────────────────────────────────────────────────────────────────

function PicksTab() {
  const totalKtc = PICKS.reduce((s,p) => s + p.ktc, 0);
  const roundLabel = (r) => r === 1 ? "1ST" : r === 2 ? "2ND" : r === 3 ? "3RD" : "4TH";
  const roundColor = (r) => r === 1 ? "#f59e0b" : r === 2 ? "#3b82f6" : "#64748b";

  return (
    <div style={{ paddingTop:14 }}>
      <div style={{ background:"#0a1525", border:"1px solid #1a2d40", borderRadius:10, overflow:"hidden" }}>
        <div style={{ padding:"10px 16px", background:"#0c1828", borderBottom:"1px solid #1a2d40", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div style={{ color:"#60a5fa", fontSize:9, fontFamily:"'Space Mono',monospace", letterSpacing:"0.18em" }}>DRAFT CAPITAL</div>
          <div style={{ color:"#c084fc", fontSize:11, fontFamily:"'Space Mono',monospace" }}>TOTAL {totalKtc.toLocaleString()}</div>
        </div>
        {PICKS.map(pick => {
          const c = roundColor(pick.round);
          return (
            <div key={pick.id} style={{ display:"flex", alignItems:"center", gap:12, padding:"11px 16px", borderBottom:"1px solid #0d1825" }}>
              <span style={{
                background:c+"20", color:c, border:`1px solid ${c}50`,
                borderRadius:6, padding:"3px 10px", fontSize:11,
                fontFamily:"'Space Mono',monospace", fontWeight:700, minWidth:36, textAlign:"center",
              }}>{roundLabel(pick.round)}</span>
              <div style={{ flex:1 }}>
                <div style={{ color:"#e2e8f0", fontSize:13, fontFamily:"'DM Sans',sans-serif", fontWeight:600 }}>{pick.label}</div>
                {pick.note && <div style={{ color:"#334155", fontSize:11, fontFamily:"'Space Mono',monospace", marginTop:1 }}>{pick.note}</div>}
              </div>
              <div style={{ color:"#c084fc", fontSize:13, fontFamily:"'Space Mono',monospace" }}>{pick.ktc.toLocaleString()}</div>
            </div>
          );
        })}
      </div>
      <div style={{ marginTop:12, background:"#060d16", border:"1px solid #1a2d40", borderRadius:8, padding:"10px 14px" }}>
        <div style={{ color:"#334155", fontSize:9, fontFamily:"'Space Mono',monospace", letterSpacing:"0.1em", marginBottom:6 }}>CAPITAL OUTLOOK</div>
        <div style={{ color:"#64748b", fontSize:12, fontFamily:"'DM Sans',sans-serif", lineHeight:1.6 }}>
          Strong 2027 1st from Pitts trade. Own all picks through 2027. Contend-and-reload posture — not selling picks.
        </div>
      </div>
    </div>
  );
}

// ── Trades tab ────────────────────────────────────────────────────────────────

function TradesTab() {
  return (
    <div style={{ paddingTop:14 }}>
      {TRADES.map(trade => (
        <div key={trade.id} style={{ background:"#0a1525", border:"1px solid #1a2d40", borderRadius:10, padding:"14px 16px", marginBottom:10 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
            <div style={{ color:"#e2e8f0", fontSize:15, fontFamily:"'DM Sans',sans-serif", fontWeight:700 }}>{trade.label}</div>
            <span style={{
              background:trade.verdictColor+"18", color:trade.verdictColor,
              border:`1px solid ${trade.verdictColor}40`,
              borderRadius:4, padding:"2px 8px", fontSize:10,
              fontFamily:"'Space Mono',monospace", fontWeight:700,
            }}>{trade.verdict}</span>
          </div>
          <div style={{ display:"flex", gap:12, marginBottom:10 }}>
            <div style={{ flex:1 }}>
              <div style={{ color:"#ef4444", fontSize:9, fontFamily:"'Space Mono',monospace", letterSpacing:"0.1em", marginBottom:4 }}>GAVE</div>
              {trade.gave.map(n => <div key={n} style={{ color:"#94a3b8", fontSize:12, fontFamily:"'DM Sans',sans-serif" }}>{n}</div>)}
              <div style={{ color:"#c084fc", fontSize:11, fontFamily:"'Space Mono',monospace", marginTop:4 }}>{trade.gaveKtc.toLocaleString()}</div>
            </div>
            <div style={{ flex:1 }}>
              <div style={{ color:"#10b981", fontSize:9, fontFamily:"'Space Mono',monospace", letterSpacing:"0.1em", marginBottom:4 }}>GOT</div>
              {trade.got.map(n => <div key={n} style={{ color:"#94a3b8", fontSize:12, fontFamily:"'DM Sans',sans-serif" }}>{n}</div>)}
              <div style={{ color:"#c084fc", fontSize:11, fontFamily:"'Space Mono',monospace", marginTop:4 }}>{trade.gotKtc.toLocaleString()}</div>
            </div>
          </div>
          <div style={{ color:"#334155", fontSize:11, fontFamily:"'DM Sans',sans-serif" }}>{trade.note}</div>
          <div style={{ color:"#1e3a5f", fontSize:9, fontFamily:"'Space Mono',monospace", marginTop:6 }}>{trade.date}</div>
        </div>
      ))}
    </div>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  const [navTab,          setNavTab]         = useState("briefing");
  const [fcData,          setFcData]         = useState(null);
  const [lastUpdated,     setLastUpdated]    = useState(null);
  const [refreshing,      setRefreshing]     = useState(false);
  const [selectedPlayer,  setSelectedPlayer] = useState(null);
  const [ktcLive,         setKtcLive]        = useState(null);
  const { roster, rosterLoading }            = useRoster();

  const today = new Date().toISOString().slice(0, 10);

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

  const fetchFc = useCallback(async () => {
    setRefreshing(true);
    try {
      const res  = await fetch(FC_URL);
      const data = await res.json();
      setFcData(data);
      saveSnapshot(data);
      setLastUpdated(new Date().toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" }));
      localStorage.setItem("fc_last_known", JSON.stringify(data));
    } catch {
      const cached = localStorage.getItem("fc_last_known");
      if (cached && !fcData) {
        setFcData(JSON.parse(cached));
        setLastUpdated("STALE");
      }
    } finally {
      setRefreshing(false);
    }
  }, [saveSnapshot]);

  useEffect(() => {
    fetchFc();
    const interval = setInterval(fetchFc, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchFc]);

  // Fetch KTC live data from the scraped JSON file (served from public/)
  useEffect(() => {
    fetch(KTC_URL)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setKtcLive(data); })
      .catch(() => {});
  }, []);

  const starterCount  = roster.filter(p => p.slot === "STARTER").length;
  const avgAge        = roster.length ? (roster.reduce((s,p) => s + p.age, 0) / roster.length).toFixed(1) : "—";
  const starterAvgAge = starterCount  ? (roster.filter(p => p.slot === "STARTER").reduce((s,p) => s + p.age, 0) / starterCount).toFixed(1) : "—";

  return (
    <div style={{ minHeight:"100vh", background:"#060d16", color:"#e2e8f0", fontFamily:"'DM Sans',sans-serif", paddingBottom:60 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@400;600;700&family=Space+Mono:wght@400;700&display=swap');
        * { box-sizing:border-box; margin:0; }
        ::-webkit-scrollbar { height:3px; width:3px; }
        ::-webkit-scrollbar-track { background:transparent; }
        ::-webkit-scrollbar-thumb { background:#1e3a5f; border-radius:4px; }
        input { outline:none; }
        input:focus { border-color:#3b82f6 !important; }
      `}</style>

      {/* HEADER */}
      <div style={{
        background:"linear-gradient(135deg,#08152a 0%,#0c1e3d 60%,#08152a 100%)",
        borderBottom:"1px solid #1a3050", padding:"24px 20px 20px",
        position:"relative", overflow:"hidden",
      }}>
        <div style={{ position:"absolute", inset:0, opacity:0.04, backgroundImage:"linear-gradient(#3b82f6 1px,transparent 1px),linear-gradient(90deg,#3b82f6 1px,transparent 1px)", backgroundSize:"32px 32px" }} />
        <div style={{ position:"relative" }}>
          <div style={{ color:"#3b82f6", fontSize:10, fontFamily:"'Space Mono',monospace", letterSpacing:"0.22em", marginBottom:6 }}>DYNASTY COMMAND CENTER</div>
          <h1 style={{ fontSize:40, fontFamily:"'Bebas Neue',cursive", letterSpacing:"0.06em", color:"#f1f5f9", lineHeight:1 }}>LEGION OF CMINN</h1>
          <div style={{ color:"#1e3a5f", fontSize:11, fontFamily:"'Space Mono',monospace", marginTop:4 }}>{LEAGUE.name} · {LEAGUE.season}</div>
          <div style={{ display:"flex", gap:8, marginTop:18, flexWrap:"wrap" }}>
            <StatCard label="RECORD"  value="0-0-0"            color="#64748b" />
            <StatCard label="ROSTER"  value={rosterLoading ? "…" : roster.length} sub="players" color="#a855f7" />
            <StatCard label="AVG AGE" value={avgAge}            sub={`starters ${starterAvgAge}`} color="#10b981" />
            <StatCard label="FAAB"    value={`$${LEAGUE.faab}`} sub="unspent"  color="#f59e0b" />
          </div>
        </div>
      </div>

      {/* NAV TABS */}
      <div style={{ display:"flex", gap:0, borderBottom:"1px solid #1a2d40", overflowX:"auto" }}>
        {NAV_TABS.map(tab => {
          const active = navTab === tab.key;
          return (
            <button key={tab.key} onClick={() => setNavTab(tab.key)} style={{
              background: active ? "#0a1525" : "transparent",
              border:"none", borderBottom:`2px solid ${active ? "#3b82f6" : "transparent"}`,
              color: active ? "#60a5fa" : "#334155",
              padding:"12px 16px", fontSize:11,
              fontFamily:"'Space Mono',monospace", fontWeight:700,
              letterSpacing:"0.1em", cursor:"pointer", whiteSpace:"nowrap",
              transition:"color 0.15s",
            }}>{tab.label}</button>
          );
        })}
      </div>

      {/* CONTENT */}
      <div style={{ padding:"0 16px" }}>
        {navTab === "briefing"  && <BriefingTab roster={roster} fcData={fcData} lastUpdated={lastUpdated} onRefresh={fetchFc} refreshing={refreshing} ktcLive={ktcLive} today={today} />}
        {navTab === "roster"    && <RosterTab   roster={roster} fcData={fcData} ktcLive={ktcLive} onPlayerClick={setSelectedPlayer} />}
        {navTab === "picks"     && <PicksTab />}
        {navTab === "trades"    && <TradesTab />}
        {navTab === "tradecalc" && <TradeCalc  fcData={fcData} ktcLive={ktcLive} roster={roster} />}
      </div>

      {selectedPlayer && (
        <PlayerModal player={selectedPlayer} fcData={fcData} ktcLive={ktcLive} onClose={() => setSelectedPlayer(null)} />
      )}

      <div style={{ padding:"20px 16px 0", color:"#0f1f30", fontSize:9, fontFamily:"'Space Mono',monospace", letterSpacing:"0.1em" }}>
        WORM UP DYNASTY · SEASON 2026 · KTC 05/16/2026
      </div>
    </div>
  );
}
