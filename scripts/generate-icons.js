/**
 * generate-icons.js
 * Purpose:  Convert public/icon.svg into PWA-required PNG sizes.
 * Inputs:   public/icon.svg
 * Outputs:  public/icon-192.png, public/icon-512.png, public/apple-touch-icon.png
 * Dependencies: sharp (devDep — run once after icon design changes)
 */

import sharp from "sharp";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(__dirname, "..", "public");

const svg = readFileSync(join(PUBLIC, "icon.svg"));

const targets = [
  { file: "icon-192.png",        size: 192 },
  { file: "icon-512.png",        size: 512 },
  { file: "apple-touch-icon.png", size: 180 },
];

for (const { file, size } of targets) {
  await sharp(svg).resize(size, size).png().toFile(join(PUBLIC, file));
  console.log(`✓  ${file}  (${size}×${size})`);
}
