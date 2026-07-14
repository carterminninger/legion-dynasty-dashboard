/**
 * capture.mjs — screenshot capture for /design Phase 4 audits and kit verification.
 *
 * Usage:  node scripts/capture.mjs [baseUrl] [outDir]
 * Default: http://localhost:3000 → screenshots/
 *
 * Captures, per width (390 / 768 / 1440):
 *   top-{w}.png  — viewport at scroll 0
 *   mid-{w}.png  — viewport at 50% scroll (reveals, nav blur, floating CTA visible)
 *   full-{w}.png — full-page
 * Collects console errors + pageerrors; exits 1 if any (ship-checklist item).
 */
import { chromium } from "playwright";
import { mkdirSync } from "fs";

const base = process.argv[2] ?? "http://localhost:3000";
const out = process.argv[3] ?? "screenshots";
const reducedMotion = process.argv[4] === "--reduced"; // emulates prefers-reduced-motion, prefixes files rm-
const prefix = reducedMotion ? "rm-" : "";
const widths = [390, 768, 1440];
mkdirSync(out, { recursive: true });

let up = false;
for (let i = 0; i < 30 && !up; i++) {
  try { await fetch(base); up = true; } catch { await new Promise(r => setTimeout(r, 1000)); }
}
if (!up) { console.error(`Server not reachable at ${base}`); process.exit(2); }

const browser = await chromium.launch();
const errors = [];
for (const w of widths) {
  const page = await browser.newPage({ viewport: { width: w, height: 844 } });
  if (reducedMotion) await page.emulateMedia({ reducedMotion: "reduce" });
  page.on("console", m => { if (m.type() === "error") errors.push(`[${w}px] console: ${m.text()}`); });
  page.on("pageerror", e => errors.push(`[${w}px] pageerror: ${e.message}`));
  await page.goto(base, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${out}/${prefix}top-${w}.png` });
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.5));
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${out}/${prefix}mid-${w}.png` });
  // step-scroll to the bottom so every IntersectionObserver Reveal fires,
  // otherwise the full-page shot captures unrevealed (opacity 0) sections
  await page.evaluate(async () => {
    for (let y = 0; y <= document.body.scrollHeight; y += window.innerHeight / 2) {
      window.scrollTo(0, y);
      await new Promise(r => setTimeout(r, 150));
    }
  });
  await page.waitForTimeout(1000);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${out}/${prefix}full-${w}.png`, fullPage: true });
  await page.close();
  console.log(`captured ${prefix}${w}px`);
}
await browser.close();
console.log(errors.length ? "CONSOLE ERRORS:\n" + errors.join("\n") : "No console errors.");
process.exit(errors.length ? 1 : 0);
