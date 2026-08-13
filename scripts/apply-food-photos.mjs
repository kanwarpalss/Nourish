/**
 * Applies a photo map produced by source-food-photos.mjs into the seed
 * catalogue:
 *   node scripts/apply-food-photos.mjs photos.json
 *
 * Idempotent — an id that already has an imageUrl is updated in place rather
 * than duplicated, so the script can be re-run as more photos are found.
 */

import { readFileSync, writeFileSync } from "node:fs";

const mapPath = process.argv[2];
if (!mapPath) {
  console.error("usage: node scripts/apply-food-photos.mjs <photos.json>");
  process.exit(1);
}

const photos = JSON.parse(readFileSync(mapPath, "utf8"));
const dataPath = new URL("../app/nutrition-data.ts", import.meta.url);
let source = readFileSync(dataPath, "utf8");

let added = 0;
let updated = 0;
const missing = [];

for (const [id, url] of Object.entries(photos)) {
  if (!/^https:\/\//.test(url)) {
    console.error(`skip ${id}: not an https URL`);
    continue;
  }
  // Seed entries come in two shapes: one object per line, and multi-line
  // blocks. Anchor on the id token so both are handled the same way.
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const existingImage = new RegExp(`(id: "${escaped}",[\\s\\S]{0,400}?)imageUrl: "[^"]*",`);
  if (existingImage.test(source)) {
    source = source.replace(existingImage, `$1imageUrl: "${url}",`);
    updated += 1;
    continue;
  }

  const idToken = new RegExp(`( *)id: "${escaped}",`);
  const match = source.match(idToken);
  if (!match) {
    missing.push(id);
    continue;
  }
  const isOwnLine = /^\s*id: "/.test(source.slice(source.lastIndexOf("\n", match.index) + 1, match.index + match[0].length));
  const insertion = isOwnLine ? `\n${match[1]}imageUrl: "${url}",` : ` imageUrl: "${url}",`;
  source = source.slice(0, match.index + match[0].length) + insertion + source.slice(match.index + match[0].length);
  added += 1;
}

writeFileSync(dataPath, source);
console.log(`added ${added}, updated ${updated}, unknown ids: ${missing.join(", ") || "none"}`);
