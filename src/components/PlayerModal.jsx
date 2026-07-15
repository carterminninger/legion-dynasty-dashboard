import { useState, useMemo } from "react";
import { cosmicApp as T, LABEL, NUM, MONO, GEORGIA } from "../kit/theme";
import { posColors, slotColors } from "../kit/tokens";
import { useFocusTrap } from "../kit/useFocusTrap";

function fmtHeight(inches) {
  if (!inches) return null;
  return `${Math.floor(inches / 12)}'${inches % 12}"`;
}

function PlayerHeadshot({ id, pos, size = 88 }) {
  const [error, setError] = useState(false);
  const c = posColors[pos] || "#64748b";
  if (error || !id) {
    return (
      <div style={{
        width:size, height:size, borderRadius:10, flexShrink:0,
        background:c+"20", border:`2px solid ${c}40`,
        display:"flex", alignItems:"center", justifyContent:"center",
      }}>
        <span style={{ color:c, fontSize:22, fontFamily:MONO, fontWeight:700 }}>{pos}</span>
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
      <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:8, padding:"10px 12px", marginTop:12 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
          <span style={{ ...LABEL, color:T.muted, fontSize:"9px" }}>KTC history</span>
          <span style={{ ...NUM, color:T.muted, opacity:0.7, fontSize:9 }}>{history.length} / 3 days</span>
        </div>
        <div style={{ fontFamily:GEORGIA, fontStyle:"italic", color:T.muted, fontSize:12 }}>History builds daily — the chart appears at three days.</div>
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
  const trendColor = delta > 0 ? T.success : delta < 0 ? T.danger : T.muted;
  const polyline = pts.map(p => `${p.x},${p.y}`).join(" ");

  return (
    <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:8, padding:"10px 12px", marginTop:12 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
        <span style={{ ...LABEL, color:T.muted, fontSize:"9px" }}>KTC history</span>
        <span style={{ ...NUM, color: trendColor, fontSize:10 }}>
          {delta > 0 ? "+" : ""}{delta.toLocaleString()} · {history.length}d
        </span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img" aria-label={`${playerName} KTC value over ${history.length} days`}
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
        <span style={{ ...NUM, color:T.muted, opacity:0.6, fontSize:9 }}>{history[0].date}</span>
        <span style={{ ...NUM, color:T.muted, opacity:0.6, fontSize:9 }}>{history[history.length - 1].date}</span>
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
    <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:8, padding:"10px 12px", marginTop:12 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
        <span style={{ ...LABEL, color:T.muted, fontSize:"9px" }}>Combine</span>
        {combine.season && (
          <span style={{ ...NUM, color:T.muted, opacity:0.6, fontSize:9 }}>{combine.season}</span>
        )}
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"6px 16px" }}>
        {stats.map(s => (
          <div key={s.label} style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline" }}>
            <span style={{ ...NUM, color:T.muted, opacity:0.7, fontSize:9, letterSpacing:"0.08em" }}>{s.label}</span>
            <span style={{ ...NUM, color:T.text, fontSize:12, fontWeight:700 }}>{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const DD_TIER_COLORS = {
  S: "#f59e0b",  // gold
  A: "#10b981",  // green
  B: "#3b82f6",  // blue
  C: "#eab308",  // yellow
  D: "#ef4444",  // red
};

const DD_CATEGORY_COLORS = {
  "Cornerstone":    "#c084fc",
  "Foundational":   "#60a5fa",
  "Upside Premier": "#34d399",
};

function DynastyDomainCard({ data, playerName }) {
  const entry = data?.players?.[playerName];
  if (!entry) return null;

  const tierColor     = DD_TIER_COLORS[entry.tier]          || T.muted;
  const categoryColor = DD_CATEGORY_COLORS[entry.category]  || T.muted;
  const snippet = entry.context?.length > 110
    ? entry.context.slice(0, 110) + "…"
    : entry.context;

  return (
    <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:8, padding:"10px 12px", marginTop:12 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:7 }}>
        <span style={{ ...LABEL, color:T.muted, fontSize:"9px" }}>Dynasty Domain</span>
        <span style={{
          background: tierColor+"20", color: tierColor, border:`1px solid ${tierColor}40`,
          borderRadius:4, padding:"1px 7px", fontSize:11,
          fontFamily:MONO, fontWeight:700,
        }}>{entry.tier}</span>
      </div>
      <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:6 }}>
        <span style={{ color: categoryColor, fontSize:12, fontFamily:MONO, fontWeight:700, letterSpacing:"0.06em" }}>
          {entry.category.toUpperCase()}
        </span>
        {entry.depreciating_pillar && (
          <span style={{
            background:T.danger+"18", color:T.danger, border:`1px solid ${T.danger}40`,
            borderRadius:4, padding:"1px 5px", fontSize:8,
            fontFamily:MONO, fontWeight:700, letterSpacing:"0.05em",
          }}>DEPRECIATING</span>
        )}
      </div>
      {snippet && (
        <div style={{ color:T.muted, fontSize:11, lineHeight:1.5, marginBottom:6 }}>
          {snippet}
        </div>
      )}
      <div style={{ ...NUM, color:T.muted, opacity:0.6, fontSize:9 }}>
        {entry.source_date && `${entry.source_date} · `}{entry.source_video}
      </div>
    </div>
  );
}

export default function PlayerModal({ player, fcData, ktcLive, combineData, dynastyDomain, onClose }) {
  // Focus trap owns Escape too — replaces the old window-level listener
  const trapRef = useFocusTrap(onClose);

  if (!player) return null;

  const fc = fcData?.find(p => p.player?.name === player.name);
  const fcValue   = fc?.value ?? null;
  const fcRank    = fc?.overallRank ?? null;
  const posColor  = posColors[player.pos] || "#64748b";
  const slotColor = slotColors[player.slot] || T.muted;
  const ageColor  = player.age <= 23 ? T.accent : player.age >= 27 ? T.warm : T.muted;

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
      role="dialog" aria-modal="true" aria-label={`${player.name} details`}
      style={{
        position:"fixed", inset:0, background:"rgba(0,0,0,0.72)", zIndex:1000,
        display:"flex", alignItems:"center", justifyContent:"center", padding:16,
      }}
    >
      <div
        ref={trapRef}
        tabIndex={-1}
        onClick={e => e.stopPropagation()}
        style={{
          background:"#070b14", border:`1px solid ${T.border}`, borderRadius:12,
          padding:24, width:"100%", maxWidth:400, position:"relative",
          maxHeight:"90vh", overflowY:"auto",
        }}
      >
        {/* Close — 44px tap zone */}
        <button onClick={onClose} aria-label="Close player details" style={{
          position:"absolute", top:0, right:0, width:44, height:44, background:"transparent",
          border:"none", color:T.muted, fontSize:18, cursor:"pointer", lineHeight:1,
        }}>✕</button>

        {/* Header */}
        <div style={{ display:"flex", alignItems:"flex-start", gap:12, marginBottom:16 }}>
          <PlayerHeadshot id={player.id} pos={player.pos} size={88} />
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6, flexWrap:"wrap" }}>
              <span style={{
                background: posColor+"20", color: posColor, border:`1px solid ${posColor}50`,
                borderRadius:4, padding:"3px 8px", fontSize:12,
                fontFamily:MONO, fontWeight:700,
              }}>{player.pos}</span>
            </div>
            <div style={{ color:T.text, fontSize:20, fontFamily:GEORGIA, fontStyle:"italic", fontWeight:700, lineHeight:1.1 }}>{player.name}</div>
            <div style={{ ...NUM, color:T.muted, fontSize:11, marginTop:4 }}>
              {player.team} · <span style={{ color: ageColor }}>Age {player.age}</span>
            </div>
            {(player.height || player.weight) && (
              <div style={{ ...NUM, color:T.muted, opacity:0.75, fontSize:10, marginTop:2 }}>
                {fmtHeight(player.height)}{player.height && player.weight ? " · " : ""}{player.weight ? `${player.weight} lbs` : ""}
                {combine?.forty != null && <span style={{ color:T.warm, marginLeft:6 }}>⚡{combine.forty}s</span>}
              </div>
            )}
          </div>
        </div>

        {/* Slot */}
        <div style={{ marginBottom:14 }}>
          <span style={{
            background: slotColor+"18", color: slotColor, border:`1px solid ${slotColor}40`,
            borderRadius:4, padding:"2px 8px", fontSize:10,
            fontFamily:MONO, fontWeight:700,
          }}>{player.slot}</span>
        </div>

        {/* Values */}
        <div style={{ display:"flex", gap:10, marginBottom:16 }}>
          <div style={{ flex:1, background:T.surface, border:`1px solid ${T.border}`, borderRadius:8, padding:"10px 12px" }}>
            <div style={{ display:"flex", alignItems:"center", gap:5, marginBottom:4 }}>
              <span style={{ ...LABEL, color:T.muted, fontSize:"9px" }}>KTC value</span>
              {isLive && <span style={{ background:"rgba(0,229,255,0.12)", color:T.accent, border:`1px solid rgba(0,229,255,0.35)`, borderRadius:3, padding:"0px 4px", fontSize:8, fontFamily:MONO }}>LIVE</span>}
            </div>
            <div style={{ ...NUM, color:T.text, fontSize:24, fontWeight:800 }}>
              {ktcValue.toLocaleString()}
              {trend !== 0 && <span style={{ color: trend > 0 ? T.success : T.danger, fontSize:12, marginLeft:4 }}>{trend > 0 ? "▲" : "▼"}{Math.abs(trend)}</span>}
            </div>
            <div style={{ ...NUM, color:T.muted, opacity:0.75, fontSize:10 }}>{ktcRankLbl}</div>
          </div>
          <div style={{ flex:1, background:T.surface, border:`1px solid ${T.border}`, borderRadius:8, padding:"10px 12px" }}>
            <div style={{ ...LABEL, color:T.muted, fontSize:"9px", marginBottom:4 }}>FC value</div>
            <div style={{ ...NUM, color:T.text, fontSize:24, fontWeight:800 }}>
              {fcValue !== null ? fcValue.toLocaleString() : "—"}
            </div>
            <div style={{ ...NUM, color:T.muted, opacity:0.75, fontSize:10 }}>
              {fcRank !== null ? `Rank #${fcRank}` : "loading"}
            </div>
          </div>
        </div>

        {/* Value bars */}
        <div style={{ marginBottom:16 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
            <div style={{ ...NUM, color:T.muted, fontSize:9, width:28 }}>KTC</div>
            <div style={{ flex:1, background:"rgba(255,255,255,0.06)", borderRadius:3, height:6 }}>
              <div style={{ width:`${ktcPct}%`, background:T.accent, borderRadius:3, height:"100%" }} />
            </div>
            <div style={{ ...NUM, color:T.muted, fontSize:9, width:32, textAlign:"right" }}>{ktcPct}%</div>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <div style={{ ...NUM, color:T.muted, fontSize:9, width:28 }}>FC</div>
            <div style={{ flex:1, background:"rgba(255,255,255,0.06)", borderRadius:3, height:6 }}>
              <div style={{ width:`${fcPct}%`, background:"rgba(0,229,255,0.45)", borderRadius:3, height:"100%" }} />
            </div>
            <div style={{ ...NUM, color:T.muted, fontSize:9, width:32, textAlign:"right" }}>{fcPct}%</div>
          </div>
        </div>

        {/* Trade value line */}
        <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:6, padding:"8px 12px" }}>
          <div style={{ ...LABEL, color:T.muted, fontSize:"9px", marginBottom:2 }}>Trade value (KTC)</div>
          <div style={{ color:T.text, fontSize:13 }}>
            {ktcRankLbl} · {ktcValue.toLocaleString()} pts
          </div>
        </div>

        {/* Combine athletic data */}
        <CombineStats combine={combine} />

        {/* Dynasty Domain tier rating */}
        <DynastyDomainCard data={dynastyDomain} playerName={player.name} />

        {/* KTC value history sparkline */}
        <KtcSparkline playerName={player.name} />
      </div>
    </div>
  );
}
