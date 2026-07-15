import { useState, useEffect, useRef, useMemo } from "react";
import { cosmicApp as T, LABEL, NUM, MONO, GEORGIA, CONTROL_H, RADIUS } from "../kit/theme";
import { posColors } from "../kit/tokens";

function PosBadge({ pos }) {
  const c = posColors[pos] || "#64748b";
  return (
    <span style={{
      background:c+"20", color:c, border:`1px solid ${c}50`,
      borderRadius:4, padding:"1px 5px", fontSize:10,
      fontFamily:MONO, fontWeight:700,
    }}>{pos}</span>
  );
}

function OnRosterBadge() {
  return (
    <span style={{
      background:"rgba(0,229,255,0.1)", color:T.accent, border:`1px solid rgba(0,229,255,0.35)`,
      borderRadius:3, padding:"0 4px", fontSize:9,
      fontFamily:MONO, fontWeight:700, letterSpacing:"0.05em",
    }}>ON ROSTER</span>
  );
}

function PlayerCard({ item, onRemove }) {
  return (
    <div style={{
      display:"flex", alignItems:"center", gap:8, padding:"8px 12px", minHeight:52,
      background:T.surface, border:`1px solid ${T.border}`, borderRadius:RADIUS, marginBottom:6,
    }}>
      <PosBadge pos={item.pos} />
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
          <span style={{ color:T.text, fontSize:13, fontWeight:600, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{item.name}</span>
          {item.isOnRoster && <OnRosterBadge />}
        </div>
        <div style={{ display:"flex", gap:8, marginTop:2 }}>
          <span style={{ ...NUM, color:T.muted, fontSize:10 }}>KTC {item.ktc?.toLocaleString() ?? "—"}</span>
          <span style={{ ...NUM, color:T.muted, opacity:0.7, fontSize:10 }}>FC {item.fc?.toLocaleString() ?? "—"}</span>
        </div>
      </div>
      {/* 44px tap zone painted around the glyph — card stays 52px */}
      <span style={{ position:"relative", width:16, height:16, display:"inline-flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
        <button onClick={() => onRemove(item.name)} aria-label={`Remove ${item.name}`} style={{
          position:"absolute", top:"50%", left:"50%", transform:"translate(-50%,-50%)", width:44, height:44,
          background:"transparent", border:"none", color:T.muted, fontSize:16, cursor:"pointer", lineHeight:1, padding:0,
        }}>✕</button>
      </span>
    </div>
  );
}

function SearchBox({ side, ktcLive, allFc, onAdd, added, rosterNames, roster }) {
  const [query,   setQuery]   = useState("");
  const [focus,   setFocus]   = useState(false);
  const ref = useRef();

  // Results are pure derived state — useMemo, not effect+setState
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || q.length < 2) return [];

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
        onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
        placeholder={`Search players to add — ${side}`}
        aria-label={`Search players — ${side}`}
        style={{
          width:"100%", background:T.surface, border:`1px solid ${T.border}`, borderRadius:RADIUS,
          color:T.text, padding:"0 12px", height:CONTROL_H, fontSize:13,
          outline: focus ? `2px solid ${T.accent}` : "none", outlineOffset:2,
        }}
      />
      {results.length > 0 && (
        <div style={{
          position:"absolute", top:"100%", left:0, right:0, zIndex:50,
          background:T.bg, border:`1px solid ${T.border}`, borderRadius:RADIUS,
          marginTop:2, maxHeight:260, overflowY:"auto",
        }}>
          {results.map(item => (
            <button
              key={item.name}
              onClick={() => pick(item)}
              style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 12px", minHeight:44, width:"100%", textAlign:"left", cursor:"pointer", border:"none", borderBottom:`1px solid ${T.border}`, background:"transparent", color:T.text }}
              onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            >
              <PosBadge pos={item.pos} />
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:"flex", alignItems:"center", gap:5, flexWrap:"wrap" }}>
                  <span style={{ color:T.text, fontSize:12 }}>{item.name}</span>
                  {item.isOnRoster && <OnRosterBadge />}
                </div>
                <div style={{ ...NUM, color:T.muted, opacity:0.7, fontSize:10, marginTop:1 }}>{item.team}</div>
              </div>
              <div style={{ textAlign:"right", flexShrink:0 }}>
                {item.ktc != null && <div style={{ ...NUM, color:T.text, fontSize:10 }}>{item.ktc.toLocaleString()}</div>}
                {item.fc  != null && <div style={{ ...NUM, color:T.muted, fontSize:10 }}>{item.fc.toLocaleString()}</div>}
              </div>
            </button>
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
    if (!total) return { label:"—", color:T.muted };
    const pct = (delta / total) * 100;
    if (pct > 5)  return { label:"WIN",  color:T.success };
    if (pct < -5) return { label:"LOSS", color:T.danger };
    return { label:"FAIR", color:"#f59e0b" };
  };
  const v = verdict(deltaKtc, giveKtc || 1);

  const allAdded = [...give.map(p => p.name), ...get.map(p => p.name)];

  return (
    <div style={{ padding:"16px 0" }}>
      <h2 style={{ fontFamily:GEORGIA, fontStyle:"italic", fontWeight:700, fontSize:17, color:T.text, marginBottom:12 }}>Trade Calculator</h2>
      <div style={{ display:"flex", gap:12, flexWrap:"wrap" }}>
        {/* YOU GIVE */}
        <div style={{ flex:1, minWidth:260 }}>
          <div style={{ ...LABEL, color:T.danger, fontSize:"10px", marginBottom:8 }}>You give</div>
          <SearchBox side="you give" ktcLive={ktcLive} allFc={fcData} onAdd={item => addTo("give", item)} added={allAdded} rosterNames={rosterNames} roster={roster} />
          {give.map(item => <PlayerCard key={item.name} item={item} onRemove={name => removeFrom("give", name)} />)}
          {give.length === 0 && <div style={{ fontFamily:GEORGIA, fontStyle:"italic", color:T.muted, fontSize:13 }}>Search above to add the players you'd send.</div>}
        </div>

        {/* YOU GET */}
        <div style={{ flex:1, minWidth:260 }}>
          <div style={{ ...LABEL, color:T.success, fontSize:"10px", marginBottom:8 }}>You get</div>
          <SearchBox side="you get" ktcLive={ktcLive} allFc={fcData} onAdd={item => addTo("get", item)} added={allAdded} rosterNames={rosterNames} roster={roster} />
          {get.map(item => <PlayerCard key={item.name} item={item} onRemove={name => removeFrom("get", name)} />)}
          {get.length === 0 && <div style={{ fontFamily:GEORGIA, fontStyle:"italic", color:T.muted, fontSize:13 }}>Search above to add the players you'd receive.</div>}
        </div>
      </div>

      {/* Summary bar */}
      {(give.length > 0 || get.length > 0) && (
        <div style={{
          marginTop:16, background:T.surface, border:`1px solid ${v.color}40`,
          borderRadius:12, padding:"12px 16px",
        }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
            <div style={{ ...LABEL, color:T.muted, fontSize:"10px" }}>Trade verdict</div>
            <span style={{
              background:v.color+"18", color:v.color, border:`1px solid ${v.color}50`,
              borderRadius:4, padding:"3px 10px", fontSize:12,
              fontFamily:MONO, fontWeight:700,
            }}>{v.label}</span>
          </div>
          <div style={{ display:"flex", gap:16 }}>
            <div style={{ flex:1 }}>
              <div style={{ ...LABEL, color:T.muted, fontSize:"9px", marginBottom:4 }}>KTC · primary</div>
              <div style={{ display:"flex", justifyContent:"space-between" }}>
                <span style={{ ...NUM, color:T.danger, fontSize:14, fontWeight:700 }}>{giveKtc.toLocaleString()}</span>
                <span aria-hidden style={{ color:T.muted, opacity:0.5, fontSize:11 }}>→</span>
                <span style={{ ...NUM, color:T.success, fontSize:14, fontWeight:700 }}>{getKtc.toLocaleString()}</span>
              </div>
              <div style={{ ...NUM, color:deltaKtc >= 0 ? T.success : T.danger, fontSize:11, marginTop:2 }}>
                {deltaKtc >= 0 ? "+" : ""}{deltaKtc.toLocaleString()} pts
              </div>
            </div>
            <div style={{ width:1, background:T.border }} />
            <div style={{ flex:1 }}>
              <div style={{ ...LABEL, color:T.muted, fontSize:"9px", marginBottom:4 }}>FC · secondary</div>
              <div style={{ display:"flex", justifyContent:"space-between" }}>
                <span style={{ ...NUM, color:T.danger, fontSize:14, fontWeight:700 }}>{giveFc.toLocaleString()}</span>
                <span aria-hidden style={{ color:T.muted, opacity:0.5, fontSize:11 }}>→</span>
                <span style={{ ...NUM, color:T.success, fontSize:14, fontWeight:700 }}>{getFc.toLocaleString()}</span>
              </div>
              <div style={{ ...NUM, color:deltaFc >= 0 ? T.success : T.danger, fontSize:11, marginTop:2 }}>
                {deltaFc >= 0 ? "+" : ""}{deltaFc.toLocaleString()} pts
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Clear */}
      {(give.length > 0 || get.length > 0) && (
        <button onClick={() => { setGive([]); setGet([]); }} style={{
          marginTop:10, background:"transparent", border:`1px solid ${T.border}`,
          color:T.muted, borderRadius:RADIUS, padding:"0 14px", minHeight:44, fontSize:11,
          fontFamily:MONO, letterSpacing:"0.08em", cursor:"pointer",
        }}>Clear trade</button>
      )}
    </div>
  );
}
