/**
 * Build-time product-photo sourcing for branded items.
 *
 * Generic ingredients get a Wikimedia photo (source-food-photos.mjs); branded
 * packs do not exist there, so those come from the retailer's own product page
 * — the pack shot on the page that the catalogue already cites as its source.
 *
 * Usage: node scripts/source-product-photos.mjs > photos-products.json
 * Only the URL is kept. Images are hot-linked, never copied into this repo.
 */

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

/**
 * Tokens the chosen filename must contain. BigBasket pack-shot filenames are
 * the product slug, so this catches a wrong or recycled product id before a
 * Fanta bottle can end up labelled as buttermilk.
 */
const requiredTokens = {
  "nandini-goodlife-toned": ["nandini", "milk"],
  "epigamia-natural-greek": ["epigamia", "yogurt"],
  "muscleblaze-biozyme-whey": ["muscleblaze", "whey"],
  "amul-high-protein-buttermilk": ["amul", "buttermilk"],
  "amul-high-protein-paneer": ["amul", "paneer"],
};

/** Catalogue id -> retailer product page carrying the official pack shot. */
const productPages = {
  "nandini-goodlife-toned": "https://www.bigbasket.com/pd/100285703/nandini-goodlife-toned-milk-1-l-carton/",
  "epigamia-natural-greek": "https://www.bigbasket.com/pd/40046546/epigamia-greek-yogurt-natural-90-g-cup/",
  "muscleblaze-biozyme-whey": "https://www.bigbasket.com/pd/40230229/muscleblaze-biozyme-whey-protein-improves-protein-absorption-by-50-rich-milk-chocolate-2-kg/",
  "amul-high-protein-buttermilk": "https://www.bigbasket.com/pd/40269293/amul-high-protein-buttermilk-200-ml-pouch/",
  "amul-high-protein-paneer": "https://www.bigbasket.com/pd/40248436/amul-high-protein-paneer-200-g-pouch/",
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * BigBasket renders through Next.js, so pack shots live in the embedded JSON
 * rather than an og:image tag. Filenames start with the product id.
 */
function extractImages(html, productId) {
  const all = [...html.matchAll(/https:\/\/[\w.-]*bbassets\.com[\w./-]*\.(?:jpg|jpeg|png|webp)/g)].map((m) => m[0]);
  const unique = [...new Set(all)];
  const medium = unique.filter((url) => url.includes("/p/m/"));
  const large = unique.filter((url) => url.includes("/p/l/"));
  // The primary shot is "<id>_<n>-slug"; gallery extras carry "<id>-<n>_<n>-slug".
  const primary = (list) => list.find((url) => new RegExp(`/${productId}_\\d+-`).test(url));
  return [primary(medium), primary(large), medium[0], large[0]].filter(Boolean);
}

async function fetchText(url) {
  const response = await fetch(url, { headers: { "user-agent": UA, accept: "text/html" } });
  if (!response.ok) throw new Error(`${response.status} for ${url}`);
  return response.text();
}

async function loadsAsImage(url) {
  try {
    const response = await fetch(url, { headers: { "user-agent": UA, referer: "http://localhost:4317/" } });
    return response.ok && (response.headers.get("content-type") ?? "").startsWith("image/");
  } catch {
    return false;
  }
}

const results = {};
for (const [id, page] of Object.entries(productPages)) {
  const productId = page.match(/\/pd\/(\d+)\//)?.[1] ?? "";
  try {
    const html = await fetchText(page);
    const tokens = requiredTokens[id] ?? [];
    const candidates = extractImages(html, productId)
      .filter((url) => tokens.every((token) => url.toLowerCase().includes(token)));
    let chosen = null;
    for (const candidate of candidates) {
      if (await loadsAsImage(candidate)) {
        chosen = candidate;
        break;
      }
    }
    if (chosen) {
      results[id] = chosen;
      console.error(`ok    ${id}\n      ${chosen}`);
    } else {
      console.error(`MISS  ${id}  (no usable image among ${candidates.length} candidates)`);
    }
  } catch (error) {
    console.error(`FAIL  ${id}  ${error.message}`);
  }
  await sleep(1200);
}

console.error(`\nresolved ${Object.keys(results).length}/${Object.keys(productPages).length}`);
console.log(JSON.stringify(results, null, 2));
