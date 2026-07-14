/**
 * Kit hooks — consumer copy for legion-dynasty-dashboard.
 * Source of truth: ~/.claude/skills/design/references/components/hooks.ts
 * (2026-07-13). Adaptations: TS types + "use client" dropped; only
 * useReducedMotion ported (scroll/velocity hooks are landing-mode, n/a here).
 */
import { useEffect, useState } from "react";

export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = (e) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}
