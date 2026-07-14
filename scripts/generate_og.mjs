/**
 * generate_og.mjs — renders public/og.png (1200×630) from an inline SVG.
 * Tokens: cosmic palette (src/kit/tokens.js). Run: node scripts/generate_og.mjs
 */
import sharp from "sharp";

const svg = `
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#02040a"/>
      <stop offset="55%" stop-color="#070b18"/>
      <stop offset="100%" stop-color="#0b0620"/>
    </linearGradient>
    <linearGradient id="spark" x1="0" y1="1" x2="1" y2="0">
      <stop offset="0%" stop-color="#00e5ff" stop-opacity="0.25"/>
      <stop offset="100%" stop-color="#00e5ff"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <ellipse cx="980" cy="120" rx="420" ry="260" fill="#7b2fff" opacity="0.14"/>
  <ellipse cx="150" cy="560" rx="380" ry="220" fill="#00e5ff" opacity="0.08"/>
  <polyline points="80,470 240,430 400,450 560,380 720,400 880,330 1040,350 1120,300"
    fill="none" stroke="url(#spark)" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/>
  <circle cx="1120" cy="300" r="9" fill="#00e5ff"/>
  <text x="80" y="200" font-family="Courier New, monospace" font-size="26" letter-spacing="10" fill="#a0c4d8">DYNASTY COMMAND CENTER</text>
  <text x="74" y="300" font-family="Georgia, serif" font-style="italic" font-weight="900" font-size="84" fill="#ffffff">Legion of CMINN</text>
  <text x="80" y="360" font-family="Georgia, serif" font-style="italic" font-size="32" fill="#a0c4d8">Worm Up Dynasty · live KTC &amp; FantasyCalc values</text>
  <text x="80" y="560" font-family="Courier New, monospace" font-size="22" letter-spacing="4" fill="#00e5ff">legion-dynasty-dashboard.vercel.app</text>
</svg>`;

await sharp(Buffer.from(svg)).png().toFile("public/og.png");
console.log("public/og.png written");
