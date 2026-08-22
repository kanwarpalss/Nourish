/**
 * Build-time photo sourcing from Wikipedia article lead images.
 *
 *   node scripts/source-wikipedia-photos.mjs > photos.json
 *
 * Why lead images rather than an image search: a Commons keyword search for
 * "milk carton" confidently returns a photo of a band called The Milk Carton
 * Kids, and "chicken breast" returns a live rooster. An article's lead image is
 * curated to depict that article's subject, so asking for the article named
 * "Cumin" is a far stronger guarantee than asking for pictures matching "cumin".
 *
 * Every result is then gated: the page must exist, must not be a disambiguation
 * page, must carry a lead image, and the title Wikipedia finally resolved to
 * (after redirects) must still share a word with what we asked for. Anything
 * that fails is reported and left without a photo — a food with a drawn icon is
 * fine, a food with the wrong photo is not. The JSON remains a candidate list:
 * visually check subject and raw/cooked form before applying it.
 *
 * Only URLs are stored. Images are hot-linked, never copied into this repo.
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const API = "https://en.wikipedia.org/w/api.php";
const UA = "Nourish-personal-app/1.0 (local build script)";
const THUMB = 400;

/**
 * Catalogue id -> Wikipedia article that depicts it.
 * Hand-written, because "capsicum" must reach Bell pepper and "dahi" must reach
 * Curd. A generated guess is exactly how the wrong picture gets in.
 */
export const articles = {
  // Vegetables
  cauliflower: "Cauliflower", tomato: "Tomato", onion: "Onion", carrot: "Carrot",
  broccoli: "Broccoli", pumpkin: "Pumpkin", cucumber: "Cucumber", potato: "Potato",
  beetroot: "Beetroot", lettuce: "Lettuce", spinach: "Spinach",
  brinjal: "Eggplant", "bottle-gourd": "Calabash", "green-beans": "Green bean",

  // Fruit
  banana: "Banana", mango: "Mango", strawberries: "Strawberry", pomegranate: "Pomegranate",
  avocado: "Avocado", guava: "Guava", lemon: "Lemon",

  // Protein. Only visually unambiguous forms belong here; raw/cooked cuts do not.
  "egg-whites": "Egg white", tofu: "Tofu",

  // Dairy. Category-grade milks intentionally use one neutral milk image elsewhere.
  "curd-dahi": "Curd", "paneer-whole-milk": "Paneer",

  // Grains and flours
  oats: "Oat",
  "atta-whole-wheat": "Atta flour", "poha-dry": "Flattened rice",
  "vermicelli-dry": "Vermicelli", "bread-whole-wheat": "Whole wheat bread",
  "bread-white": "White bread", "rice-flour": "Rice flour", "corn-starch": "Corn starch",
  "pav-bread": "Pav (bread)", "rusk-toast": "Rusk",

  // Pulses
  besan: "Gram flour", "chickpeas-dry": "Chickpea",

  // Nuts, seeds, fats
  almonds: "Almond", "peanuts-raw": "Peanut", "peanut-butter": "Peanut butter",
  chia: "Chia seed",

  // Aromatics and spices
  ginger: "Ginger", "coriander-leaves": "Coriander",
  "mint-leaves": "Mentha", lemongrass: "Cymbopogon", "cumin-seed": "Cumin",
  "chilli-powder": "Chili powder",

  // Sweeteners, drinks, misc
  "sugar-white": "White sugar", cocoa: "Cocoa solids", "tea-brewed": "Tea",
  "coconut-water": "Coconut water",
  murukku: "Murukku", "chana-jor-namkeen": "Chana jor garam",
};

/** A resumed map may be old; stale branded or retired ids must not ride through. */
export function filterExistingPhotoMap(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const allowed = new Set(Object.keys(articles));
  return Object.fromEntries(Object.entries(value).filter(([id, url]) => allowed.has(id) && typeof url === "string" && /^https:\/\//.test(url)));
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const stopWords = new Set(["as", "food", "the", "of", "and", "a", "raw", "drink", "mix", "bread", "flour", "seed", "sugar"]);
/** Compare stems, so "Egg as food" -> "Eggs as food" is not read as a mismatch. */
const stem = (word) => word.replace(/s$/, "");
const words = (value) => value.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 2 && !stopWords.has(word)).map(stem);

/** Redirects that are correct even though the title changes completely. */
const acceptedRedirects = new Map([["White sugar", "Sucrose"], ["Chana dal", "Chickpea"]]);

/** Wikipedia throttles bursts; a 429 means "slow down", not "no such image". */
async function fetchJson(url, attempt = 0) {
  const response = await fetch(url, { headers: { "user-agent": UA } });
  if ((response.status === 429 || response.status >= 500) && attempt < 4) {
    await sleep(2000 * (attempt + 1));
    return fetchJson(url, attempt + 1);
  }
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

/** The API appends campaign tracking; store the bare file URL. */
function cleanUrl(value) {
  const url = new URL(value);
  url.search = "";
  return url.toString();
}

/** A brand article often leads with a wordmark. A logo is not a photo of food. */
const NOT_A_PHOTO = /logo|wordmark|emblem|icon|symbol|\.svg$/i;

/** Returns { url, resolvedTitle } or null, never a guess. */
async function leadImage(title) {
  const url = new URL(API);
  url.searchParams.set("action", "query");
  url.searchParams.set("titles", title);
  url.searchParams.set("prop", "pageimages|pageprops");
  url.searchParams.set("piprop", "thumbnail");
  url.searchParams.set("pithumbsize", String(THUMB));
  url.searchParams.set("redirects", "1");
  url.searchParams.set("format", "json");
  url.searchParams.set("origin", "*");

  const body = await fetchJson(url);
  const page = Object.values(body?.query?.pages ?? {})[0];
  if (!page || page.missing !== undefined) return { error: "no such article" };
  if (page.pageprops?.disambiguation !== undefined) return { error: "disambiguation page" };
  const thumb = page.thumbnail?.source;
  if (!thumb) return { error: "article has no lead image" };
  const filename = decodeURIComponent(cleanUrl(thumb).split("/").pop() ?? "");
  if (NOT_A_PHOTO.test(filename)) return { error: `lead image is a logo, not a photo (${filename})` };

  // Redirects can land somewhere unrelated; require a shared significant word.
  const asked = words(title);
  const got = words(page.title ?? "");
  const overlaps = asked.length === 0 || got.length === 0 || asked.some((word) => got.includes(word))
    || acceptedRedirects.get(title) === page.title;
  if (!overlaps) return { error: `redirected to unrelated article "${page.title}"` };

  return { url: cleanUrl(thumb), resolvedTitle: page.title };
}

async function main() {
  const existingPath = process.argv[2];
  const existing = filterExistingPhotoMap(existingPath && existsSync(existingPath) ? JSON.parse(readFileSync(existingPath, "utf8")) : {});
  if (Object.keys(existing).length) console.error(`resuming with ${Object.keys(existing).length} already resolved`);

  const results = { ...existing };
  const failures = [];
  for (const [id, title] of Object.entries(articles)) {
    if (results[id]) continue;
    try {
      const outcome = await leadImage(title);
      if (outcome.error) {
        failures.push(`${id} (${title}): ${outcome.error}`);
        console.error(`SKIP  ${id.padEnd(28)} ${title} — ${outcome.error}`);
      } else {
        results[id] = outcome.url;
        const file = decodeURIComponent(outcome.url.split("/").pop() ?? "");
        console.error(`ok    ${id.padEnd(28)} ${outcome.resolvedTitle.padEnd(24)} ${file.slice(0, 60)}`);
      }
    } catch (error) {
      failures.push(`${id}: ${error.message}`);
      console.error(`FAIL  ${id} — ${error.message}`);
    }
    await sleep(700);
  }

  console.error(`\nresolved ${Object.keys(results).length}/${Object.keys(articles).length}`);
  if (failures.length) console.error(`left without a photo:\n  ${failures.join("\n  ")}`);
  console.log(JSON.stringify(results, null, 2));
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) await main();
