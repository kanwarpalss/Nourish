import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { sanitizeCardIqFoodImport, type CardIqFoodImport } from "../app/cardiq-food";

const storeOrder = new Map(["Amazon", "BigBasket", "Instamart"].map((store, index) => [store, index]));

export function generateUnmatchedCardIqDoc(input: CardIqFoodImport) {
  const snapshot = sanitizeCardIqFoodImport(input);
  const unresolved = snapshot.items
    .filter((item) => !item.matchedFoodId)
    .sort((left, right) => (storeOrder.get(left.store) ?? 99) - (storeOrder.get(right.store) ?? 99) || left.name.localeCompare(right.name));
  const generatedDate = snapshot.generatedAt.slice(0, 10);
  const rows = unresolved.map((item, index) => `${index + 1}. **${item.store}:** ${item.name.replace(/\s+/g, " ").trim()}`);
  return `# cardIQ foods awaiting exact nutrition evidence

> Generated from the local cardIQ snapshot on ${generatedDate}. These items are deliberately **not** auto-populated: the exact retailer title does not yet have an exact Brand + Item Name + Variant/pack match with compatible nutrition evidence. Generic ingredients and similar products are not substituted.

**Unresolved purchase rows:** ${unresolved.length}

${rows.join("\n")}
`;
}

function main() {
  const inputPath = resolve("public/cardiq-food-import.json");
  const outputPath = resolve("data/UNMATCHED_CARDIQ_FOODS.md");
  const input = JSON.parse(readFileSync(inputPath, "utf8")) as CardIqFoodImport;
  writeFileSync(outputPath, generateUnmatchedCardIqDoc(input), "utf8");
  console.log(`Wrote ${outputPath}`);
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) main();
