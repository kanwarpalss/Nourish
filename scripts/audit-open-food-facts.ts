// Look up pack labels for foods that do not yet have one.
//
// This script used to call Open Food Facts' /api/v2/search with `search_terms`.
// That endpoint ignores `search_terms` entirely: it returns the first page of
// the whole 4.6-million-product database, so every food was scored against the
// same handful of unrelated products and reported as "no strong candidate".
// Almost every branded grocery does have a label, so a miss is now treated as
// "keep searching", not "no label exists": the search runs through progressively
// broader queries and reports an explicit status instead of a silent blank.
//
// Usage:
//   node --import tsx scripts/audit-open-food-facts.ts                  # cardIQ snapshot, when present
//   node --import tsx scripts/audit-open-food-facts.ts names.txt        # one food name per line
//   node --import tsx scripts/audit-open-food-facts.ts --name "poha"    # a single name

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { CardIqFoodImport } from "../app/cardiq-food";

const SEARCH_ENDPOINT = "https://world.openfoodfacts.org/cgi/search.pl";
const USER_AGENT = "Nourish/1.0 personal nutrition research - local only";
/** Open Food Facts asks for well under 1 request/second on the search endpoint. */
const REQUEST_SPACING_MS = 6000;
const STRONG_SCORE = 55;

export type Candidate = {
  score: number;
  code?: string;
  productName?: string;
  brands?: string;
  quantity?: string;
  per: string;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  fiber: number | null;
  imageUrl?: string;
  url: string;
};

export type LookupResult = {
  name: string;
  /** matched: a confident candidate. weak: candidates found, none confident.
   *  exhausted: every query returned nothing. error: the lookup itself failed. */
  status: "matched" | "weak" | "exhausted" | "error";
  queriesTried: string[];
  candidates: Candidate[];
  error?: string;
};

type Product = {
  code?: string;
  product_name?: string;
  brands?: string;
  quantity?: string;
  url?: string;
  nutrition_data_per?: string;
  image_front_small_url?: string;
  nutriments?: Record<string, number | string>;
};

const nonFood = /toothpaste|moisture cream|cough formula|lice comb|antiseptic|toilet cleaner|floor cleaner|agarbatti|book|muslin cloth|dishwash|body wash|healing balm|skin protectant/i;
const stop = new Set(["amazon", "brand", "fresh", "pack", "india", "with", "without", "made", "from", "food", "foods", "online", "buy", "the", "and", "for", "of", "no", "added", "grams", "gram", "litre", "liter", "piece", "approx", "combo", "value", "offer", "save"]);

export function tokens(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").split(/\s+/).filter((token) => token.length > 1 && !stop.has(token));
}

/**
 * Progressively broader queries. The old code sent nine tokens in one shot;
 * an over-specified query is the single biggest cause of a false "not found",
 * so each fallback drops detail until only the head noun is left.
 */
export function buildQueries(name: string): string[] {
  // Quantities help score a pack-size match ("425g" is real evidence) but only
  // add noise to a search query.
  const all = tokens(name).filter((token) => !/^\d+(g|gm|gms|kg|kgs|ml|l|ltr|pc|pcs|n)?$/.test(token));
  if (all.length === 0) return [];
  const candidates = [all.slice(0, 5), all.slice(0, 3), all.slice(0, 2), all.slice(0, 1)]
    .map((group) => group.join(" "))
    .filter((query) => query.length > 0);
  return [...new Set(candidates)];
}

export function macro(product: Product, key: string) {
  const value = Number(product.nutriments?.[`${key}_100g`] ?? product.nutriments?.[key]);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

export function score(name: string, product: Product) {
  const wanted = new Set(tokens(name));
  const found = new Set(tokens(`${product.brands ?? ""} ${product.product_name ?? ""} ${product.quantity ?? ""}`));
  const overlap = [...wanted].filter((token) => found.has(token)).length;
  const coverage = wanted.size ? overlap / wanted.size : 0;
  // Energy plus the three macros is the bar for a usable label; fibre is often
  // absent from an Indian pack and must not disqualify an otherwise good match.
  const hasMacros = ["energy-kcal", "proteins", "carbohydrates", "fat"].every((key) => macro(product, key) !== null);
  return Math.round((coverage * 100 + overlap * 4 + (hasMacros ? 15 : 0)) * 10) / 10;
}

/** A label is only usable if energy and the three macros are all present. */
export function toCandidate(name: string, product: Product): Candidate | null {
  const calories = macro(product, "energy-kcal");
  const protein = macro(product, "proteins");
  const carbs = macro(product, "carbohydrates");
  const fat = macro(product, "fat");
  if (calories === null || protein === null || carbs === null || fat === null) return null;
  // A per-100 g energy above ~900 kcal (pure fat) is physically impossible, and
  // the macros in 100 g cannot themselves weigh more than 100 g. Both mean the
  // pack value was entered against the wrong basis — a real example is a poha
  // listing 162.8 g of carbohydrate per 100 g, internally consistent with its
  // 722 kcal but describing a 200 g serving. Silently importing that would
  // double every meal built on it.
  if (calories > 900) return null;
  if (protein + carbs + fat > 100) return null;
  return {
    score: score(name, product),
    code: product.code,
    productName: product.product_name,
    brands: product.brands,
    quantity: product.quantity,
    per: product.nutrition_data_per ?? "100g",
    calories,
    protein,
    carbs,
    fat,
    fiber: macro(product, "fiber"),
    imageUrl: product.image_front_small_url,
    url: product.url ?? (product.code ? `https://world.openfoodfacts.org/product/${product.code}` : SEARCH_ENDPOINT),
  };
}

export function rankCandidates(name: string, products: Product[]): Candidate[] {
  return products
    .flatMap((product) => { const candidate = toCandidate(name, product); return candidate ? [candidate] : []; })
    .sort((left, right) => right.score - left.score)
    .slice(0, 3);
}

async function searchOnce(query: string): Promise<Product[]> {
  const params = new URLSearchParams({
    search_terms: query,
    search_simple: "1",
    action: "process",
    json: "1",
    page_size: "12",
    fields: "code,product_name,brands,quantity,url,nutrition_data_per,image_front_small_url,nutriments",
  });
  const response = await fetch(`${SEARCH_ENDPOINT}?${params}`, { headers: { "User-Agent": USER_AGENT } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const text = await response.text();
  let value: { products?: Product[] };
  try {
    value = JSON.parse(text) as { products?: Product[] };
  } catch {
    // Rate limiting returns an HTML page, which is a retryable condition and
    // must never be reported as "this food has no label".
    throw new Error("non-JSON response (usually rate limiting)");
  }
  return value.products ?? [];
}

const wait = (ms: number) => new Promise((done) => setTimeout(done, ms));

export async function lookup(name: string): Promise<LookupResult> {
  const queries = buildQueries(name);
  const queriesTried: string[] = [];
  let best: Candidate[] = [];
  for (const query of queries) {
    queriesTried.push(query);
    try {
      const products = await searchOnce(query);
      const ranked = rankCandidates(name, products);
      if (ranked.length > best.length || (ranked[0]?.score ?? 0) > (best[0]?.score ?? 0)) best = ranked;
      if ((best[0]?.score ?? 0) >= STRONG_SCORE) return { name, status: "matched", queriesTried, candidates: best };
    } catch (error) {
      return { name, status: "error", queriesTried, candidates: best, error: error instanceof Error ? error.message : String(error) };
    }
    await wait(REQUEST_SPACING_MS);
  }
  return { name, status: best.length > 0 ? "weak" : "exhausted", queriesTried, candidates: best };
}

function namesFromArgs(args: string[]): string[] {
  const nameFlag = args.indexOf("--name");
  if (nameFlag !== -1 && args[nameFlag + 1]) return [args[nameFlag + 1]];
  const file = args.find((arg) => !arg.startsWith("--"));
  if (file) return readFileSync(resolve(file), "utf8").split("\n").map((line) => line.trim()).filter(Boolean);

  const snapshotPath = resolve("public/cardiq-food-import.json");
  if (!existsSync(snapshotPath)) {
    throw new Error(`No names given and ${snapshotPath} is absent. Pass a file of names or --name "<food>".`);
  }
  const snapshot = JSON.parse(readFileSync(snapshotPath, "utf8")) as CardIqFoodImport;
  return snapshot.items.filter((item) => !nonFood.test(item.name)).map((item) => item.name);
}

async function main() {
  const names = namesFromArgs(process.argv.slice(2));
  const outputPath = resolve("/tmp/nourish-open-food-facts-candidates.json");
  const results: LookupResult[] = [];
  for (const [index, name] of names.entries()) {
    results.push(await lookup(name));
    console.log(`Checked ${index + 1} / ${names.length} — ${name} → ${results.at(-1)?.status}`);
    if (index < names.length - 1) await wait(REQUEST_SPACING_MS);
  }
  writeFileSync(outputPath, `${JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2)}\n`);
  const tally = (status: LookupResult["status"]) => results.filter((result) => result.status === status).length;
  console.log(`\nSaved ${results.length} lookups to ${outputPath}`);
  console.log(`  matched   ${tally("matched")}`);
  console.log(`  weak      ${tally("weak")}      ← review by hand; a label probably exists`);
  console.log(`  exhausted ${tally("exhausted")} ← search the brand site before accepting "no label"`);
  console.log(`  error     ${tally("error")}     ← retryable, NOT an absence of nutrition data`);
}

// Only run when invoked directly, so the pure helpers above stay importable by tests.
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop() ?? "")) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
