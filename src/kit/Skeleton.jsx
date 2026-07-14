/**
 * Skeleton — consumer copy for legion-dynasty-dashboard.
 * Source of truth: ~/.claude/skills/design/references/components/app/Skeleton.tsx
 * (2026-07-13). Adaptations: TS types + "use client" dropped.
 */
import { useReducedMotion } from "./hooks";

export function Skeleton({ width = "100%", height = "16px", radius = "8px", style }) {
  const reduced = useReducedMotion();
  return (
    <>
      <style>{`@keyframes kit-shimmer{from{background-position:200% 0}to{background-position:-200% 0}}`}</style>
      <div aria-hidden style={{
        width, height, borderRadius: radius,
        background: reduced
          ? "rgba(255,255,255,0.06)"
          : "linear-gradient(90deg, rgba(255,255,255,0.06) 40%, rgba(255,255,255,0.12) 50%, rgba(255,255,255,0.06) 60%)",
        backgroundSize: "200% 100%",
        animation: reduced ? "none" : "kit-shimmer 1.4s linear infinite",
        ...style,
      }}/>
    </>
  );
}
