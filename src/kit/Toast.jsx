/**
 * Toast — consumer copy for legion-dynasty-dashboard.
 * Source of truth: ~/.claude/skills/design/references/components/app/Toast.tsx
 * (2026-07-13, incl. the 44px dismiss tap-zone fix). Adaptations: TS types +
 * "use client" dropped; stack bottom offset 24px→72px so toasts clear the
 * 56px mobile bottom tab bar.
 */
import { useEffect, useRef, useState } from "react";
import { MONO } from "./theme";
import { useReducedMotion } from "./hooks";

const AUTO_DISMISS_MS = 5000;

function ToastCard({ item, onDismiss, theme }) {
  const reduced = useReducedMotion();
  const [entered, setEntered] = useState(false);
  const hover = useRef(false);
  // rAF defers the transition trigger past the effect's sync body — the
  // browser paints the pre-enter state first, so the slide-in is reliable
  useEffect(() => {
    const raf = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(raf);
  }, []);
  useEffect(() => {
    if (item.kind === "error") return; // errors persist until dismissed
    const started = Date.now();
    const t = setInterval(() => {
      if (!hover.current && Date.now() - started > AUTO_DISMISS_MS) onDismiss(item.id);
    }, 250);
    return () => clearInterval(t);
  }, [item.id, item.kind, onDismiss]);
  const color = { info: theme.accent, success: theme.success, error: theme.danger }[item.kind];
  return (
    <div role={item.kind === "error" ? "alert" : "status"}
      onMouseEnter={() => { hover.current = true; }} onMouseLeave={() => { hover.current = false; }}
      style={{
        display: "flex", alignItems: "center", gap: "12px",
        background: theme.bg, border: `1px solid ${theme.border}`, borderLeft: `3px solid ${color}`,
        borderRadius: "8px", padding: "12px 16px", fontSize: "13px", color: theme.text,
        backdropFilter: "blur(12px)", boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
        transform: reduced ? "none" : entered ? "translateY(0)" : "translateY(8px)",
        opacity: reduced ? 1 : entered ? 1 : 0,
        transition: reduced ? "none" : "all 0.25s ease",
      }}>
      <span style={{ flex: 1 }}>{item.text}</span>
      {item.actionLabel && <button onClick={item.onAction} style={{ fontFamily: MONO, fontSize: "11px", letterSpacing: "0.1em", textTransform: "uppercase", color, background: "none", border: "none", cursor: "pointer", minHeight: "24px" }}>{item.actionLabel}</button>}
      {/* 44px tap zone painted around the 14px glyph — layout box stays 14px so the card doesn't grow */}
      <span style={{ position: "relative", width: "14px", height: "14px", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <button onClick={() => onDismiss(item.id)} aria-label="Dismiss" style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: "44px", height: "44px", color: theme.muted, background: "none", border: "none", cursor: "pointer", fontSize: "14px", padding: 0 }}>✕</button>
      </span>
    </div>
  );
}

export function ToastStack({ items, onDismiss, theme }) {
  return (
    <div style={{ position: "fixed", bottom: "72px", right: "16px", display: "flex", flexDirection: "column", gap: "8px", zIndex: 300, maxWidth: "360px" }}>
      {items.slice(-3).map(t => <ToastCard key={t.id} item={t} onDismiss={onDismiss} theme={theme}/>)}
    </div>
  );
}
