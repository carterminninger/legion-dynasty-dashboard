import { cosmicApp as T, LABEL } from "../kit/theme";

function lastName(name) { return name.split(" ").slice(-1)[0]; }

function analyzeNeeds(roster) {
  const starters = roster.filter(p => p.slot === "STARTER");
  const ir       = roster.filter(p => p.slot === "IR");
  const needs    = [];

  // QB
  const qbs = starters.filter(p => p.pos === "QB").sort((a,b) => (b.ktc||0) - (a.ktc||0));
  needs.push({
    pos:"QB",
    icon:"✅",
    text: qbs.length >= 2
      ? `QB — ${qbs.map(q => lastName(q.name)).join(" + ")}, strong SF stack`
      : qbs.length === 1
      ? `QB — ${qbs[0].name} starting, need QB depth`
      : `QB — no starters`,
  });

  // RB
  const rbStarters = starters.filter(p => p.pos === "RB").sort((a,b) => (b.ktc||0) - (a.ktc||0));
  const rbDrop = rbStarters.length >= 2
    ? ((rbStarters[0].ktc||0) - (rbStarters[1].ktc||0)) / (rbStarters[0].ktc || 1)
    : 0;
  needs.push({
    pos:"RB",
    icon: rbStarters.length >= 3 ? "✅" : rbStarters.length >= 2 ? "✅" : "⚠",
    text: `RB — ${rbStarters.map(p => lastName(p.name)).join(" + ") || "none"} (drop-off: ${Math.round(rbDrop*100)}% RB1→RB2)`,
  });

  // WR
  const wrsOnIr   = ir.filter(p => p.pos === "WR");
  const wrStarters = starters.filter(p => p.pos === "WR").sort((a,b) => (b.ktc||0) - (a.ktc||0));
  const wrDrop     = wrStarters.length >= 2
    ? ((wrStarters[0].ktc||0) - (wrStarters[1].ktc||0)) / (wrStarters[0].ktc || 1)
    : 0;
  const wrIcon = wrsOnIr.length > 0 ? "⚠" : wrDrop > 0.4 ? "⚠" : "✅";
  needs.push({
    pos:"WR",
    icon: wrIcon,
    text: wrsOnIr.length > 0
      ? `WR — ${wrsOnIr.map(p => p.name).join(", ")} on IR, ${wrStarters[0]?.name || "?"} is acting WR1`
      : `WR — ${wrStarters.map(p => lastName(p.name)).join(" + ")}, ${Math.round(wrDrop*100)}% drop to WR3`,
  });

  // TE
  const teStarters = starters.filter(p => p.pos === "TE").sort((a,b) => (b.ktc||0) - (a.ktc||0));
  const teTaxi     = roster.filter(p => p.pos === "TE" && p.slot === "TAXI");
  needs.push({
    pos:"TE",
    icon:"🔵",
    text: teStarters.length > 0
      ? `TE — ${teStarters.map(p => lastName(p.name)).join(" + ")} starting${teTaxi.length > 0 ? `, ${teTaxi.map(p => lastName(p.name)).join("/")} on taxi` : ""}. Positional strength.`
      : `TE — no starters, needs upgrade`,
  });

  return needs;
}

export default function NeedsAnalysis({ roster }) {
  const needs = analyzeNeeds(roster);

  return (
    <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:12, padding:"14px 16px", marginBottom:12 }}>
      <div style={{ ...LABEL, color:T.muted, fontSize:"10px", marginBottom:10 }}>Needs analysis</div>
      <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
        {needs.map(n => (
          <div key={n.pos} style={{ display:"flex", gap:8, alignItems:"flex-start" }}>
            <span aria-hidden style={{ fontSize:14, lineHeight:1.4 }}>{n.icon}</span>
            <span style={{ color:T.muted, fontSize:13, lineHeight:1.5 }}>{n.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
