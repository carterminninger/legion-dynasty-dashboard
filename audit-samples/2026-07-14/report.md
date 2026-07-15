# Phase 4 audit — legion-dynasty-dashboard revamp, 2026-07-14

Mode: **app** (gate: app-mode.md, 11 points, floor 8). Captures: canonical `scripts/capture.mjs` (landing `local/`, team `local-team/`, both normal + `rm-` reduced-motion, 390/768/1440) plus `scripts/capture-views.mjs` per-tab evidence (`local-views/`). All capture runs exited **zero console errors**. Local server: `vite preview` — `/api/sleeper` (Vercel function) is absent locally, so the landing teams list shows its designed error state and trades shows its skeleton; both are real states, and the production re-capture after deploy covers the live-data paths.

## App-mode gate — 11/11

| # | Item | Verdict | Evidence |
|---|---|---|---|
| 1 | Keyboard navigable end to end | PASS | every interactive is a native `button`/`a`/`input`/`select` in visual order (NavShell buttons, DataTable `th` buttons, TeamCard is a `<button>`, filter chips, toasts). 2026-07-14 update: roster rows keyboard-activatable (Enter/Space) and PlayerModal has a full focus trap (kit `useFocusTrap`) — **mechanically verified**: `focus-trap.spec.mjs` 7/7 assertions (focus entry, 15-Tab containment, Shift-Tab wrap, Escape close, focus restored to triggering row). Former no-focus-trap caveat CLOSED |
| 2 | Visible focus ring everywhere | PASS | global `:focus-visible` 2px electric ring (src/index.css), inline focus outline on TradeCalc search inputs; no outline suppression anywhere |
| 3 | Loading state per async surface | PASS | local-views/trades-390.png (trades skeleton); DataTable skeleton rows; landing team-list skeletons; news + standings skeletons (code + local/top-390 pre-resolve) |
| 4 | Empty state per list/table | PASS | local/top-390.png (landing designed error state); DataTable designed empty ("No players match this filter"); sparkline sparse state "day 1 of 30" (local-team/top-390.png); ValueTrend day-0/1 sentences; trades fallback note |
| 5 | Error state designed + error toasts persist | PASS | validator failure pushes persistent error toast (kind:"error" never auto-dismisses); refresh failure toast says what failed and what to do; validator report keeps full before/fix/after anatomy |
| 6 | Contrast pass | PASS | 16 actual token pairs computed (contrast run logged below) — all PASS body+large; weakest TE badge #a855f7 on surface 4.91:1 |
| 7 | Reduced-motion pass | PASS | rm- captures clean (local-team/rm-top-390.png identical layout, skeleton static); global reduced-motion override in index.css |
| 8 | Mono tabular numerals | PASS | local-views/roster-sorted-390.png — KTC/Age right-aligned tabular mono; KPI values mono 800 |
| 9 | Touch targets ≥44px | PASS | 44px table rows, 56px tab bar, 44px sort headers + toast dismiss (kit-inherited fixes), 44px filter chips/buttons/modal close/remove buttons |
| 10 | Exactly one restrained signature | PASS | featured-asset 30-day KTC sparkline (local-team/top-390.png); KpiCard `signature` prop off everywhere |
| 11 | Zero console errors in capture runs | PASS | all capture.mjs + capture-views.mjs runs exited 0 |

## Contrast matrix (computed, scripts/contrast.py)

white/20.50 + 19.42, mist/11.11 + 10.53, mist@0.7 → #718a9a/5.67 + 5.37, electric/13.33 + 12.63, ember/7.23 + 6.85, gold-on-badge-tint/7.55, gold/9.04, RB green/7.66, WR blue/5.28, TE purple/4.91, bg-on-ember (404 CTA)/7.23 — **all PASS** (bg #02040a; surface composite #0b0d13). Position/slot colors are categorical data encodings per the plan; all clear 4.5 at badge sizes.

## Ship checklist — 7/7 (checked, not asserted)

| Item | Verdict | Evidence |
|---|---|---|
| Favicon | PASS | public/favicon.svg (pre-existing PWA asset, kept) |
| Title + meta description | PASS | index.html — "Legion of CMINN — Dynasty Command Center" + description |
| OG tags + image | PASS | og: block in index.html; public/og.png generated (scripts/generate_og.mjs, cosmic tokens) |
| 404 page | PASS | designed NotFound route (local-views/404-390.png) — SPA rewrite serves it client-side on any unknown path |
| prefers-reduced-motion | PASS | rm- captures; index.css override |
| Keyboard focus visible | PASS | :focus-visible ring; gate item 2 |
| No console errors | PASS | all runs exited 0 |

## Mobile pass
No canvas/particles (app mode — n/a). 390px: KPI 2×2 grid (fixed from orphaned 4th card), roster fixed-layout 3-column with truncating player cell (fixed from horizontal overflow — before/after in local-views/roster-sorted-390.png history), bottom tab bar 56px/5 tabs, toasts offset 72px above the bar.

## Retention/confusion check
First-time flow: landing → tap team → briefing answers "what is my team worth" in the header band + featured card without any interaction. No CTA competes with the signature (Refresh is quiet, top-right). Named risk: non-owner viewers don't see the Picks tab — intended (owner-only data).

## Copy audit
Buttons say what happens: "Refresh values", "RUN FULL CHECK" (name kept identical everywhere), "AUTO-FIX", "Clear trade", "← All teams", "← Back to the league". Empty states invite action; errors say what failed and how to recover ("Value refresh failed — showing the last saved values. Check your connection and try again."). Zero Lorem Ipsum.

## Chanel pass (mandatory cut)
**Cut: the 7-day trend micro-arrows in the roster KTC column** — a 9px glyph at table density read as noise; the same signal renders full-size in the featured asset card and PlayerModal sparkline. (Cuts made during build, for the record: the separate SORT button row — header sorting replaced it; the "■ KTC ■ FC" color legend — columns are labeled; the Google Fonts import — locked pairing uses system fonts.)

## Fixes made during audit (fix → full recapture each time)
1. KPI row: flex-wrap orphaned the 4th card at 390 → auto-fit grid (2×2).
2. Roster table: 5 columns overflowed 390 → narrow-mode columns (pos badge into player cell, FC dropped <640px) + fixed table layout with column widths.
3. Chanel cut applied (trend arrows), full recapture after.

## Verdict
App gate **11/11** (floor 8), ship checklist **7/7**, contrast 16/16 computed passes, zero console errors across every capture run. Production re-capture + live URL verification follow the deploy and are recorded in `prod/` alongside this report.
