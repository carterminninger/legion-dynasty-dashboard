# Legion Dynasty Dashboard — /design v4 revamp plan (Phases 1–2)

Date: 2026-07-13 · Mode decided under /design app · Reskin + UX elevation only — data layer, API proxy, normName()/KTC indexing, validator/fixer loop, and PWA plumbing are untouched.

## PHASE 1 — BRIEF & PLAN

### Mode: `app`
This is a tool a manager operates daily — most often on a phone, between other things — not a page they visit. Hybrid was considered for the league homepage: rejected. Even the landing's single job is "get me to my team in one tap"; a 100vh hero canvas would stand between a phone user and that tap. The landing instead gets the app-mode compact header band (≤200px) as its identity moment — hero energy without hero friction.

### Subject
Twelve dynasty managers in Worm Up Dynasty 🪱 (primarily the owner) checking player values, rosters, and trades on phones. The page's single job: answer **"what is my team worth and what changed?"** in under ten seconds.

### Tokens — cosmic palette (kit `cosmicApp` theme)
The existing product is dark navy + electric blue + purple (PWA theme-color `#863bff`), branded "Dynasty Command Center." Cosmic is continuous with that identity; maritime would be an unasked-for rebrand.

- bg `#02040a` · surface `rgba(255,255,255,0.035)` · border `rgba(0,229,255,0.18)`
- text `#ffffff` · muted (mist) `#a0c4d8`
- accent/active/success: electric `#00e5ff` · warm/danger: ember `#ff6b35` · display-only: plasma `#7b2fff` (known-good matrix: plasma is display-size-only on cosmic bg — it never colors table-size numerals)
- **Value numerals are white/mist mono, not color-coded.** The old UI colored every KTC number purple and every FC number blue (a 5-color soup at 11px). Distinction moves to column position + tiny mono labels — more legible, and it keeps the 3-accent rule honest.
- **Position colors (QB `#f59e0b` / RB `#10b981` / WR `#3b82f6` / TE `#a855f7`) are retained as categorical data encodings** — they encode data like a chart palette, they are not UI accents. Documented exception, badge-fill only, never text-on-dark-critical.
- Type: Georgia italic = identity moments (team name, empty-state sentences); Courier New = every label, numeral, and table cell. Bebas Neue / DM Sans / Space Mono and the Google Fonts import are removed — system fonts, faster PWA cold start.
- Density: 4px grid, controls 40px, rows ≥44px, radius 8, body 13px, labels 11px mono 0.15em.

### Layout
League landing = header band + tappable 44px team rows + validator panel. Team dashboard = NavShell (bottom tabs <1024px, 240px sidebar desktop) around the five existing views — routes and tab structure unchanged.

```
390px — team dashboard, Briefing          390px — Roster
┌─────────────────────────────┐          ┌─────────────────────────────┐
│ ← All teams        ⟳ 4:32PM │          │ [scout: MY ROSTER      ▾]   │
│ LEGION OF CMINN   (Georgia) │          │ ALL STARTERS BENCH TAXI QB… │
│ worm up dynasty · 2026      │          ├─────────────────────────────┤
│ ┌──────┐ ┌──────┐ ┌──────┐  │          │ POS PLAYER      KTC▾ FC AGE │
│ │RECORD│ │ KTC  │ │AVGAGE│  │  KPIs    │ ◉ J.Chase WR   9,999 9,8 24 │
│ └──────┘ └──────┘ └──────┘  │          │ ◉ B.Robinson RB 8,7  8,9 23 │
│ ┌─────────────────────────┐ │          │ ◉ …44px rows, mono numerals │
│ │ TOP ASSET   Ja'M. Chase │ │          ├─────────────────────────────┤
│ │ 9,999 KTC   ╱╲__╱▔▔╲_╱  │ │ ← SIGNATURE: 30-day KTC sparkline
│ │ 30-day trend            │ │          │                             │
│ └─────────────────────────┘ │          │                             │
│ IR watch · news · standings │          │                             │
├─────────────────────────────┤          ├─────────────────────────────┤
│ Brief Roster Picks Trades ⚖ │          │ Brief Roster Picks Trades ⚖ │
└─────────────────────────────┘          └─────────────────────────────┘
   bottom tab bar, 56px, ≥44px targets
```

### Signature element (the ONE): **30-day KTC sparkline on the featured top asset card (Briefing)**
The app has snapshotted 30 days of KTC values into localStorage since launch (`ktc_snapshot_*`) — data plumbing that exists and is never drawn. The signature makes the product's own dormant data visible: an SVG line sparkline on the top-KTC asset card, electric stroke, endpoint dot. Sparse state designed: "Day N of 30 — history builds daily." Chosen over TopGlow-on-KPI, which was the harness app page's signature last session (design-log rule: no repeat two projects running). KpiCard's `signature` prop stays OFF everywhere in this build.

### States & feedback
- Skeletons: team list, roster table, briefing cards, trades — in the shape of loaded content.
- Empty states: no trades ("No in-season trades yet — offseason history below" as designed block), roster filter with zero players, ValueTrend day-1.
- ToastStack replaces silent outcomes: validator full check (success auto-dismiss / error persists with count), value refresh confirmation. RUN FULL CHECK keeps its name — same action, same name, everywhere it appears.
- Microcopy pass: "LOADING..." strings die; "↺ REFRESH" → "Refresh values"; errors say what failed and what to do.

## PHASE 2 — ANTI-DEFAULT CRITIQUE

1. **"Would I produce this same plan for any dashboard?"** NavShell + KpiCard + DataTable is the app-mode default recipe — so the honest revision: the roster view does NOT flatten into a bare text DataTable. The rich player row (headshot, position badge, slot badge, dual values, age color) IS the product; it keeps its anatomy and inherits DataTable's *semantics* (sticky sortable header, mono tabular numerals, 44px rows, skeleton + empty states). Porting the pattern, not erasing the product.
2. **Near-black + single acid accent tell**: cosmic is near-black + electric — accepted deliberately as brand continuity with the existing purple/electric product identity, and it's 3 accents + a categorical data palette, not single-accent minimalism.
3. **§ numbering: rejected** — briefing sections aren't sequential (app-mode rule). Standings ranks are real data, kept.
4. **Big-number-with-small-label hero: rejected** — the header band carries KPIs at density, not spectacle.
5. **Cream/serif/terracotta default: n/a** (dark app).
6. Wave dividers, floating CTA, glitch: n/a by mode — spacing + 1px borders separate sections.
7. Bottom tab labels at 390px: five tabs fit at ≥44px with 11px labels; "TRADE CALC" abbreviates to "Calc ⚖" in the nav only — the view header keeps the full name "Trade Calculator."

## Port notes (kit → `src/kit/`, Vite consumer copy)
- Ported: `theme` (ts→js, types dropped), `tokens`, `NavShell`, `KpiCard`, `DataTable`, `Skeleton`, `Toast`, `Field`, `useReducedMotion` hook. `"use client"` directives dropped (Next-only).
- Not ported (n/a by app mode): HeroShell, WaveDivider, FloatingCTA, GlitchText, canvas engines, Gallery, Nav, Card/ReviewCard/StatBadge, CardFrame, VelocityCursorRing.
- Kit source of truth stays in `~/.claude/skills/design/references/` — this is a consumer copy like the harness's.
