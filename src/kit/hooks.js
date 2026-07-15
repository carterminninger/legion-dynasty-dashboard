/**
 * Kit hooks — consumer copy for legion-dynasty-dashboard.
 * Source of truth: ~/.claude/skills/design/references/components/hooks.ts
 * (2026-07-14, useSyncExternalStore revision). Adaptations: TS types +
 * "use client" dropped; only the media-query hooks ported (scroll/velocity
 * hooks are landing-mode, n/a here).
 */
import { useSyncExternalStore } from "react";

// useSyncExternalStore is the architecturally correct form for media-query
// subscriptions: no setState-in-effect, no init double-render.
export function useMediaQuery(query) {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false
  );
}

export function useReducedMotion() {
  return useMediaQuery("(prefers-reduced-motion: reduce)");
}
