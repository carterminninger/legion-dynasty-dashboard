/**
 * NavShell — consumer copy for legion-dynasty-dashboard.
 * Source of truth: ~/.claude/skills/design/references/components/app/NavShell.tsx
 * (2026-07-13). Adaptations: TS types + "use client" dropped; items navigate
 * via onSelect(key) callback rendered as <button> (this app's tabs are
 * component state, not routes — anatomy, sizes, and active treatment
 * unchanged); optional headerSlot renders above the sidebar items.
 */
import { GEORGIA, LABEL } from "./theme";
import { useMediaQuery } from "./hooks";

export function NavShell({ brand, brandSub, items, activeKey, onSelect, theme, children }) {
  const narrow = useMediaQuery("(max-width: 1023px)");
  return (
    <div style={{ minHeight: "100vh", background: theme.bg, color: theme.text }}>
      {!narrow && (
        <aside style={{ position: "fixed", top: 0, left: 0, bottom: 0, width: "240px", background: theme.surface, borderRight: `1px solid ${theme.border}`, padding: "20px 0", overflowY: "auto", zIndex: 100 }}>
          <div style={{ padding: "0 20px 20px", borderBottom: `1px solid ${theme.border}`, marginBottom: "12px" }}>
            <div style={{ fontFamily: GEORGIA, fontStyle: "italic", fontWeight: 700, fontSize: "17px", color: theme.warm }}>{brand}</div>
            {brandSub && <div style={{ ...LABEL, color: theme.muted, marginTop: "4px", fontSize: "10px" }}>{brandSub}</div>}
          </div>
          {items.map(it => {
            const active = it.key === activeKey;
            return (
              <button key={it.key} onClick={() => onSelect(it.key)} aria-current={active ? "page" : undefined} style={{
                display: "flex", alignItems: "center", gap: "10px", height: "44px", padding: "0 20px", width: "100%",
                fontSize: "13px", textAlign: "left", cursor: "pointer", border: "none",
                color: active ? theme.accent : theme.muted,
                background: active ? theme.surface : "transparent",
                borderLeft: `2px solid ${active ? theme.accent : "transparent"}`,
              }}>
                <span aria-hidden>{it.icon}</span> {it.label}
              </button>
            );
          })}
        </aside>
      )}
      <main style={{ marginLeft: narrow ? 0 : "240px", padding: narrow ? "16px" : "24px", paddingBottom: narrow ? "72px" : "24px" }}>
        {children}
      </main>
      {narrow && (
        <nav style={{ position: "fixed", bottom: 0, left: 0, right: 0, height: "56px", background: theme.bg, borderTop: `1px solid ${theme.border}`, display: "flex", zIndex: 100 }}>
          {items.slice(0, 5).map(it => {
            const active = it.key === activeKey;
            return (
              <button key={it.key} onClick={() => onSelect(it.key)} aria-current={active ? "page" : undefined} style={{
                flex: 1, minWidth: "44px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "2px",
                fontSize: "11px", border: "none", background: "transparent", cursor: "pointer",
                color: active ? theme.accent : theme.muted,
              }}>
                <span aria-hidden style={{ fontSize: "16px" }}>{it.icon}</span>{it.label}
              </button>
            );
          })}
        </nav>
      )}
    </div>
  );
}
