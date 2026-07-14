/**
 * capture-views.mjs — supplement to the canonical capture.mjs: clicks through
 * the dashboard tabs and the landing validator tab, screenshotting each view
 * at 390 and 1440. Usage: node scripts/capture-views.mjs [baseUrl] [outDir]
 */
import { chromium } from "playwright";
import { mkdirSync } from "fs";

const base = process.argv[2] ?? "http://localhost:4321";
const out = process.argv[3] ?? "audit-samples/views";
const TEAM = "1002171390751113216";
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const errors = [];

for (const w of [390, 1440]) {
  const page = await browser.newPage({ viewport: { width: w, height: 844 } });
  page.on("console", m => { if (m.type() === "error") errors.push(`[${w}px] console: ${m.text()}`); });
  page.on("pageerror", e => errors.push(`[${w}px] pageerror: ${e.message}`));

  // Dashboard tabs
  await page.goto(`${base}/team/${TEAM}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  for (const tab of ["Roster", "Picks", "Trades", "Calc"]) {
    await page.getByRole("button", { name: tab, exact: false }).first().click();
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${out}/${tab.toLowerCase()}-${w}.png` });
  }
  // Roster sorted by KTC (exercise sort headers)
  await page.getByRole("button", { name: "Roster" }).first().click();
  await page.waitForTimeout(800);
  await page.getByRole("button", { name: /KTC/ }).first().click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${out}/roster-sorted-${w}.png` });

  // Landing validator tab
  await page.goto(`${base}/`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  await page.getByRole("button", { name: "Validator" }).click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${out}/validator-${w}.png` });

  // 404 route
  await page.goto(`${base}/definitely-missing`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${out}/404-${w}.png` });

  await page.close();
}
await browser.close();
if (errors.length) { console.error(errors.join("\n")); process.exit(1); }
console.log("views captured, no console errors");
