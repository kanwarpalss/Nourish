/**
 * Build-time photo sourcing. Run by hand when new foods are added:
 *   node scripts/source-food-photos.mjs
 *
 * Nourish never calls an image API at runtime. This script looks each food up
 * on Wikimedia Commons once, keeps only links that really resolve to a photo,
 * and prints an id -> URL map to paste into app/nutrition-data.ts.
 *
 * Only the URL is stored. Images are hot-linked and never copied into this
 * repository, which is public.
 */

import { existsSync, readFileSync } from "node:fs";

const COMMONS_API = "https://commons.wikimedia.org/w/api.php";
const THUMB_WIDTH = 320;

/** Search terms tuned per food; a bare name often returns diagrams or logos. */
const searchTerms = {
  "nandini-goodlife-toned": "milk carton",
  "epigamia-natural-greek": "greek yogurt bowl",
  "muscleblaze-biozyme-whey": "whey protein powder",
  "amul-high-protein-buttermilk": "buttermilk glass",
  "amul-high-protein-paneer": "paneer cubes",
  banana: "banana fruit",
  chia: "chia seeds",
  oats: "rolled oats",
  cauliflower: "cauliflower vegetable",
  "chicken-breast": "raw chicken breast",
  "rajma-cooked": "kidney beans cooked",
  "quinoa-cooked": "cooked quinoa",
  spinach: "spinach leaves",
  "egg-whites": "egg white bowl",
  cocoa: "cocoa powder",
  "chickpeas-cooked": "cooked chickpeas",
  "green-peas-cooked": "green peas",
  mango: "mango fruit",
  strawberries: "strawberries fruit",
  pomegranate: "pomegranate arils",
  cucumber: "cucumber vegetable",
  tomato: "tomato fruit red",
  capsicum: "green bell pepper",
  onion: "onion bulb",
  carrot: "carrots vegetable",
  "green-beans": "green beans vegetable",
  "bottle-gourd": "bottle gourd lauki",
  broccoli: "broccoli vegetable",
  pumpkin: "pumpkin squash",
  "whole-egg": "chicken eggs",
  oil: "sunflower cooking oil bottle",
  "peanut-butter": "peanut butter jar",
  almonds: "almonds nuts",
  flax: "flax seeds",
  "sweet-potato": "sweet potato",
  "brown-rice": "brown rice grains",
  "greek-yogurt-nonfat": "yogurt bowl plain",
};

const banned = /(logo|map|diagram|chart|coat of arms|icon|svg|signature)/i;

/** Key word each result title should ideally contain, to avoid stray photos. */
const relevanceWord = {
  "nandini-goodlife-toned": "milk",
  "epigamia-natural-greek": "yogurt",
  "muscleblaze-biozyme-whey": "protein",
  "amul-high-protein-buttermilk": "buttermilk",
  "amul-high-protein-paneer": "paneer",
  "rajma-cooked": "bean",
  "quinoa-cooked": "quinoa",
  "egg-whites": "egg",
  "chickpeas-cooked": "chickpea",
  "green-peas-cooked": "pea",
  capsicum: "pepper",
  "whole-egg": "egg",
  oil: "oil",
  "greek-yogurt-nonfat": "yogurt",
  cocoa: "cocoa",
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** The API appends campaign tracking; store the bare file URL instead. */
function cleanUrl(url) {
  const parsed = new URL(url);
  parsed.search = "";
  return parsed.toString();
}

async function searchCommons(term) {
  const url = new URL(COMMONS_API);
  url.searchParams.set("action", "query");
  url.searchParams.set("generator", "search");
  url.searchParams.set("gsrsearch", `${term} filetype:bitmap`);
  url.searchParams.set("gsrnamespace", "6");
  url.searchParams.set("gsrlimit", "8");
  url.searchParams.set("prop", "imageinfo");
  url.searchParams.set("iiprop", "url|mime");
  url.searchParams.set("iiurlwidth", String(THUMB_WIDTH));
  url.searchParams.set("format", "json");

  const response = await fetch(url, { headers: { "user-agent": "Nourish-personal-app/1.0 (local build script)" } });
  if (!response.ok) return [];
  const body = await response.json();
  const pages = Object.values(body?.query?.pages ?? {});
  return pages
    .filter((page) => !banned.test(page.title ?? ""))
    .map((page) => ({ title: page.title ?? "", url: page.imageinfo?.[0]?.thumburl, mime: page.imageinfo?.[0]?.mime }))
    .filter((item) => typeof item.url === "string" && /^image\/(jpeg|png|webp)$/.test(item.mime ?? ""))
    .map((item) => ({ ...item, url: cleanUrl(item.url) }));
}

/**
 * Returns "ok" | "dead" | "throttled". Wikimedia rate-limits bursts, so a 429
 * is not evidence the file is missing; the API already confirmed it exists and
 * the app falls back to a drawn icon if a link ever breaks.
 */
async function checkUrl(url) {
  try {
    const response = await fetch(url, { headers: { "user-agent": "Nourish-personal-app/1.0 (local build script)" } });
    if (response.status === 429 || response.status >= 500) return "throttled";
    if (response.ok && (response.headers.get("content-type") ?? "").startsWith("image/")) return "ok";
    return "dead";
  } catch {
    return "throttled";
  }
}

// Resumable: pass an existing output file and only the gaps are fetched.
// Wikimedia rate-limits bursts, so topping up across runs beats one long run.
const existingPath = process.argv[2];
const existing = existingPath && existsSync(existingPath)
  ? JSON.parse(readFileSync(existingPath, "utf8"))
  : {};
if (Object.keys(existing).length) console.error(`resuming with ${Object.keys(existing).length} already-known photos`);

// Phase 1 — one search per food. The API is the authority on what exists.
const picked = {};
const failures = [];
for (const [id, term] of Object.entries(searchTerms)) {
  if (existing[id]) continue;
  const candidates = await searchCommons(term);
  const want = relevanceWord[id] ?? id.split("-")[0];
  // Prefer a title that actually names the food before falling back to any hit.
  const ranked = [...candidates].sort((left, right) => {
    const score = (item) => (item.title.toLowerCase().includes(want.toLowerCase()) ? 0 : 1);
    return score(left) - score(right);
  });
  if (ranked.length === 0) {
    failures.push(id);
    console.error(`MISS  ${id}  (term: ${term})`);
    continue;
  }
  picked[id] = ranked[0];
  console.error(`pick  ${id}  <-  ${ranked[0].title}`);
  await sleep(2000);
}

// Phase 2 — confirm the links load, dropping only ones that are genuinely dead.
const results = {};
let throttled = 0;
for (const [id, item] of Object.entries(picked)) {
  const status = await checkUrl(item.url);
  if (status === "dead") {
    failures.push(id);
    console.error(`DEAD  ${id}  ${item.url}`);
  } else {
    if (status === "throttled") throttled += 1;
    results[id] = item.url;
  }
  await sleep(600);
}
console.error(`\nlinks verified: ${Object.keys(results).length - throttled}, kept unverified (throttled): ${throttled}`);

// Merge so a resumed run never drops photos found by an earlier one.
const merged = { ...existing, ...results };
console.error(`\nresolved ${Object.keys(merged).length}/${Object.keys(searchTerms).length}; still missing: ${failures.join(", ") || "none"}`);
console.log(JSON.stringify(merged, null, 2));
