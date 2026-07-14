import { cosmicApp as T, LABEL, NUM, GEORGIA } from "../kit/theme";
import { posColors } from "../kit/tokens";

function getSnapshots() {
  const keys = Object.keys(localStorage).filter(k => k.startsWith("fc_snapshot_")).sort();
  return keys.map(k => ({ date: k.replace("fc_snapshot_",""), ...JSON.parse(localStorage.getItem(k)) }));
}

function Sparkline({ values }) {
  if (!values || values.length < 2) return <span style={{ ...NUM, color:T.muted, opacity:0.5, fontSize:9 }}>—</span>;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  return (
    <div aria-hidden style={{ display:"inline-flex", gap:2, alignItems:"flex-end", height:16 }}>
      {values.map((v, i) => {
        const h = Math.max(2, Math.round(((v - min) / range) * 14));
        const isLast = i === values.length - 1;
        return (
          <div key={i} style={{
            width:4, height:h,
            background: isLast ? T.accent : "rgba(0,229,255,0.25)",
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
      <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:12, padding:"14px 16px", marginBottom:12 }}>
        <div style={{ ...LABEL, color:T.muted, fontSize:"10px", marginBottom:8 }}>Value movement</div>
        <div style={{ fontFamily:GEORGIA, fontStyle:"italic", color:T.muted, fontSize:13 }}>
          {snapshots.length < 1 ? "No snapshots yet — trends start tomorrow, after today's values are saved." : "One day saved — trends appear after two days of data."}
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

  return (
    <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:12, padding:"14px 16px", marginBottom:12 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
        <div style={{ ...LABEL, color:T.muted, fontSize:"10px" }}>Value movement</div>
        <div style={{ ...NUM, color:T.muted, opacity:0.7, fontSize:10 }}>vs {prevDate}</div>
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
        {movers.map(m => {
          const posColor = posColors[m.pos] || T.muted;
          const deltaColor = m.delta > 0 ? T.success : T.danger;
          const sign = m.delta > 0 ? "+" : "";
          return (
            <div key={m.name} style={{ display:"flex", alignItems:"center", gap:10 }}>
              <span style={{ ...NUM, color: posColor, fontSize:10, width:22 }}>{m.pos}</span>
              <span style={{ flex:1, color:T.text, fontSize:12 }}>{m.name}</span>
              <Sparkline values={m.history} />
              <span style={{ ...NUM, color: deltaColor, fontSize:11, minWidth:50, textAlign:"right" }}>
                {sign}{m.delta.toLocaleString()}
              </span>
            </div>
          );
        })}
        {movers.length === 0 && (
          <div style={{ fontFamily:GEORGIA, fontStyle:"italic", color:T.muted, fontSize:13 }}>No changes from {prevDate}.</div>
        )}
      </div>
    </div>
  );
}
