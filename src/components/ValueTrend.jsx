
function getSnapshots() {
  const keys = Object.keys(localStorage).filter(k => k.startsWith("fc_snapshot_")).sort();
  return keys.map(k => ({ date: k.replace("fc_snapshot_",""), ...JSON.parse(localStorage.getItem(k)) }));
}

function Sparkline({ values }) {
  if (!values || values.length < 2) return <span style={{ color:"#1e3a5f", fontSize:9, fontFamily:"'Space Mono',monospace" }}>—</span>;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  return (
    <div style={{ display:"inline-flex", gap:2, alignItems:"flex-end", height:16 }}>
      {values.map((v, i) => {
        const h = Math.max(2, Math.round(((v - min) / range) * 14));
        const isLast = i === values.length - 1;
        return (
          <div key={i} style={{
            width:4, height:h,
            background: isLast ? "#60a5fa" : "#1e3a5f",
            borderRadius:1,
          }} />
        );
      })}
    </div>
  );
}

export default function ValueTrend({ fcData, roster }) {
  const snapshots = getSnapshots();
  if (snapshots.length < 2 || !fcData) {
    return (
      <div style={{ background:"#0a1525", border:"1px solid #1a2d40", borderRadius:10, padding:"14px 16px", marginBottom:12 }}>
        <div style={{ color:"#60a5fa", fontSize:9, fontFamily:"'Space Mono',monospace", letterSpacing:"0.18em", marginBottom:8 }}>VALUE MOVEMENT</div>
        <div style={{ color:"#334155", fontSize:11, fontFamily:"'Space Mono',monospace" }}>
          {snapshots.length < 1 ? "No snapshots yet — check back tomorrow." : "Need 2+ days of data for trends."}
        </div>
      </div>
    );
  }

  const prev     = snapshots[snapshots.length - 2];
  const prevDate = prev.date;

  const movers = roster
    .map(p => {
      const today    = fcData.find(f => f.player?.name === p.name)?.value ?? null;
      const yesterday = prev.players?.[p.name]?.value ?? null;
      if (today === null || yesterday === null) return null;
      const delta = today - yesterday;
      const history = snapshots.map(s => s.players?.[p.name]?.value).filter(Boolean);
      return { name: p.name, pos: p.pos, today, yesterday, delta, history };
    })
    .filter(Boolean)
    .filter(m => m.delta !== 0)
    .sort((a,b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 8);

  const POS_COLORS = { QB:"#f59e0b", RB:"#10b981", WR:"#3b82f6", TE:"#a855f7" };

  return (
    <div style={{ background:"#0a1525", border:"1px solid #1a2d40", borderRadius:10, padding:"14px 16px", marginBottom:12 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
        <div style={{ color:"#60a5fa", fontSize:9, fontFamily:"'Space Mono',monospace", letterSpacing:"0.18em" }}>VALUE MOVEMENT</div>
        <div style={{ color:"#1e3a5f", fontSize:9, fontFamily:"'Space Mono',monospace" }}>vs {prevDate}</div>
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
        {movers.map(m => {
          const posColor = POS_COLORS[m.pos] || "#64748b";
          const deltaColor = m.delta > 0 ? "#10b981" : "#ef4444";
          const sign = m.delta > 0 ? "+" : "";
          return (
            <div key={m.name} style={{ display:"flex", alignItems:"center", gap:10 }}>
              <span style={{ color: posColor, fontSize:9, fontFamily:"'Space Mono',monospace", width:22 }}>{m.pos}</span>
              <span style={{ flex:1, color:"#94a3b8", fontSize:12, fontFamily:"'DM Sans',sans-serif" }}>{m.name}</span>
              <Sparkline values={m.history} />
              <span style={{ color: deltaColor, fontSize:11, fontFamily:"'Space Mono',monospace", minWidth:50, textAlign:"right" }}>
                {sign}{m.delta.toLocaleString()}
              </span>
            </div>
          );
        })}
        {movers.length === 0 && (
          <div style={{ color:"#334155", fontSize:11, fontFamily:"'Space Mono',monospace" }}>No changes from {prevDate}.</div>
        )}
      </div>
    </div>
  );
}
