/**
 * App-mode theme — consumer copy for legion-dynasty-dashboard.
 * Source of truth: ~/.claude/skills/design/references/components/app/theme.ts
 * (2026-07-13). Adaptations: TS types dropped; maritimeApp omitted (this
 * product is cosmic); GEORGIA constant added (identity/emotional type role,
 * per the locked pairing rule).
 */
import { cosmic } from "./tokens";

export const cosmicApp = {
  bg: cosmic.bg,
  surface: cosmic.surface,
  border: cosmic.border,
  text: "#ffffff",
  muted: cosmic.mist,
  accent: cosmic.electric,
  warm: cosmic.ember,
  danger: cosmic.ember,
  success: cosmic.electric,
};

// Density scale (app-mode.md): 4px grid
export const SPACE = [4, 8, 12, 16, 24, 32];
export const CONTROL_H = 40;
export const RADIUS = 8;
export const MONO = "'Courier New',Courier,monospace";
export const GEORGIA = "Georgia,'Times New Roman',serif";
export const LABEL = { fontFamily: MONO, fontSize: "11px", letterSpacing: "0.15em", textTransform: "uppercase" };
export const NUM = { fontFamily: MONO, fontVariantNumeric: "tabular-nums" };
