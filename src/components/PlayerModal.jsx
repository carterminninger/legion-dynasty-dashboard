import { useEffect } from "react";

const POS_COLORS = { QB:"#f59e0b", RB:"#10b981", WR:"#3b82f6", TE:"#a855f7" };
const SLOT_COLORS = { STARTER:"#10b981", BENCH:"#475569", TAXI:"#f59e0b", IR:"#ef4444" };

export default function PlayerModal({ player, fcData, ktcLive, onClose }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  if (!player) return null;

  const fc = fcData?.find(p => p.player?.name === player.name);
  const fcValue  = fc?.value ?? null;
  const fcRank   = fc?.overallRank ?? null;
  const posColor  = POS_COLORS[player.pos] || "#64748b";
  const slotColor = SLOT_COLORS[player.slot] || "#475569";
  const ageColor  = player.age <= 22 ? "#10b981" : player.age <= 24 ? "#3b82f6" : player.age <= 26 ? "#f59e0b" : "#ef4444";

  const liveKtc   = ktcLive?.players?.[player.name];
  const ktcValue  = liveKtc?.sf_value ?? player.ktc;
  const ktcRankLbl = liveKtc
    ? `${player.pos}${liveKtc.sf_pos_rank} · #${liveKtc.sf_rank} overall`
    : player.ktcRank;
  const trend     = liveKtc?.sf_trend_7d ?? 0;
  const isLive    = !!liveKtc;

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
          padding:24, width:"100%", maxWidth:380, position:"relative",
        }}
      >
        {/* Close */}
        <button onClick={onClose} style={{
          position:"absolute", top:12, right:12, background:"transparent",
          border:"none", color:"#334155", fontSize:18, cursor:"pointer", lineHeight:1,
        }}>✕</button>

        {/* Header */}
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
          <span style={{
            background: posColor+"20", color: posColor, border:`1px solid ${posColor}50`,
            borderRadius:4, padding:"3px 8px", fontSize:12,
            fontFamily:"'Space Mono',monospace", fontWeight:700,
          }}>{player.pos}</span>
          <div>
            <div style={{ color:"#f1f5f9", fontSize:20, fontFamily:"'Bebas Neue',cursive", letterSpacing:"0.04em" }}>{player.name}</div>
            <div style={{ color:"#334155", fontSize:11, fontFamily:"'Space Mono',monospace" }}>{player.team} · <span style={{ color: ageColor }}>Age {player.age}</span></div>
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
      </div>
    </div>
  );
}
