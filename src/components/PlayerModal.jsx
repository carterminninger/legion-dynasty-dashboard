import { useState, useEffect, useMemo } from "react";

const POS_COLORS  = { QB:"#f59e0b", RB:"#10b981", WR:"#3b82f6", TE:"#a855f7" };
const SLOT_COLORS = { STARTER:"#10b981", BENCH:"#475569", TAXI:"#f59e0b", IR:"#ef4444" };

function fmtHeight(inches) {
  if (!inches) return null;
  return `${Math.floor(inches / 12)}'${inches % 12}"`;
}

function PlayerHeadshot({ id, pos, size = 88 }) {
  const [error, setError] = useState(false);
  const c = POS_COLORS[pos] || "#475569";
  if (error || !id) {
    return (
      <div style={{
        width:size, height:size, borderRadius:10, flexShrink:0,
        background:c+"20", border:`2px solid ${c}40`,
        display:"flex", alignItems:"center", justifyContent:"center",
      }}>
        <span style={{ color:c, fontSize:22, fontFamily:"'Space Mono',monospace", fontWeight:700 }}>{pos}</span>
      </div>
    );
  }
  return (
    <img
      src={`https://sleepercdn.com/content/nfl/players/thumb/${id}.jpg`}
      alt=""
      onError={() => setError(true)}
      style={{ width:size, height:size, borderRadius:10, objectFit:"cover", flexShrink:0, border:`2px solid ${c}40` }}
    />
  );
}

function KtcSparkline({ playerName }) {
  const history = useMemo(() => {
    const keys = Object.keys(localStorage)
      .filter(k => k.startsWith("ktc_snapshot_"))
      .sort();
    return keys
      .map(key => {
        try {
          const snap = JSON.parse(localStorage.getItem(key) || "{}");
          const val  = snap.players?.[playerName];
          return val != null ? { date: snap.date || key.replace("ktc_snapshot_", ""), value: val } : null;
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  }, [playerName]);

  if (history.length < 3) {
    return (
      <div style={{ background:"#060d16", border:"1px solid #1a2d40", borderRadius:8, padding:"10px 12px", marginTop:12 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
          <span style={{ color:"#c084fc", fontSize:9, fontFamily:"'Space Mono',monospace", letterSpacing:"0.15em" }}>KTC HISTORY</span>
          <span style={{ color:"#1e3a5f", fontSize:9, fontFamily:"'Space Mono',monospace" }}>{history.length} / 3 DAYS</span>
        </div>
        <div style={{ color:"#334155", fontSize:10, fontFamily:"'Space Mono',monospace", letterSpacing:"0.08em" }}>BUILDING HISTORY...</div>
      </div>
    );
  }

  const values = history.map(d => d.value);
  const min    = Math.min(...values);
  const max    = Math.max(...values);
  const range  = max - min || 1;

  const W = 320, H = 44, PAD = 4;
  const pts = history.map((d, i) => {
    const x = PAD + (i / (history.length - 1)) * (W - PAD * 2);
    const y = H - PAD - ((d.value - min) / range) * (H - PAD * 2);
    return { x, y, value: d.value, date: d.date };
  });

  const latest  = values[values.length - 1];
  const oldest  = values[0];
  const delta   = latest - oldest;
  const trendColor = delta > 0 ? "#10b981" : delta < 0 ? "#ef4444" : "#475569";
  const polyline = pts.map(p => `${p.x},${p.y}`).join(" ");

  return (
    <div style={{ background:"#060d16", border:"1px solid #1a2d40", borderRadius:8, padding:"10px 12px", marginTop:12 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
        <span style={{ color:"#c084fc", fontSize:9, fontFamily:"'Space Mono',monospace", letterSpacing:"0.15em" }}>KTC HISTORY</span>
        <span style={{ color: trendColor, fontSize:10, fontFamily:"'Space Mono',monospace" }}>
          {delta > 0 ? "+" : ""}{delta.toLocaleString()} · {history.length}d
        </span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width:"100%", height:H, display:"block", overflow:"visible" }}
        preserveAspectRatio="none"
      >
        {/* Area fill */}
        <defs>
          <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={trendColor} stopOpacity="0.18" />
            <stop offset="100%" stopColor={trendColor} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon
          points={`${pts[0].x},${H} ${polyline} ${pts[pts.length-1].x},${H}`}
          fill="url(#sparkGrad)"
        />
        {/* Line */}
        <polyline
          points={polyline}
          fill="none"
          stroke={trendColor}
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {/* Dots */}
        {pts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={2.5} fill={trendColor} />
        ))}
      </svg>
      <div style={{ display:"flex", justifyContent:"space-between", marginTop:2 }}>
        <span style={{ color:"#1e3a5f", fontSize:9, fontFamily:"'Space Mono',monospace" }}>{history[0].date}</span>
        <span style={{ color:"#1e3a5f", fontSize:9, fontFamily:"'Space Mono',monospace" }}>{history[history.length - 1].date}</span>
      </div>
    </div>
  );
}

function CombineStats({ combine }) {
  if (!combine) return null;
  const stats = [
    { label:"40 YD",  value: combine.forty      != null ? `${combine.forty}s`    : null },
    { label:"BENCH",  value: combine.bench       != null ? `${combine.bench} rp`  : null },
    { label:"VERT",   value: combine.vertical    != null ? `${combine.vertical}"` : null },
    { label:"BROAD",  value: combine.broad_jump  != null ? `${combine.broad_jump}"`  : null },
    { label:"CONE",   value: combine.three_cone  != null ? `${combine.three_cone}s` : null },
    { label:"SHUTTLE",value: combine.shuttle     != null ? `${combine.shuttle}s`  : null },
  ].filter(s => s.value !== null);

  if (!stats.length) return null;

  return (
    <div style={{ background:"#060d16", border:"1px solid #1a2d40", borderRadius:8, padding:"10px 12px", marginTop:12 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
        <span style={{ color:"#60a5fa", fontSize:9, fontFamily:"'Space Mono',monospace", letterSpacing:"0.15em" }}>COMBINE</span>
        {combine.season && (
          <span style={{ color:"#1e3a5f", fontSize:9, fontFamily:"'Space Mono',monospace" }}>{combine.season}</span>
        )}
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"6px 16px" }}>
        {stats.map(s => (
          <div key={s.label} style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline" }}>
            <span style={{ color:"#475569", fontSize:9, fontFamily:"'Space Mono',monospace", letterSpacing:"0.08em" }}>{s.label}</span>
            <span style={{ color:"#e2e8f0", fontSize:12, fontFamily:"'Space Mono',monospace", fontWeight:700 }}>{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PlayerModal({ player, fcData, ktcLive, combineData, onClose }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  if (!player) return null;

  const fc = fcData?.find(p => p.player?.name === player.name);
  const fcValue   = fc?.value ?? null;
  const fcRank    = fc?.overallRank ?? null;
  const posColor  = POS_COLORS[player.pos] || "#64748b";
  const slotColor = SLOT_COLORS[player.slot] || "#475569";
  const ageColor  = player.age <= 22 ? "#10b981" : player.age <= 24 ? "#3b82f6" : player.age <= 26 ? "#f59e0b" : "#ef4444";

  const combine    = combineData?.players?.[player.name] ?? null;
  const liveKtc    = ktcLive?.players?.[player.name];
  const ktcValue   = liveKtc?.sf_value ?? player.ktc ?? 0;
  const ktcRankLbl = liveKtc
    ? `${player.pos}${liveKtc.sf_pos_rank} · #${liveKtc.sf_rank} overall`
    : player.ktcRank;
  const trend  = liveKtc?.sf_trend_7d ?? 0;
  const isLive = !!liveKtc;

  const maxVal = 10000;
  const ktcPct = Math.round((ktcValue / maxVal) * 100);
  const fcPct  = fcValue ? Math.round((fcValue / maxVal) * 100) : 0;

  return (
    <div
      onClick={onClose}
      style={{
        position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", zIndex:1000,
        display:"flex", alignItems:"center", justifyContent:"center", padding:16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background:"#0a1525", border:"1px solid #1a2d40", borderRadius:12,
          padding:24, width:"100%", maxWidth:400, position:"relative",
          maxHeight:"90vh", overflowY:"auto",
        }}
      >
        {/* Close */}
        <button onClick={onClose} style={{
          position:"absolute", top:12, right:12, background:"transparent",
          border:"none", color:"#334155", fontSize:18, cursor:"pointer", lineHeight:1,
        }}>✕</button>

        {/* Header */}
        <div style={{ display:"flex", alignItems:"flex-start", gap:12, marginBottom:16 }}>
          <PlayerHeadshot id={player.id} pos={player.pos} size={88} />
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6, flexWrap:"wrap" }}>
              <span style={{
                background: posColor+"20", color: posColor, border:`1px solid ${posColor}50`,
                borderRadius:4, padding:"3px 8px", fontSize:12,
                fontFamily:"'Space Mono',monospace", fontWeight:700,
              }}>{player.pos}</span>
            </div>
            <div style={{ color:"#f1f5f9", fontSize:20, fontFamily:"'Bebas Neue',cursive", letterSpacing:"0.04em", lineHeight:1.1 }}>{player.name}</div>
            <div style={{ color:"#334155", fontSize:11, fontFamily:"'Space Mono',monospace", marginTop:4 }}>
              {player.team} · <span style={{ color: ageColor }}>Age {player.age}</span>
            </div>
            {(player.height || player.weight) && (
              <div style={{ color:"#475569", fontSize:10, fontFamily:"'Space Mono',monospace", marginTop:2 }}>
                {fmtHeight(player.height)}{player.height && player.weight ? " · " : ""}{player.weight ? `${player.weight} lbs` : ""}
                {combine?.forty != null && <span style={{ color:"#f59e0b", marginLeft:6 }}>⚡{combine.forty}s</span>}
              </div>
            )}
          </div>
        </div>

        {/* Slot */}
        <div style={{ marginBottom:14 }}>
          <span style={{
            background: slotColor+"18", color: slotColor, border:`1px solid ${slotColor}40`,
            borderRadius:4, padding:"2px 8px", fontSize:10,
            fontFamily:"'Space Mono',monospace", fontWeight:700,
          }}>{player.slot}</span>
        </div>

        {/* Values */}
        <div style={{ display:"flex", gap:10, marginBottom:16 }}>
          <div style={{ flex:1, background:"#060d16", border:"1px solid #1a2d40", borderRadius:8, padding:"10px 12px" }}>
            <div style={{ display:"flex", alignItems:"center", gap:5, marginBottom:4 }}>
              <span style={{ color:"#c084fc", fontSize:9, fontFamily:"'Space Mono',monospace", letterSpacing:"0.15em" }}>KTC VALUE</span>
              {isLive && <span style={{ background:"#10b98120", color:"#10b981", border:"1px solid #10b98140", borderRadius:3, padding:"0px 4px", fontSize:8, fontFamily:"'Space Mono',monospace" }}>LIVE</span>}
            </div>
            <div style={{ color:"#f1f5f9", fontSize:26, fontFamily:"'Bebas Neue',cursive" }}>
              {ktcValue.toLocaleString()}
              {trend !== 0 && <span style={{ color: trend > 0 ? "#10b981" : "#ef4444", fontSize:12, marginLeft:4 }}>{trend > 0 ? "▲" : "▼"}{Math.abs(trend)}</span>}
            </div>
            <div style={{ color:"#334155", fontSize:10, fontFamily:"'Space Mono',monospace" }}>{ktcRankLbl}</div>
          </div>
          <div style={{ flex:1, background:"#060d16", border:"1px solid #1a2d40", borderRadius:8, padding:"10px 12px" }}>
            <div style={{ color:"#60a5fa", fontSize:9, fontFamily:"'Space Mono',monospace", letterSpacing:"0.15em", marginBottom:4 }}>FC VALUE</div>
            <div style={{ color:"#f1f5f9", fontSize:26, fontFamily:"'Bebas Neue',cursive" }}>
              {fcValue !== null ? fcValue.toLocaleString() : "—"}
            </div>
            <div style={{ color:"#334155", fontSize:10, fontFamily:"'Space Mono',monospace" }}>
              {fcRank !== null ? `RANK #${fcRank}` : "loading"}
            </div>
          </div>
        </div>

        {/* Value bars */}
        <div style={{ marginBottom:16 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
            <div style={{ color:"#c084fc", fontSize:9, fontFamily:"'Space Mono',monospace", width:28 }}>KTC</div>
            <div style={{ flex:1, background:"#060d16", borderRadius:3, height:6 }}>
              <div style={{ width:`${ktcPct}%`, background:"#c084fc", borderRadius:3, height:"100%" }} />
            </div>
            <div style={{ color:"#c084fc", fontSize:9, fontFamily:"'Space Mono',monospace", width:32, textAlign:"right" }}>{ktcPct}%</div>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <div style={{ color:"#60a5fa", fontSize:9, fontFamily:"'Space Mono',monospace", width:28 }}>FC</div>
            <div style={{ flex:1, background:"#060d16", borderRadius:3, height:6 }}>
              <div style={{ width:`${fcPct}%`, background:"#60a5fa", borderRadius:3, height:"100%" }} />
            </div>
            <div style={{ color:"#60a5fa", fontSize:9, fontFamily:"'Space Mono',monospace", width:32, textAlign:"right" }}>{fcPct}%</div>
          </div>
        </div>

        {/* Trade value line */}
        <div style={{ background:"#060d16", border:"1px solid #1a2d40", borderRadius:6, padding:"8px 12px" }}>
          <div style={{ color:"#334155", fontSize:9, fontFamily:"'Space Mono',monospace", letterSpacing:"0.1em", marginBottom:2 }}>TRADE VALUE (KTC)</div>
          <div style={{ color:"#e2e8f0", fontSize:13, fontFamily:"'DM Sans',sans-serif" }}>
            {ktcRankLbl} · {ktcValue.toLocaleString()} pts
          </div>
        </div>

        {/* Combine athletic data */}
        <CombineStats combine={combine} />

        {/* KTC value history sparkline */}
        <KtcSparkline playerName={player.name} />
      </div>
    </div>
  );
}
