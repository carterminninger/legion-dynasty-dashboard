/**
 * KpiCard — consumer copy for legion-dynasty-dashboard.
 * Source of truth: ~/.claude/skills/design/references/components/app/KpiCard.tsx
 * (2026-07-13). Adaptations: TS types dropped; TopGlow inlined from
 * CardFrame.tsx (only piece of it this app needs); optional `sub` line added
 * (this product's KPIs carry context like "starters 24.1"). The `signature`
 * top-glow stays OFF everywhere in this build — the signature element is the
 * briefing sparkline (design-log no-repeat rule).
 */
import { LABEL, MONO, NUM } from "./theme";

function TopGlow({ accent }) {
  return (
    <div aria-hidden style={{
      position: "absolute", top: 0, left: "10%", right: "10%", height: "1px",
      background: `linear-gradient(90deg, transparent, ${accent}, transparent)`,
    }}/>
  );
}

export function KpiCard({ label, value, delta, deltaDirection, sub, signature = false, theme }) {
  const deltaColor = deltaDirection === "down" ? theme.danger : theme.success;
  return (
    <div style={{ position: "relative", background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: "12px", padding: "16px", flex: 1, minWidth: 90 }}>
      {signature && <TopGlow accent={theme.accent}/>}
      <div style={{ ...LABEL, color: theme.muted, marginBottom: "8px", fontSize: "10px" }}>{label}</div>
      <div style={{ ...NUM, fontSize: "24px", fontWeight: 800, color: theme.text, lineHeight: 1 }}>{value}</div>
      {delta && (
        <div style={{ ...NUM, fontFamily: MONO, fontSize: "11px", color: deltaColor, marginTop: "8px" }}>
          {deltaDirection === "down" ? "▼" : "▲"} {delta}
        </div>
      )}
      {sub && !delta && (
        <div style={{ fontFamily: MONO, fontSize: "10px", color: theme.muted, opacity: 0.7, marginTop: "8px" }}>{sub}</div>
      )}
    </div>
  );
}
