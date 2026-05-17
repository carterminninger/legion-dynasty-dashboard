import { useState, useEffect, useRef, useMemo } from "react";

const POS_COLORS = { QB:"#f59e0b", RB:"#10b981", WR:"#3b82f6", TE:"#a855f7" };

function PosBadge({ pos }) {
  const c = POS_COLORS[pos] || "#64748b";
  return (
    <span style={{
      background:c+"20", color:c, border:`1px solid ${c}50`,
      borderRadius:4, padding:"1px 5px", fontSize:10,
      fontFamily:"'Space Mono',monospace", fontWeight:700,
    }}>{pos}</span>
  );
}

function OnRosterBadge() {
  return (
    <span style={{
      background:"#10b98115", color:"#10b981", border:"1px solid #10b98140",
      borderRadius:3, padding:"0 4px", fontSize:9,
      fontFamily:"'Space Mono',monospace", fontWeight:700, letterSpacing:"0.05em",
    }}>ON ROSTER</span>
  );
}

function PlayerCard({ item, onRemove }) {
  return (
    <div style={{
      display:"flex", alignItems:"center", gap:8, padding:"8px 12px",
      background:"#060d16", border:"1px solid #1a2d40", borderRadius:8, marginBottom:6,
    }}>
      <PosBadge pos={item.pos} />
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
          <span style={{ color:"#e2e8f0", fontSize:13, fontFamily:"'DM Sans',sans-serif", fontWeight:600, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{item.name}</span>
          {item.isOnRoster && <OnRosterBadge />}
        </div>
        <div style={{ display:"flex", gap:8, marginTop:2 }}>
          <span style={{ color:"#c084fc", fontSize:10, fontFamily:"'Space Mono',monospace" }}>KTC {item.ktc?.toLocaleString() ?? "—"}</span>
          <span style={{ color:"#60a5fa", fontSize:10, fontFamily:"'Space Mono',monospace" }}>FC {item.fc?.toLocaleString() ?? "—"}</span>
        </div>
      </div>
      <button onClick={() => onRemove(item.name)} style={{
        background:"transparent", border:"none", color:"#334155", fontSize:16, cursor:"pointer", lineHeight:1, padding:"0 4px",
      }}>✕</button>
    </div>
  );
}

function SearchBox({ side, ktcLive, allFc, onAdd, added, rosterNames, roster }) {
  const [query,   setQuery]   = useState("");
  const [results, setResults] = useState([]);
  const ref = useRef();

  useEffect(() => {
    const q = query.trim().toLowerCase();
    if (!q || q.length < 2) { setResults([]); return; }

    let hits;

    if (ktcLive?.players) {
      // Full 500-player KTC dataset — primary path
      hits = Object.entries(ktcLive.players)
        .filter(([name]) => name.toLowerCase().includes(q) && !added.includes(name))
        .map(([name, p]) => {
          const fc = allFc?.find(f => f.player?.name === name);
          return {
            name,
            pos:        p.position || "?",
            team:       p.team || "FA",
            ktc:        p.sf_value,
            fc:         fc?.value ?? null,
            isOnRoster: rosterNames.has(name),
          };
        })
        .sort((a, b) => {
          // Roster players surface first, then rank by KTC value
          if (a.isOnRoster !== b.isOnRoster) return a.isOnRoster ? -1 : 1;
          return (b.ktc || 0) - (a.ktc || 0);
        })
        .slice(0, 10);
    } else {
      // Fallback while ktcLive is loading: roster KTC + FC pool
      const rosterHits = roster
        .filter(p => p.name.toLowerCase().includes(q) && !added.includes(p.name))
        .map(p => {
          const fc = allFc?.find(f => f.player?.name === p.name);
          return { name:p.name, pos:p.pos, team:p.team, ktc:p.ktc, fc:fc?.value ?? null, isOnRoster:true };
        });
      const fcHits = (allFc || [])
        .filter(f => {
          const n = f.player?.name || "";
          return n.toLowerCase().includes(q) && !rosterNames.has(n) && !added.includes(n);
        })
        .slice(0, 6)
        .map(f => ({
          name:f.player.name, pos:f.player.position || "?", team:f.player.team || "FA",
          ktc:null, fc:f.value, isOnRoster:false,
        }));
      hits = [...rosterHits, ...fcHits].slice(0, 10);
    }

    setResults(hits);
  }, [query, ktcLive, allFc, added]);

  const pick = (item) => {
    onAdd(item);
    setQuery("");
    setResults([]);
  };

  return (
    <div ref={ref} style={{ position:"relative", marginBottom:10 }}>
      <input
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder={`Search all players — ${side}`}
        style={{
          width:"100%", background:"#060d16", border:"1px solid #1a2d40", borderRadius:6,
          color:"#e2e8f0", padding:"8px 12px", fontSize:12, fontFamily:"'DM Sans',sans-serif",
          outline:"none",
        }}
      />
      {results.length > 0 && (
        <div style={{
          position:"absolute", top:"100%", left:0, right:0, zIndex:50,
          background:"#0a1525", border:"1px solid #1a2d40", borderRadius:6,
          marginTop:2, maxHeight:260, overflowY:"auto",
        }}>
          {results.map(item => (
            <div
              key={item.name}
              onClick={() => pick(item)}
              style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 12px", cursor:"pointer", borderBottom:"1px solid #0d1825" }}
              onMouseEnter={e => e.currentTarget.style.background = "#0d1825"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            >
              <PosBadge pos={item.pos} />
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:"flex", alignItems:"center", gap:5, flexWrap:"wrap" }}>
                  <span style={{ color:"#e2e8f0", fontSize:12, fontFamily:"'DM Sans',sans-serif" }}>{item.name}</span>
                  {item.isOnRoster && <OnRosterBadge />}
                </div>
                <div style={{ color:"#334155", fontSize:10, fontFamily:"'Space Mono',monospace", marginTop:1 }}>{item.team}</div>
              </div>
              <div style={{ textAlign:"right", flexShrink:0 }}>
                {item.ktc != null && <div style={{ color:"#c084fc", fontSize:10, fontFamily:"'Space Mono',monospace" }}>{item.ktc.toLocaleString()}</div>}
                {item.fc  != null && <div style={{ color:"#60a5fa", fontSize:10, fontFamily:"'Space Mono',monospace" }}>{item.fc.toLocaleString()}</div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function TradeCalc({ fcData, ktcLive, roster }) {
  const rosterNames   = useMemo(() => new Set(roster.map(p => p.name)), [roster]);

  const [give, setGive] = useState([]);
  const [get,  setGet]  = useState([]);

  const addTo = (side, item) => {
    if (side === "give") setGive(prev => prev.find(p => p.name === item.name) ? prev : [...prev, item]);
    else                  setGet(prev  => prev.find(p => p.name === item.name) ? prev : [...prev, item]);
  };
  const removeFrom = (side, name) => {
    if (side === "give") setGive(prev => prev.filter(p => p.name !== name));
    else                  setGet(prev  => prev.filter(p => p.name !== name));
  };

  const sumKtc = (arr) => arr.reduce((s, p) => s + (p.ktc || 0), 0);
  const sumFc  = (arr) => arr.reduce((s, p) => s + (p.fc  || 0), 0);

  const giveKtc = sumKtc(give), getKtc = sumKtc(get);
  const giveFc  = sumFc(give),  getFc  = sumFc(get);
  const deltaKtc = getKtc - giveKtc;
  const deltaFc  = getFc  - giveFc;

  // KTC is the primary verdict metric
  const verdict = (delta, total) => {
    if (!total) return { label:"—", color:"#334155" };
    const pct = (delta / total) * 100;
    if (pct > 5)  return { label:"WIN",  color:"#10b981" };
    if (pct < -5) return { label:"LOSS", color:"#ef4444" };
    return { label:"FAIR", color:"#f59e0b" };
  };
  const v = verdict(deltaKtc, giveKtc || 1);

  const allAdded = [...give.map(p => p.name), ...get.map(p => p.name)];

  return (
    <div style={{ padding:"16px 0" }}>
      <div style={{ display:"flex", gap:12 }}>
        {/* YOU GIVE */}
        <div style={{ flex:1 }}>
          <div style={{ color:"#ef4444", fontSize:9, fontFamily:"'Space Mono',monospace", letterSpacing:"0.18em", marginBottom:8 }}>YOU GIVE</div>
          <SearchBox side="YOU GIVE" ktcLive={ktcLive} allFc={fcData} onAdd={item => addTo("give", item)} added={allAdded} rosterNames={rosterNames} roster={roster} />
          {give.map(item => <PlayerCard key={item.name} item={item} onRemove={name => removeFrom("give", name)} />)}
          {give.length === 0 && <div style={{ color:"#1e3a5f", fontSize:11, fontFamily:"'Space Mono',monospace" }}>Search to add players</div>}
        </div>

        {/* YOU GET */}
        <div style={{ flex:1 }}>
          <div style={{ color:"#10b981", fontSize:9, fontFamily:"'Space Mono',monospace", letterSpacing:"0.18em", marginBottom:8 }}>YOU GET</div>
          <SearchBox side="YOU GET" ktcLive={ktcLive} allFc={fcData} onAdd={item => addTo("get", item)} added={allAdded} rosterNames={rosterNames} roster={roster} />
          {get.map(item => <PlayerCard key={item.name} item={item} onRemove={name => removeFrom("get", name)} />)}
          {get.length === 0 && <div style={{ color:"#1e3a5f", fontSize:11, fontFamily:"'Space Mono',monospace" }}>Search to add players</div>}
        </div>
      </div>

      {/* Summary bar */}
      {(give.length > 0 || get.length > 0) && (
        <div style={{
          marginTop:16, background:"#060d16", border:`1px solid ${v.color}40`,
          borderRadius:10, padding:"12px 16px",
        }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
            <div style={{ color:"#334155", fontSize:9, fontFamily:"'Space Mono',monospace", letterSpacing:"0.1em" }}>TRADE VERDICT</div>
            <span style={{
              background:v.color+"18", color:v.color, border:`1px solid ${v.color}50`,
              borderRadius:4, padding:"3px 10px", fontSize:12,
              fontFamily:"'Space Mono',monospace", fontWeight:700,
            }}>{v.label}</span>
          </div>
          <div style={{ display:"flex", gap:16 }}>
            <div style={{ flex:1 }}>
              <div style={{ color:"#c084fc", fontSize:9, fontFamily:"'Space Mono',monospace", letterSpacing:"0.1em", marginBottom:4 }}>KTC · PRIMARY</div>
              <div style={{ display:"flex", justifyContent:"space-between" }}>
                <span style={{ color:"#ef4444", fontSize:13, fontFamily:"'Bebas Neue',cursive" }}>{giveKtc.toLocaleString()}</span>
                <span style={{ color:"#334155", fontSize:11 }}>→</span>
                <span style={{ color:"#10b981", fontSize:13, fontFamily:"'Bebas Neue',cursive" }}>{getKtc.toLocaleString()}</span>
              </div>
              <div style={{ color:deltaKtc >= 0 ? "#10b981" : "#ef4444", fontSize:11, fontFamily:"'Space Mono',monospace", marginTop:2 }}>
                {deltaKtc >= 0 ? "+" : ""}{deltaKtc.toLocaleString()} pts
              </div>
            </div>
            <div style={{ width:1, background:"#1a2d40" }} />
            <div style={{ flex:1 }}>
              <div style={{ color:"#60a5fa", fontSize:9, fontFamily:"'Space Mono',monospace", letterSpacing:"0.1em", marginBottom:4 }}>FC · SECONDARY</div>
              <div style={{ display:"flex", justifyContent:"space-between" }}>
                <span style={{ color:"#ef4444", fontSize:13, fontFamily:"'Bebas Neue',cursive" }}>{giveFc.toLocaleString()}</span>
                <span style={{ color:"#334155", fontSize:11 }}>→</span>
                <span style={{ color:"#10b981", fontSize:13, fontFamily:"'Bebas Neue',cursive" }}>{getFc.toLocaleString()}</span>
              </div>
              <div style={{ color:deltaFc >= 0 ? "#10b981" : "#ef4444", fontSize:11, fontFamily:"'Space Mono',monospace", marginTop:2 }}>
                {deltaFc >= 0 ? "+" : ""}{deltaFc.toLocaleString()} pts
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Clear */}
      {(give.length > 0 || get.length > 0) && (
        <button onClick={() => { setGive([]); setGet([]); }} style={{
          marginTop:10, background:"transparent", border:"1px solid #1a2d40",
          color:"#334155", borderRadius:6, padding:"6px 14px", fontSize:10,
          fontFamily:"'Space Mono',monospace", cursor:"pointer",
        }}>CLEAR</button>
      )}
    </div>
  );
}
