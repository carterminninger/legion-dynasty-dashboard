/**
 * Design-system tokens — consumer copy for legion-dynasty-dashboard.
 * Source of truth: ~/.claude/skills/design/references/tokens.ts (2026-07-13).
 * Adaptations: TypeScript types dropped (Vite/JSX consumer); maritime palette
 * omitted (unused here); posColors added as this product's categorical
 * data-encoding palette (chart-style encodings, NOT UI accents — see
 * docs/design-revamp-plan.md "Tokens").
 */

export const cosmic = {
  bg:       "#02040a",
  electric: "#00e5ff",
  plasma:   "#7b2fff",
  ember:    "#ff6b35",
  mist:     "#a0c4d8",
  surface:  "rgba(255,255,255,0.035)",
  border:   "rgba(0,229,255,0.18)",
};

// Categorical data encodings (position + slot + verdict). Badge fills and
// data marks only — never body-text color on critical reading paths.
export const posColors  = { QB: "#f59e0b", RB: "#10b981", WR: "#3b82f6", TE: "#a855f7" };
export const slotColors = { STARTER: "#10b981", BENCH: "#64748b", TAXI: "#f59e0b", IR: "#ff6b35" };
