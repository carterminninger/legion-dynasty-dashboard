/**
 * useFocusTrap — consumer copy for legion-dynasty-dashboard.
 * Source of truth: ~/.claude/skills/design/references/components/app/useFocusTrap.ts
 * (2026-07-14). Adaptations: TS types + "use client" dropped.
 * Mechanical check: design-kit-harness scripts/focus-trap.spec.mjs.
 */
import { useEffect, useRef } from "react";

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function useFocusTrap(onClose) {
  const ref = useRef(null);
  const closeRef = useRef(onClose);
  // ref updated in an effect, not during render (react-hooks/refs rule); a ref
  // (not a dep) so an inline onClose doesn't re-init the trap every render
  useEffect(() => { closeRef.current = onClose; }, [onClose]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const previous = document.activeElement;
    const focusables = () => Array.from(el.querySelectorAll(FOCUSABLE));
    (focusables()[0] ?? el).focus();

    const onKey = (e) => {
      if (e.key === "Escape") { closeRef.current?.(); return; }
      if (e.key !== "Tab") return;
      const f = focusables();
      if (!f.length) { e.preventDefault(); el.focus(); return; }
      const first = f[0], last = f[f.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === el)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && active === last)                { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      previous?.focus?.();
    };
  }, []);

  return ref;
}
