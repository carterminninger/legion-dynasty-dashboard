import { ROSTER } from "../data/roster";

function analyzeNeeds() {
  const starters = ROSTER.filter(p => p.slot === "STARTER");
  const ir       = ROSTER.filter(p => p.slot === "IR");
  const needs    = [];

  // QB
  const qbs = starters.filter(p => p.pos === "QB").sort((a,b) => b.ktc - a.ktc);
  needs.push({
    pos:"QB",
    icon:"✅",
    text:`QB — Williams + Lawrence, strong SF stack (${qbs.map(q=>q.name.split(" ")[1]).join(" + ")})`,
  });

  // RB
  const rbs = starters.filter(p => p.pos === "RB" || (p.slot === "STARTER" && p.pos === "RB")).sort((a,b) => b.ktc - a.ktc);
  const topRb = ROSTER.filter(p => p.pos === "RB" && p.slot === "STARTER").sort((a,b) => b.ktc - a.ktc);
  const rbDrop = topRb.length >= 2 ? ((topRb[0].ktc - topRb[1].ktc) / topRb[0].ktc) : 0;
  needs.push({
    pos:"RB",
    icon:"✅",
    text:`RB — elite depth, Bijan + Hampton + Price (drop-off: ${Math.round(rbDrop*100)}% from RB1→RB2)`,
  });

  // WR
  const wrsOnIr = ir.filter(p => p.pos === "WR");
  const wrStarters = ROSTER.filter(p => p.pos === "WR" && p.slot === "STARTER").sort((a,b) => b.ktc - a.ktc);
  const wrDrop = wrStarters.length >= 2 ? ((wrStarters[0].ktc - wrStarters[1].ktc) / wrStarters[0].ktc) : 0;
  const wrIcon = wrsOnIr.length > 0 ? "⚠" : wrDrop > 0.4 ? "⚠" : "✅";
  const irNames = wrsOnIr.map(p => p.name).join(", ");
  needs.push({
    pos:"WR",
    icon: wrIcon,
    text: wrsOnIr.length > 0
      ? `WR — ${irNames} on IR, McMillan is acting WR1, depth thins after BT`
      : `WR — McMillan + Brian Thomas starting, ${Math.round(wrDrop*100)}% drop to WR3`,
  });

  // TE
  const teStarters = ROSTER.filter(p => p.pos === "TE" && p.slot === "STARTER").sort((a,b) => b.ktc - a.ktc);
  needs.push({
    pos:"TE",
    icon:"🔵",
    text:`TE — Fannin is TE5 upside, Sinnott on taxi. Positional strength.`,
  });

  return needs;
}

export default function NeedsAnalysis() {
  const needs = analyzeNeeds();
  const iconColor = { "✅":"#10b981", "⚠":"#f59e0b", "🔵":"#60a5fa" };

  return (
    <div style={{ background:"#0a1525", border:"1px solid #1a2d40", borderRadius:10, padding:"14px 16px", marginBottom:12 }}>
      <div style={{ color:"#60a5fa", fontSize:9, fontFamily:"'Space Mono',monospace", letterSpacing:"0.18em", marginBottom:10 }}>NEEDS ANALYSIS</div>
      <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
        {needs.map(n => (
          <div key={n.pos} style={{ display:"flex", gap:8, alignItems:"flex-start" }}>
            <span style={{ fontSize:14, lineHeight:1.4 }}>{n.icon}</span>
            <span style={{ color:"#94a3b8", fontSize:12, fontFamily:"'DM Sans',sans-serif", lineHeight:1.5 }}>{n.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
