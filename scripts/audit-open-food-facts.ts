import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { CardIqFoodImport } from "../app/cardiq-food";

type Product = {
  code?: string;
  product_name?: string;
  brands?: string;
  quantity?: string;
  url?: string;
  nutrition_data_per?: string;
  nutriments?: Record<string, number | string>;
};

const snapshot = JSON.parse(readFileSync(resolve("public/cardiq-food-import.json"), "utf8")) as CardIqFoodImport;
const outputPath = resolve("/tmp/nourish-open-food-facts-candidates.json");
const nonFood = /toothpaste|moisture cream|cough formula|lice comb|antiseptic|toilet cleaner|floor cleaner|agarbatti|book|muslin cloth|dishwash|body wash|healing balm|skin protectant/i;
const stop = new Set(["amazon", "brand", "fresh", "pack", "india", "with", "without", "made", "from", "food", "foods", "online", "buy", "the", "and", "for", "of", "no", "added", "grams", "gram", "litre", "liter", "piece", "approx"]);

function tokens(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").split(/\s+/).filter((token) => token.length > 1 && !stop.has(token));
}

function searchTerms(name: string) {
  return tokens(name).slice(0, 9).join(" ");
}

function macro(product: Product, key: string) {
  const value = Number(product.nutriments?.[`${key}_100g`] ?? product.nutriments?.[key]);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

function score(name: string, product: Product) {
  const wanted = new Set(tokens(name));
  const found = new Set(tokens(`${product.brands ?? ""} ${product.product_name ?? ""} ${product.quantity ?? ""}`));
  const overlap = [...wanted].filter((token) => found.has(token)).length;
  const coverage = wanted.size ? overlap / wanted.size : 0;
  const hasMacros = ["energy-kcal", "proteins", "carbohydrates", "fat"].every((key) => macro(product, key) !== null);
  return Math.round((coverage * 100 + overlap * 4 + (hasMacros ? 15 : 0)) * 10) / 10;
}

async function lookup(name: string) {
  const params = new URLSearchParams({
    search_terms: searchTerms(name),
    page_size: "10",
    fields: "code,product_name,brands,quantity,url,nutrition_data_per,nutriments",
  });
  try {
    const response = await fetch(`https://world.openfoodfacts.org/api/v2/search?${params}`, {
      headers: { "User-Agent": "Nourish private nutrition audit - contact: local-only" },
    });
    if (!response.ok) return { name, error: `HTTP ${response.status}`, candidates: [] };
    const value = await response.json() as { products?: Product[] };
    const candidates = (value.products ?? []).map((product) => ({
      score: score(name, product),
      code: product.code,
      productName: product.product_name,
      brands: product.brands,
      quantity: product.quantity,
      per: product.nutrition_data_per ?? "100g",
      calories: macro(product, "energy-kcal"),
      protein: macro(product, "proteins"),
      carbs: macro(product, "carbohydrates"),
      fat: macro(product, "fat"),
      fiber: macro(product, "fiber"),
      url: product.url,
    })).filter((candidate) => candidate.calories !== null && candidate.protein !== null && candidate.carbs !== null && candidate.fat !== null)
      .sort((left, right) => right.score - left.score).slice(0, 3);
    return { name, candidates };
  } catch (error) {
    return { name, error: error instanceof Error ? error.message : String(error), candidates: [] };
  }
}

async function main() {
  const items = snapshot.items.filter((item) => !nonFood.test(item.name));
  const results: Awaited<ReturnType<typeof lookup>>[] = [];
  for (let index = 0; index < items.length; index += 4) {
    results.push(...await Promise.all(items.slice(index, index + 4).map((item) => lookup(item.name))));
    console.log(`Checked ${Math.min(index + 4, items.length)} / ${items.length}`);
  }
  writeFileSync(outputPath, `${JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2)}\n`);
  const strong = results.filter((result) => result.candidates[0] && result.candidates[0].score >= 65).length;
  console.log(`Saved ${results.length} searches to ${outputPath}; ${strong} have a strong candidate.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
